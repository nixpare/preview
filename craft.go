package craft

import (
	"encoding/json"
	"fmt"
	"net/http"
	"pareserver/util"
	"strconv"
	"time"

	"github.com/nixpare/logger/v3"
	"github.com/nixpare/nix"
	"github.com/nixpare/nix/middleware"
	"github.com/nixpare/server/v3"
	"github.com/nixpare/server/v3/commands"
)

type mcUser struct {
	Username string `json:"username"`
	Passcode string `json:"passcode"`
	user     *McUser
}

type state struct {
	Name    string   `json:"name"`
	Running bool     `json:"running"`
	Players []string `json:"players"`
}

var (
	MC            *McServerManager
	cookieManager *middleware.CookieManager
)

func CraftInit(router *server.Router, commandServers []*commands.CommandServer) error {
	var err error
	cookieManager, err = middleware.NewCookieManager([]byte(cookie_hashkey), []byte(cookie_blockkey), nil)
	if err != nil {
		return err
	}

	MC = &McServerManager{
		router:  router,
		servers: make(map[string]*McServer),
		users:   make(map[string]*McUser),
	}

	err = startProxy(router, MC)
	if err != nil {
		return err
	}

	err = router.TaskManager.NewTask("Minecraft Server", func() (startupF server.TaskFunc, execF server.TaskFunc, cleanupF server.TaskFunc) {
		var alreadyOffline bool

		execF = func(_ *server.Task) error {
			return taskCheckUsers(MC, &alreadyOffline)
		}

		cleanupF = func(_ *server.Task) error {
			return MC.StopAll()
		}

		return
	}, server.TASK_TIMER_10_MINUTES)
	if err != nil {
		return err
	}

	err = MC.loadServers()
	if err != nil {
		return err
	}

	for _, srv := range commandServers {
		srv.Commands["mc"] = mcCommand(MC)
	}

	return nil
}

func Nixcraft() http.Handler {
	mux, n, _ := util.WebsiteHandler("craft.nixpare.com", basedir+"/public", nix.CookieManagerOption(cookieManager))

	// GET
	mux.HandleFunc("GET /servers", n.Handle(getAllServers))
	mux.HandleFunc("GET /{server}/status", n.Handle(getServerState))
	mux.HandleFunc("GET /logout", n.Handle(getLogout))

	// POST
	mux.HandleFunc("POST /", n.Handle(func(ctx *nix.Context) {
		ctx.Error(http.StatusBadRequest, "invalid POST request")
	}))
	mux.HandleFunc("POST /{$}", n.Handle(postLogin))
	mux.HandleFunc("POST /{server}/start", n.Handle(postStart))
	mux.HandleFunc("POST /{server}/stop", n.Handle(postStop))
	mux.HandleFunc("POST /{server}/connect", n.Handle(postConnect))
	mux.HandleFunc("POST /{server}/cmd", n.Handle(postCmd))

	return mux
}

func trustUser(ctx *nix.Context) (mcUser, bool) {
	var user mcUser
	err := ctx.GetCookiePerm(nixcraft_cookie_name, &user)
	if err != nil {
		ctx.DeleteCookie(nixcraft_cookie_name)
		ctx.Error(http.StatusUnauthorized, "Unauthorized request", err)
		return user, false
	}

	if user.Passcode != nixcraft_passcode {
		ctx.DeleteCookie(nixcraft_cookie_name)
		ctx.Error(http.StatusUnauthorized, "Unauthorized request", "invalid passcode")
		return user, false
	}

	ip := server.SplitAddrPort(ctx.R().RemoteAddr)

	MC.mutex.Lock()
	value, ok := MC.users[user.Username]
	if !ok {
		value = &McUser{
			name: user.Username,
		}

		MC.users[user.Username] = value
	}
	MC.mutex.Unlock()

	user.user = value

	if value.conn != nil && value.ip != ip {
		return user, false
	}

	value.ip = ip
	value.t = time.Now()
	return user, true
}

func getAllServers(ctx *nix.Context) {
	ctx.DisableErrorCapture()
	ctx.DisableLogging()

	_, ok := trustUser(ctx)
	if !ok {
		return
	}

	MC.mutex.RLock()

	var servers []string
	for srvName := range MC.servers {
		servers = append(servers, srvName)
	}

	MC.mutex.RUnlock()

	resp, err := json.Marshal(servers)
	if err != nil {
		ctx.Error(http.StatusInternalServerError, "Internal server error", err)
		return
	}

	ctx.JSON(resp)
}

func getServerState(ctx *nix.Context) {
	ctx.DisableErrorCapture()
	ctx.DisableLogging()

	srvName := ctx.R().PathValue("server")

	_, ok := trustUser(ctx)
	if !ok {
		return
	}

	MC.mutex.RLock()
	srv, ok := MC.servers[srvName]

	if !ok {
		MC.mutex.RUnlock()
		ctx.Error(http.StatusBadRequest, fmt.Sprintf("Server %s not found", srvName))
		return
	}

	serverState := state{
		Name:    srvName,
		Running: srv.IsRunning(),
		Players: srv.getOnlinePlayersNoLock(),
	}
	MC.mutex.RUnlock()

	resp, err := json.Marshal(serverState)
	if err != nil {
		ctx.Error(http.StatusInternalServerError, "Internal server error", err)
		return
	}

	ctx.JSON(resp)
}

func getLogout(ctx *nix.Context) {
	ctx.DisableLogging()
	ctx.DisableErrorCapture()
	ctx.DeleteCookie(nixcraft_cookie_name)
}

func postLogin(ctx *nix.Context) {
	var user mcUser
	err := ctx.ReadJSON(&user)
	if err != nil {
		ctx.Error(http.StatusBadRequest, "Invalid post request", err)
		return
	}

	if user.Passcode != nixcraft_passcode {
		ctx.Error(http.StatusBadRequest, "Invalid credentials", "invalid passcode")
		return
	}

	err = ctx.SetCookiePerm(nixcraft_cookie_name, user, 3600*24*30)
	if err != nil {
		ctx.Error(http.StatusInternalServerError, "Unable to complete login", err)
		return
	}

	ctx.WriteHeader(http.StatusOK)
}

func postStart(ctx *nix.Context) {
	srvName := ctx.R().PathValue("server")

	user, ok := trustUser(ctx)
	if !ok {
		return
	}

	if err := MC.Start(srvName); err != nil {
		ctx.Error(http.StatusInternalServerError, err.Error())
		return
	}

	ctx.AddInteralMessage(user.Username, "started the server")
	ctx.String("Done!")
}

func postStop(ctx *nix.Context) {
	srvName := ctx.R().PathValue("server")

	user, ok := trustUser(ctx)
	if !ok {
		return
	}

	if err := MC.Stop(srvName); err != nil {
		ctx.Error(http.StatusInternalServerError, err.Error())
		return
	}

	ctx.AddInteralMessage(user.Username, "stopped the server")
	ctx.String("Done!")
}

func postConnect(ctx *nix.Context) {
	srvName := ctx.R().PathValue("server")

	user, ok := trustUser(ctx)
	if !ok {
		return
	}

	err := user.user.ConnectToServer(srvName)
	if err != nil {
		ctx.Error(http.StatusBadGateway, fmt.Sprintf("Server %s not found", srvName), err)
		return
	}

	ctx.String("Done!")
}

type logRequestCmd string

const (
	getLogsCmd   logRequestCmd = "get-logs"
	sendCmd logRequestCmd = "send"
	sendBroadcastCmd logRequestCmd = "send-broadcast"
)

type logRequest struct {
	Cmd  logRequestCmd
	Args []string
}

func postCmd(ctx *nix.Context) {
	srvName := ctx.R().PathValue("server")

	_, ok := trustUser(ctx)
	if !ok {
		return
	}

	MC.mutex.RLock()
	srv, ok := MC.servers[srvName]
	MC.mutex.RUnlock()
	if !ok {
		ctx.Error(http.StatusBadRequest, fmt.Sprintf("Server %s not found", srvName))
		return
	}

	var cmdReq logRequest
	err := ctx.ReadJSON(&cmdReq)
	if err != nil {
		ctx.Error(http.StatusBadRequest, err.Error())
		return
	}

	switch cmdReq.Cmd {
	case getLogsCmd:
		ctx.DisableLogging()

		n, err := strconv.Atoi(cmdReq.Args[0])
		if err != nil {
			ctx.Error(http.StatusBadRequest, err.Error())
			return
		}

		if srv.log == nil {
			ctx.Error(http.StatusBadRequest, "Server ever started")
			return
		}

		nLogs := srv.log.Logs() - n
		if nLogs < 0 {
			nLogs = srv.log.Logs()
		}

		data, err := json.Marshal(srv.log.GetLastNLogs(nLogs))
		if err != nil {
			ctx.Error(http.StatusInternalServerError, err.Error())
			return
		}

		ctx.JSON(data)

	case sendCmd:
		if !srv.IsRunning() {
			ctx.Error(http.StatusBadRequest, "No server is running")
			return
		}

		srv.userLog.Printf(logger.LOG_LEVEL_WARNING, "User %s sent command: <%s>", cmdReq.Args[0], cmdReq.Args[1])
		ctx.AddInteralMessage(fmt.Sprintf("User %s sent command: <%s>", cmdReq.Args[0], cmdReq.Args[1]))

		err := srv.SendInput(cmdReq.Args[1])
		if err != nil {
			ctx.Error(http.StatusInternalServerError, err.Error())
			return
		}

	case sendBroadcastCmd:
		if !srv.IsRunning() {
			ctx.Error(http.StatusBadRequest, "No server is running")
			return
		}

		srv.userLog.Printf(logger.LOG_LEVEL_WARNING, "User %s sent broadcast message: <%s>", cmdReq.Args[0], cmdReq.Args[1])
		ctx.AddInteralMessage(fmt.Sprintf("User %s sent broadcast message: <%s>", cmdReq.Args[0], cmdReq.Args[1]))

		broadcastMessage := fmt.Sprintf("/title @a title {\"text\": \"%s\"}", cmdReq.Args[1])
		err := srv.SendInput(broadcastMessage)
		if err != nil {
			ctx.Error(http.StatusInternalServerError, err.Error())
			return
		}

	default:
		ctx.Error(http.StatusBadRequest, "Unknown command")
		return
	}
}
