package craft

import (
	"fmt"
	"net"
	"runtime/debug"

	"github.com/nixpare/logger/v3"
	"github.com/nixpare/server/v3"
)

const debug_mode = false

func startProxy(router *server.Router, msm *McServerManager) error {
	tcpSrv, err := router.NewTCPServer("", mc_public_port, false)
	if err != nil {
		return err
	}

	tcpSrv.ConnHandler = func(srv *server.TCPServer, conn net.Conn) {
		defer func() {
			if a := recover(); a != nil {
				if debug_mode {
					srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Error during craft proxy conn: [%v] %v\n%s", conn.RemoteAddr(), a, debug.Stack())
				} else {
					srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Error during craft proxy conn: [%v] %v", conn.RemoteAddr(), a)
				}
			}
		}()

		msm.proxyHandler(srv, conn)
	}
	tcpSrv.Start()

	return nil
}

func (msm *McServerManager) proxyHandler(srv *server.TCPServer, conn net.Conn) {
	addr, _, _ := net.SplitHostPort(conn.RemoteAddr().String())
	var buf [1]byte

	_, err := conn.Read(buf[:])
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Error reading packet length: %v", err)
		return
	}

	switch buf[0] {
	case 0xFE: // legacy
		msm.legacyProxyHandler(srv, conn, addr, buf[0])
	default:
		msm.newProxyHandler(srv, conn, addr, buf[0])
	}
}

func (msm *McServerManager) newProxyHandler(srv *server.TCPServer, conn net.Conn, addr string, length byte) {
	buf1 := make([]byte, length)

	n, err := conn.Read(buf1)
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Error reading packet: %v", err)
		return
	}
	buf1 = buf1[:n]

	//packetID := buf1[0]
	//protoVersion := buf[1]
	//unknown := buf[2]
	used := 3

	_, n, err = decodeString(buf1[used:]) // server network address
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Error reading server address: %v", err)
		return
	}
	used += n

	//port := binary.BigEndian.Uint16(buf1[used:used+2])
	used += 2
	packetType := buf1[used]

	switch packetType {
	case 0x1: // ping
		payload := make([]byte, 1, len(buf1) + 1)
		payload[0] = length
		payload = append(payload, buf1...)

		handlePingRequest(srv, conn, addr, payload)
		return
	}

	var b [1]byte
	_, err = conn.Read(b[:])
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Error reading login packet length: %v", err)
		return
	}

	buf2 := make([]byte, b[0])
	n, err = conn.Read(buf2)
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Error reading login packet: %v", err)
		return
	}
	buf2 = buf2[:n]

	// loginPacketID := buf2[0]
	userName, _, err := decodeString(buf2[1:])
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Error decoding username form login packet: %v", err)
		return
	}

	user, mcServer, ok := acceptConnection(msm, userName, addr)
	if !ok {
		return
	}

	serverAddr := fmt.Sprintf("localhost:%d", mcServer.port)
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

	_, err = proxy.Write([]byte{length})
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_ERROR, "Error writing back first packet length: %v", err)
		return
	}

	_, err = proxy.Write(buf1)
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_ERROR, "Error writing back first packet: %v", err)
		return
	}
	buf1 = nil

	_, err = proxy.Write(b[:])
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_ERROR, "Error writing back second packet length: %v", err)
		return
	}

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

func (msm *McServerManager) legacyProxyHandler(srv *server.TCPServer, conn net.Conn, addr string, id byte) {
	var buf [1]byte

	_, err := conn.Read(buf[:])
	if err != nil {
		srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Error reading packet type: %v", err)
		return
	}

	packetType := buf[0]
	switch packetType {
	case 0x1: // ping
		payload := [2]byte{id, buf[0]}

		handlePingRequest(srv, conn, addr, payload[:])
		return
	}

	srv.Logger.Printf(logger.LOG_LEVEL_WARNING, "Unknown legacy packet type %d", packetType)
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

func decodeVarInt(data []byte) (int, int, error) {
	var value int
    var bytesRead int

    for i, b := range data {
        value |= int(b & 0x7F) << (7 * i) // Estrai i primi 7 bit e aggiungili al valore
        bytesRead++

        if b & 0x80 == 0 { // Se l'ottavo bit è 0, abbiamo finito
            return value, bytesRead, nil
        }

        if i >= 4 { // VarInt può usare al massimo 5 byte
            return 0, 0, fmt.Errorf("VarInt too long")
        }
    }

    return 0, 0, fmt.Errorf("not enough data to decode VarInt")
}

func decodeString(data []byte) (string, int, error) {
	strLen, n, err := decodeVarInt(data)
	if err != nil {
		return "", 0, err
	}

	return string(data[n:n+strLen]), n+strLen, nil
}
