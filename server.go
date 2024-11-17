package craft

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

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
	Logger         *logger.Logger
	servers        map[string]*McServer
	users          map[string]*McUser
	pingIPToServer map[string]*McServer
	mutex          sync.RWMutex
}

type McServer struct {
	name string
	javaExec
	msm     *McServerManager
	process *process.Process
	log     *logger.Logger
	userLog *logger.Logger
}

var mcPrivatePortOffset = new(atomic.Int32)

func mcServerCmd(f string) (string, []string, int) {
	port := mc_public_port + int(mcPrivatePortOffset.Add(1))
	return "java", []string{"-Xms4G", "-Xmx8G", "-jar", f, "--port", fmt.Sprint(port), "nogui"}, int(port)
}

func (msm *McServerManager) loadServers() error {
	msm.mutex.Lock()
	defer msm.mutex.Unlock()

	for _, srv := range msm.servers {
		err := srv.Stop(true)
		if err != nil {
			msm.Logger.Printf(logger.LOG_LEVEL_ERROR, "Error stopping server %s: %v", srv.name, err)
			srv.process.Kill()
		}
	}
	clear(msm.servers)

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
				msm.servers[e.Name()] = &McServer{
					name: e.Name(),
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
			user.server = msm.servers[user.server.name]
		}
	}

	oldPingMap := msm.pingIPToServer
	msm.pingIPToServer = make(map[string]*McServer)

	for ip, srv := range oldPingMap {
		msm.pingIPToServer[ip] = msm.servers[srv.name]
	}

	return nil
}

func (msm *McServerManager) Start(name string) error {
	msm.mutex.RLock()
	srv, ok := msm.servers[name]
	msm.mutex.RUnlock()

	if !ok {
		return fmt.Errorf("server %s not found", name)
	}

	return srv.Start()
}

func (srv *McServer) Start() error {
	if srv.IsRunning() {
		return fmt.Errorf("server %s already running", srv.name)
	}

	var err error
	srv.process, err = process.NewProcess(srv.wd, srv.execName, srv.args...)
	if err != nil {
		return err
	}

	srv.log = logger.NewLogger(nil)
	srv.userLog = srv.log.Clone(nil, true, "user")
	outLog := srv.log.Clone(nil, true, "stdout")
	errLog := srv.log.Clone(nil, true, "stderr")

	err = srv.process.Start(nil, outLog.FixedLogger(logger.LOG_LEVEL_INFO), errLog.FixedLogger(logger.LOG_LEVEL_ERROR))
	if err != nil {
		srv.msm.Logger.Printf(
			logger.LOG_LEVEL_ERROR,
			"Minecraft server %v startup error: %v", srv.javaExec, err,
		)
		return err
	}
	srv.msm.Logger.Printf(
		logger.LOG_LEVEL_INFO,
		"Minecraft server %s started successfully", srv.name,
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
			"Minecraft server %s stopped successfully", srv.name,
		)
	}()

	return nil
}

func (msm *McServerManager) Stop(name string) error {
	msm.mutex.RLock()
	srv, ok := msm.servers[name]
	msm.mutex.RUnlock()

	if !ok {
		return fmt.Errorf("server %s not found", name)
	}

	return srv.Stop(false)
}

func (msm *McServerManager) StopAll() error {
	msm.mutex.RLock()
	defer msm.mutex.RUnlock()

	var errs []error
	for _, srv := range msm.servers {
		errs = append(errs, srv.Stop(true))
	}

	return errors.Join(errs...)
}

func (srv *McServer) Stop(alreadyLocked bool) error {
	if !srv.IsRunning() {
		return nil
	}

	var onlinePlayers []string
	if alreadyLocked {
		onlinePlayers = srv.getOnlinePlayersNoLock()
	} else {
		srv.msm.mutex.RLock()
		onlinePlayers = srv.getOnlinePlayersNoLock()
		srv.msm.mutex.RUnlock()
	}

	if len(onlinePlayers) > 0 {
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
		return fmt.Errorf("minecraft server %s stop error (code: %d): %w", srv.name, exitStatus.ExitCode, exitStatus.ExitError)
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

func (srv *McServer) getOnlinePlayersNoLock() []string {
	var v []string
	for _, user := range srv.msm.users {
		if user.server != srv {
			continue
		}

		if user.conn != nil {
			v = append(v, user.name)
		}
	}
	return v
}

func (user *McUser) ConnectToServer(srvName string) error {
	MC.mutex.Lock()
	defer MC.mutex.Unlock()

	srv, ok := MC.servers[srvName]
	if !ok {
		return fmt.Errorf("user %s connect: server %s not found", user.name, srvName)
	}

	MC.pingIPToServer[user.ip] = srv

	if srv == user.server {
		return nil
	}

	if user.conn != nil {
		user.conn.Close()
	}

	user.server = srv
	return nil
}
