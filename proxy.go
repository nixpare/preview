package craft

import (
	"bytes"
	"fmt"
	"io"
	"net"

	"github.com/nixpare/logger/v3"
	"github.com/nixpare/server/v3"
)

func startProxy(router *server.Router, msm *McServerManager) error {
	tcpSrv, err := router.NewTCPServer("", mc_public_port, false)
	if err != nil {
		return err
	}

	tcpSrv.ConnHandler = msm.proxyHandler
	tcpSrv.Start()

	return nil
}

func (msm *McServerManager) proxyHandler(srv *server.TCPServer, conn net.Conn) {
	addr, _, _ := net.SplitHostPort(conn.RemoteAddr().String())

	buf1 := make([]byte, 1024)
	n, err := conn.Read(buf1)
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Error reading first packet: %v", err)
		return
	}

	packetID := buf1[0]

	switch packetID {
	case 0x12 /* vanilla */, 0x18 /* modrinth */, 0x10 /* multimc */ :
		packetType := buf1[n-1]
		msm.Logger.Debug(packetType, buf1[:n], string(buf1[:n]))
		switch packetType {
		case 0x1: // old ping
			handlePingRequest(srv, conn, addr, buf1[:n])
			return
		case 0x2: // login start
		default:
			srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Unknown packetType: %d", packetType)
			return
		}

	case 0xFE: // new ping
		handlePingRequest(srv, conn, addr, buf1[:n])
		return
	default:
		srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Unknown packetID: %d", packetID)
		return
	}

	buf2 := make([]byte, 1024)
	n, err = conn.Read(buf2)
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Error reading login packet: %v", err)
		return
	}

	userName, err := readString(bytes.NewBuffer(buf2[2:n]))
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Error decoding username form login packet: %v", err)
		return
	}

	user, mcServer, ok := acceptConnection(msm, userName, addr)
	if !ok {
		return
	}

	serverAddr := fmt.Sprintf("%s:%d", "127.0.0.1", mcServer.port)
	target, err := net.ResolveTCPAddr("tcp", serverAddr)
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_ERROR, "Error resolving server addr %s", serverAddr)
		return
	}

	proxy, err := net.DialTCP("tcp", nil, target)
	if err != nil {
		return
	}
	defer proxy.Close()

	_, err = proxy.Write(buf1)
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_ERROR, "Error writing back first packet: %v", err)
		return
	}
	buf1 = nil

	_, err = proxy.Write(buf2)
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_ERROR, "Error writing back second packet: %v", err)
		return
	}
	buf2 = nil

	user.conn = conn
	mcServer.playerConnected(user)

	defer func() {
		user.conn = nil
		mcServer.playerDisconnected(user)
	}()

	server.TCPPipe(conn, proxy)
}

func acceptConnection(msm *McServerManager, userName string, addr string) (*McUser, *McServer, bool) {
	msm.mutex.RLock()
	defer msm.mutex.RUnlock()

	user, ok := msm.users[userName]
	if !ok {
		return nil, nil, false
	}

	if addr != user.IP || user.conn != nil {
		return nil, nil, false
	}

	if user.server == nil {
		return nil, nil, false
	}

	if !user.server.IsRunning() {
		return nil, nil, false
	}

	return user, user.server, true
}

func handlePingRequest(srv *server.TCPServer, conn net.Conn, addr string, packet []byte) {
	MC.mutex.RLock()
	mcServer, ok := MC.pingIPToServer[addr]
	MC.mutex.RUnlock()

	if !ok || !mcServer.IsRunning() {
		return
	}

	serverAddr := fmt.Sprintf("%s:%d", "127.0.0.1", mcServer.port)
	target, err := net.ResolveTCPAddr("tcp", serverAddr)
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_ERROR, "Error resolving server addr %s", serverAddr)
		return
	}

	proxy, err := net.DialTCP("tcp", nil, target)
	if err != nil {
		return
	}
	defer proxy.Close()

	_, err = proxy.Write(packet)
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_ERROR, "Error writing back ping packet: %v", err)
		return
	}

	server.TCPPipe(conn, proxy)
}

func readVarInt(rd io.Reader) (int32, error) {
	var result int32
	var length uint

	byteRead := make([]byte, 1)
	for {
		_, err := rd.Read(byteRead)
		if err != nil {
			return 0, err
		}

		value := byteRead[0]
		result |= int32(value&0x7F) << (length * 7)

		length++
		if length > 5 {
			return 0, fmt.Errorf("VarInt too long")
		}

		if (value & 0x80) == 0 {
			break
		}
	}

	return result, nil
}

func readString(rd io.Reader) (string, error) {
	strLen, err := readVarInt(rd)
	if err != nil {
		return "", err
	}

	strBytes := make([]byte, strLen)
	_, err = rd.Read(strBytes)
	if err != nil {
		return "", err
	}

	return string(strBytes), nil
}
