package main

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/nixpare/logger/v3"
	"github.com/nixpare/server/v3"
	"github.com/nixpare/server/v3/commands"
)

type chanListener chan net.Conn

func newChanListener() chanListener {
	return make(chan net.Conn, 10)
}

func (ch chanListener) Accept() (net.Conn, error) {
	conn, ok := <- ch
	if !ok {
		return nil, net.ErrClosed
	}

	return conn, nil
}

func (ch chanListener) Close() error {
	close(ch)
	return nil
}

func (ch chanListener) Addr() net.Addr {
	return chanAddr(true)
}

// true for server, false for client
type chanAddr bool

func (addr chanAddr) Network() string {
	return "go-chan"
}

func (addr chanAddr) String() string {
	if addr {
		return "server"
	} else {
		return "client"
	}
}

type chanConn struct {
	io.ReadCloser
	io.Writer
}

func (conn *chanConn) LocalAddr() net.Addr {
	return chanAddr(false)
}

func (conn *chanConn) RemoteAddr() net.Addr {
	return chanAddr(true)
}

func (conn *chanConn) SetDeadline(t time.Time) error {
	return nil
}

func (conn *chanConn) SetReadDeadline(t time.Time) error {
	return nil
}

func (conn *chanConn) SetWriteDeadline(t time.Time) error {
	return nil
}

func dialChan(ln chanListener) (conn net.Conn, err error) {
	defer func() {
		if a := recover(); a != nil {
			err = fmt.Errorf("%v", a)
		}
	}()

	clientRd, serverWr := io.Pipe()
	serverRd, clientWr := io.Pipe()

	clientConn := &chanConn{
		ReadCloser: clientRd,
		Writer: clientWr,
	}

	serverConn := &chanConn{
		ReadCloser: serverRd,
		Writer: serverWr,
	}

	ln <- serverConn
	return clientConn, nil
}

func newCommandServer(ln net.Listener, l *logger.Logger, router *server.Router) (*commands.CommandServer, error) {
	cmdServer, err := commands.NewCommandServer(ln, l.Clone(nil, true, "command-server", "pipe-command-server"), router)
	if err != nil {
		return nil, fmt.Errorf("new pipe command server: %w", err)
	}

	return cmdServer, nil
}

func cmdOverPipe(ln chanListener, stdin io.Reader, stdout, stderr io.Writer, cmd string, args ...string) (exitCode int) {
    var err error
    exitCode, err = commands.SendCommand(
        func() (net.Conn, error) {
			return dialChan(ln)
		},
        stdin, stdout, stderr,
        cmd, args...,
    )
    if err != nil {
        if exitCode == -1 {
            exitCode = 1
            logger.Printf(logger.LOG_LEVEL_ERROR, "Command connection error: %v\n", err)
        } else {
            logger.Printf(logger.LOG_LEVEL_ERROR, "Command error: %v\n", err)
        }
    }
    return
}

func sendCmdsOverStdin(ln chanListener) {
	sc := bufio.NewScanner(os.Stdin)
	for sc.Scan() {
		cmd, argStr, _ := strings.Cut(sc.Text(), " ")
		args := strings.Split(argStr, " ")

		requiredCTRLC++

		exitCode := cmdOverPipe(
			ln,
			os.Stdin, os.Stdout, os.Stderr,
			cmd, args...
		)
		if exitCode != 0 {
			logger.Printf(logger.LOG_LEVEL_WARNING, "Command terminated with code %d\n", exitCode)
		}

		if runtime.GOOS == "windows" {
			// Perchè lo sa solo Microsoft di merda
			fmt.Print("Press enter to disconnect from the command ...")
		}
		
		requiredCTRLC--
	}
}
