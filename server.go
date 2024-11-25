package craft

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/nixpare/broadcaster"
	"github.com/nixpare/logger/v3"
	"github.com/nixpare/process"
	"github.com/nixpare/server/v3/commands"
)

type javaExec struct {
	execName string
	args     []string
	wd       string
	port     int
}

type McServerManager struct {
	Logger         *logger.Logger       `json:"-"`
	Servers        map[string]*McServer `json:"servers"`
	users          map[string]*McUser
	pingIPToServer map[string]*McServer
	mutex          sync.RWMutex

	UpdateBroadcaster *broadcaster.Broadcaster[[]byte] `json:"-"`
}

type McServer struct {
	javaExec
	Name    string             `json:"name"`
	
	Players map[string]*McUser `json:"players"`
	m       sync.RWMutex
	
	msm     *McServerManager
	process *process.Process
	log     *logger.Logger
	userLog *logger.Logger
	serverLog *logger.Logger

	lastDisconnect time.Time
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

func (msm *McServerManager) loadServers() error {
	msm.mutex.Lock()
	defer msm.mutex.Unlock()

	for _, srv := range msm.Servers {
		err := srv.Stop()
		if err != nil {
			msm.Logger.Printf(logger.LOG_LEVEL_ERROR, "Error stopping server %s: %v", srv.Name, err)
			srv.process.Kill()
		}
	}
	clear(msm.Servers)

	entries, err := os.ReadDir(mc_servers_path)
	if err != nil {
		return err
	}

loop:
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		dir := mc_servers_path + "/" + e.Name()

		childs, _ := os.ReadDir(dir)
		for _, child := range childs {
			if child.IsDir() {
				continue
			}

			if strings.HasPrefix(child.Name(), "server") && strings.HasSuffix(child.Name(), ".jar") {
				execName, args, port := mcServerCmd(child.Name())
				msm.Servers[e.Name()] = &McServer{
					Name: e.Name(),
					Players: make(map[string]*McUser),
					javaExec: javaExec{
						execName: execName, args: args,
						wd: dir, port: port,
					},
					msm: msm,
				}

				continue loop
			}
		}
	}

	for _, user := range msm.users {
		if user.server != nil {
			user.server = msm.Servers[user.server.Name]
		}
	}

	oldPingMap := msm.pingIPToServer
	msm.pingIPToServer = make(map[string]*McServer)

	for ip, srv := range oldPingMap {
		msm.pingIPToServer[ip] = msm.Servers[srv.Name]
	}

	go msm.SignalStateUpdate()
	return nil
}

func (msm *McServerManager) Start(name string) error {
	msm.mutex.RLock()
	srv, ok := msm.Servers[name]
	msm.mutex.RUnlock()

	if !ok {
		return fmt.Errorf("server %s not found", name)
	}

	err := srv.Start()
	if err != nil {
		return err
	}

	return nil
}

func noTrimFunc(s string) string { return s }

func (srv *McServer) Start() error {
	srv.m.Lock()
	defer srv.m.Unlock()

	if srv.IsRunning() {
		return fmt.Errorf("server %s already running", srv.Name)
	}

	var err error
	srv.process, err = process.NewProcess(srv.wd, srv.execName, srv.args...)
	if err != nil {
		return err
	}
	srv.process.InheritConsole(false)

	if srv.log != nil {
		srv.log.Close()
	}
	srv.log = logger.NewLogger(nil)
	srv.log.TrimFunc = noTrimFunc

	if srv.userLog != nil {
		srv.userLog.Close()
	}
	srv.userLog = srv.log.Clone(nil, true, "user")
	srv.userLog.TrimFunc = noTrimFunc

	if srv.serverLog != nil {
		srv.serverLog.Close()
	}
	srv.serverLog = srv.log.Clone(nil, true, "server")
	srv.serverLog.TrimFunc = noTrimFunc

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

	err = srv.process.Start(nil, nil, nil)
	if err != nil {
		srv.msm.Logger.Printf(
			logger.LOG_LEVEL_ERROR,
			"Minecraft server %v startup error: %v", srv.javaExec, err,
		)
		return err
	}
	srv.msm.Logger.Printf(
		logger.LOG_LEVEL_INFO,
		"Minecraft server %s started successfully", srv.Name,
	)

	go func() {
		exitStatus := srv.process.Wait()
		if err := exitStatus.Error(); err != nil {
			srv.msm.Logger.Printf(
				logger.LOG_LEVEL_ERROR,
				"Minecraft server %v exit error: %v\n%s",
				srv.javaExec, err, string(srv.process.Stdout()),
			)
			return
		}

		srv.msm.Logger.Printf(
			logger.LOG_LEVEL_INFO,
			"Minecraft server %s stopped successfully", srv.Name,
		)
	}()

	go srv.msm.SignalStateUpdate()
	return nil
}

func (msm *McServerManager) Stop(name string) error {
	msm.mutex.RLock()
	srv, ok := msm.Servers[name]
	msm.mutex.RUnlock()

	if !ok {
		return fmt.Errorf("server %s not found", name)
	}

	err := srv.Stop()
	if err != nil {
		return err
	}

	return nil
}

func (msm *McServerManager) StopAll() error {
	msm.mutex.RLock()
	defer msm.mutex.RUnlock()

	var errs []error
	for _, srv := range msm.Servers {
		errs = append(errs, srv.Stop())
	}

	return errors.Join(errs...)
}

func (srv *McServer) Stop() error {
	srv.m.RLock()
	defer srv.m.RUnlock()

	if !srv.IsRunning() {
		return nil
	}
	
	onlinePlayers := len(srv.Players) > 0

	if onlinePlayers {
		srv.process.SendText("/title @a times 0.5s 0.3s 0.5s")
		shutdownInProgressSubtitle := "/title @a subtitle {\"text\": \"Server is going to shut down\"}"

		for i := range 10 {
			srv.process.SendText(fmt.Sprintf("/title @a title {\"text\": \"%d\"}", 10-i))
			srv.process.SendText(shutdownInProgressSubtitle)
			time.Sleep(time.Second)
		}

		srv.process.SendText("/title @a times 2s 0s 2s")
		srv.process.SendText("/title @a title {\"text\": \"Server is shutting down\"}")
		time.Sleep(time.Second * 5)
	}

	srv.process.SendText("stop")

	exitStatus := srv.process.Wait()
	if exitStatus.Error() != nil {
		return fmt.Errorf("minecraft server %s stop error (code: %d): %w", srv.Name, exitStatus.ExitCode, exitStatus.ExitError)
	}

	go srv.msm.SignalStateUpdate()
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
	srv.m.Lock()
	srv.Players[user.Name] = user
	srv.m.Unlock()

	srv.msm.SignalStateUpdate()
}

func (srv *McServer) playerDisconnected(user *McUser) {
	srv.m.Lock()
	delete(srv.Players, user.Name)
	srv.lastDisconnect = time.Now()
	srv.m.Unlock()

	srv.msm.SignalStateUpdate()
}

func (user *McUser) ConnectToServer(srvName string) error {
	MC.mutex.Lock()
	defer MC.mutex.Unlock()

	srv, ok := MC.Servers[srvName]
	if !ok {
		return fmt.Errorf("user %s connect: server %s not found", user.Name, srvName)
	}

	MC.pingIPToServer[user.IP] = srv

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

func (msm *McServerManager) SignalStateUpdate() {
	msm.UpdateBroadcaster.Send(msm.generateState())
}

func (msm *McServerManager) generateState() []byte {
	msm.mutex.RLock()
	defer msm.mutex.RUnlock()

	data, _ := json.Marshal(msm)
	return data
}

func (srv *McServer) MarshalJSON() ([]byte, error) {
	type alias McServer

	jsonServer := struct {
		*alias
		Running bool `json:"running"`
	}{
		alias:  (*alias)(srv),
		Running: srv.IsRunning(),
	}

	return json.Marshal(jsonServer)
}

func (user *McUser) SignalStateUpdate() {
	user.updateBroadcaster.Send(user.generateState())
}

func (user *McUser) generateState() []byte {
	data, _ := json.Marshal(user)
	return data
}

func (user *McUser) MarshalJSON() ([]byte, error) {
	type alias McUser

	var serverName string
	if user.server != nil {
		serverName = user.server.Name
	}

	jsonUser := struct {
		*alias
		Server string `json:"server"`
	}{
		alias:  (*alias)(user),
		Server: serverName,
	}

	return json.Marshal(jsonUser)
}
