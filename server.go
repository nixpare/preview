package craft

import (
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"github.com/nixpare/broadcaster"
	"github.com/nixpare/logger/v3"
	"github.com/nixpare/process"
	"github.com/nixpare/server/v3/commands"
)

type McServerInfo struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Version string `json:"version"`
}

type mcServerInfoFile struct {
	McServerInfo
	Jar  string   `json:"jar"`
	Args []string `json:"args"`
}

type McServer struct {
	McServerInfo

	Players map[string]*McUser `json:"players"`
	mutex   sync.RWMutex

	msm     *McServerManager
	process *process.Process
	port    int

	log       *logger.Logger
	serverLog *logger.Logger
	userLog   *logger.Logger
	chatLog   *logger.Logger

	lastDisconnect time.Time

	privateInfo *privateMcServerInfo
}

type McUser struct {
	Name string `json:"name"`
	IP   string `json:"ip"`

	server *McServer
	conn   net.Conn

	updateBroadcaster *broadcaster.Broadcaster[[]byte]
}

func newMcUser(username string) *McUser {
	return &McUser{
		Name:              username,
		updateBroadcaster: broadcaster.NewBroadcaster[[]byte](),
	}
}

var mcPrivatePortOffset = new(atomic.Int32)

func mcServerCmd(f string) (string, []string, int) {
	port := mc_public_port + int(mcPrivatePortOffset.Add(1))
	return "java", []string{"-Xms4G", "-Xmx8G", "-jar", f, "--port", fmt.Sprint(port), "nogui"}, int(port)
}

func (msm *McServerManager) NewMcServer(serverJSON *mcServerInfoFile, proc *process.Process, port int) *McServer {
	srv := &McServer{
		McServerInfo: serverJSON.McServerInfo,
		Players:      make(map[string]*McUser),
		msm:          msm,

		process: proc,
		port:    port,
	}
	srv.generatePrivateState()

	return srv
}

func noTrimFunc(s string) string { return s }

func (srv *McServer) Start() error {
	srv.mutex.Lock()
	defer srv.mutex.Unlock()

	if srv.IsRunning() {
		return fmt.Errorf("server %s already running", srv.Name)
	}

	if srv.log != nil {
		srv.log.Close()
	}
	srv.log = logger.NewLogger(nil)
	srv.log.TrimFunc = noTrimFunc

	if srv.serverLog != nil {
		srv.serverLog.Close()
	}
	srv.serverLog = srv.log.Clone(nil, true, "server")
	srv.serverLog.TrimFunc = noTrimFunc

	if srv.userLog != nil {
		srv.userLog.Close()
	}
	srv.userLog = srv.log.Clone(nil, true, "user")
	srv.userLog.TrimFunc = noTrimFunc

	if srv.chatLog != nil {
		srv.chatLog.Close()
	}
	srv.chatLog = srv.log.Clone(nil, true, "chat")
	srv.chatLog.TrimFunc = noTrimFunc

	outLog := srv.log.Clone(nil, true, "stdout")
	outLog.TrimFunc = noTrimFunc
	outLogWriter := outLog.FixedLogger(logger.LOG_LEVEL_INFO)

	errLog := srv.log.Clone(nil, true, "stderr")
	errLog.TrimFunc = noTrimFunc
	errLogWriter := errLog.FixedLogger(logger.LOG_LEVEL_ERROR)

	stdoutCh := srv.process.StdoutListener(20)
	stderrCh := srv.process.StderrListener(20)

	go func() {
		for line := range stdoutCh {
			outLogWriter.Write(append(line, '\n'))
		}
	}()
	go func() {
		for line := range stderrCh {
			errLogWriter.Write(append(line, '\n'))
		}
	}()

	err := srv.process.Start(nil, nil, nil)
	if err != nil {
		srv.msm.Logger.Printf(
			logger.LOG_LEVEL_ERROR,
			"Minecraft server %s process (%s) startup error: %v", srv.Name, srv.process.ExecName, err,
		)
		return err
	}

	srv.msm.Logger.Printf(
		logger.LOG_LEVEL_INFO,
		"Minecraft server %s started successfully", srv.Name,
	)
	srv.lastDisconnect = time.Now().Add(time.Minute * 10)

	go func() {
		defer srv.SignalStateUpdate()

		exitStatus := srv.process.Wait()
		if err := exitStatus.Error(); err != nil {
			srv.msm.Logger.Printf(
				logger.LOG_LEVEL_ERROR,
				"Minecraft server %s process (%s) exit error: %v\n%s",
				srv.Name, srv.process.ExecName, err, string(srv.process.Stdout()),
			)
			return
		}

		srv.msm.Logger.Printf(
			logger.LOG_LEVEL_INFO,
			"Minecraft server %s stopped successfully", srv.Name,
		)
	}()

	srv.SignalStateUpdate()
	return nil
}

func (srv *McServer) Stop() error {
	srv.mutex.RLock()
	defer srv.mutex.RUnlock()

	if !srv.IsRunning() {
		return nil
	}

	onlinePlayers := len(srv.Players) > 0

	if onlinePlayers {
		srv.process.SendText("/title @a times 0.5s 0.3s 0.5s")
		shutdownInProgressSubtitle := "/title @a subtitle {\"text\": \"Server is going to shut down\"}"

		for i := range 5 {
			srv.process.SendText(fmt.Sprintf("/title @a title {\"text\": \"%d\"}", 5-i))
			srv.process.SendText(shutdownInProgressSubtitle)
			time.Sleep(time.Second)
		}

		srv.process.SendText("/title @a times 1s 0s 1s")
		srv.process.SendText("/title @a title {\"text\": \"Server is shutting down\"}")
		time.Sleep(time.Second * 2)
	}

	srv.process.SendText("stop")

	exitStatus := srv.process.Wait()
	if exitStatus.Error() != nil {
		return fmt.Errorf("minecraft server %s stop error (code: %d): %w", srv.Name, exitStatus.ExitCode, exitStatus.ExitError)
	}

	return nil
}

func (srv *McServer) SendInput(payload string) error {
	if !srv.IsRunning() {
		return errors.New("minecraft server not running")
	}

	return srv.process.SendText(payload)
}

func (mc *McServer) IsRunning() bool {
	return mc.process != nil && mc.process.IsRunning()
}

func (srv *McServer) Connect(sc *commands.ServerConn) error {
	var exit bool
	defer func() { exit = true }()

	go func() {
		old, ch := srv.process.ConnectStdout(20)
		for _, line := range old {
			sc.WriteOutput(string(line))
		}
		for !exit {
			line, ok := <-ch
			if !ok {
				break
			}
			sc.WriteOutput(string(line))
		}
	}()
	go func() {
		old, ch := srv.process.ConnectStderr(20)
		for _, line := range old {
			sc.WriteError(string(line))
		}
		for !exit {
			line, ok := <-ch
			if !ok {
				break
			}
			sc.WriteError(string(line))
		}
	}()

	for {
		in, err := sc.ReadMessage()
		if err != nil {
			if !errors.Is(err, io.EOF) {
				return err
			}
			break
		}

		if in.IsInterrupt() {
			break
		}

		srv.process.SendText(in.Message)
	}

	return nil
}

func (srv *McServer) playerConnected(user *McUser) {
	srv.mutex.Lock()
	srv.Players[user.Name] = user
	srv.mutex.Unlock()

	srv.SignalStateUpdate()
}

func (srv *McServer) playerDisconnected(user *McUser) {
	srv.mutex.Lock()
	delete(srv.Players, user.Name)
	srv.lastDisconnect = time.Now()
	srv.mutex.Unlock()

	srv.SignalStateUpdate()
}

func (user *McUser) ConnectToServer(srvName string) error {
	srv, ok := MC.GetServer(srvName)
	if !ok {
		return fmt.Errorf("user %s connect: server %s not found", user.Name, srvName)
	}

	MC.mutex.Lock()
	MC.pingIPToServer[user.IP] = srv
	MC.mutex.Unlock()

	if srv == user.server {
		return nil
	}

	if user.conn != nil {
		user.conn.Close()
	}

	user.server = srv
	user.SignalStateUpdate()

	return nil
}
