package craft

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/nixpare/broadcaster"
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

var (
	MC = &McServerManager{
		Logger:  logger.DefaultLogger,
		Servers: make(map[string]*McServer),
		users:   make(map[string]*McUser),

		UpdateBroadcaster: broadcaster.NewBroadcaster[[]byte](),
	}

	cookieManager *middleware.CookieManager
)

func CraftInit(router *server.Router, commandServers []*commands.CommandServer) error {
	var err error
	cookieManager, err = middleware.NewCookieManager([]byte(cookie_hashkey), []byte(cookie_blockkey), nil)
	if err != nil {
		return err
	}

	MC.Logger = router.Logger.Clone(nil, true, "nixcraft-manager")

	err = startProxy(router, MC)
	if err != nil {
		return err
	}

	err = router.TaskManager.NewTask("NixCraft", func() (startupF server.TaskFunc, execF server.TaskFunc, cleanupF server.TaskFunc) {
		execF = func(t *server.Task) error {
			MC.mutex.RLock()
			defer MC.mutex.RUnlock()

			now := time.Now()
			for _, srv := range MC.Servers {
				srv.m.RLock()
				isRunning := srv.IsRunning()
				players := len(srv.Players)
				srv.m.RUnlock()

				if !isRunning || players != 0 {
					continue
				}

				if now.After(srv.lastDisconnect.Add(time.Minute * 10)) {
					srv.serverLog.Printf(logger.LOG_LEVEL_INFO, "Shutting down server for inactivity")
					
					err := srv.Stop()
					if err != nil {
						t.Logger.Printf(logger.LOG_LEVEL_ERROR, "Error shutting down Minecraft Server %s: %v", srv.Name, err)
					}
				}
			}

			return nil
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
	var err error
	cookieManager, err = middleware.NewCookieManager([]byte(cookie_hashkey), []byte(cookie_blockkey), nil)
	if err != nil {
		panic(err)
	}

	mux := http.NewServeMux()
	n := nix.New(
		nix.CookieManagerOption(cookieManager),
		nix.EnableLoggingOption(),
		nix.LoggerOption(logger.DefaultLogger),
		nix.EnableErrorCaptureOption(),
		nix.EnableRecoveryOption(),
		nix.ConnectToMainOption(),
	)

	mux.HandleFunc("GET /", n.Handle(func(ctx *nix.Context) {
		_, err := trustUser(ctx)
		reqPath := ctx.RequestPath()

		switch reqPath {
		case "/":
			if err != nil {
				ctx.Redirect("/login", http.StatusTemporaryRedirect)
				return
			}
		case "/login":
			if err == nil {
				ctx.Redirect("/", http.StatusTemporaryRedirect)
				return
			}
		}

		if forwardToReact {
			ctx.DisableErrorCapture()
			ctx.ReverseProxy(reactAddr)
			return
		} else {
			path := ctx.RequestPath()
			if path != "/" && !strings.Contains(path, ".") {
				path += ".html"
			}

			ctx.ServeFile(basedir + "/dist" + path)
		}
	}))

	// GET
	mux.HandleFunc("GET /logout", n.Handle(getLogout))

	// POST
	mux.HandleFunc("POST /", n.Handle(func(ctx *nix.Context) {
		ctx.Error(http.StatusBadRequest, "invalid POST request")
	}))
	mux.HandleFunc("POST /login", n.Handle(postLogin))
	mux.HandleFunc("POST /{server}/start", n.Handle(postStart))
	mux.HandleFunc("POST /{server}/stop", n.Handle(postStop))
	mux.HandleFunc("POST /{server}/connect", n.Handle(postConnect))
	mux.HandleFunc("POST /{server}/broadcast", n.Handle(postBroadcast))

	// WebSocket
	mux.HandleFunc("GET /ws/servers", n.Handle(wsServersInfo))
	mux.HandleFunc("GET /ws/user", n.Handle(wsUserInfo))
	mux.HandleFunc("GET /ws/{server}/console", n.Handle(wsServerConsole))

	return mux
}

func trustUser(ctx *nix.Context) (mcUser, error) {
	var user mcUser
	err := ctx.GetCookiePerm(nixcraft_cookie_name, &user)
	if err != nil {
		ctx.DeleteCookie(nixcraft_cookie_name)
		return user, err
	}

	if user.Passcode != nixcraft_passcode {
		ctx.DeleteCookie(nixcraft_cookie_name)
		return user, errors.New("invalid passcode")
	}

	ip := server.SplitAddrPort(ctx.R().RemoteAddr)
	if ip == "::1" {
		ip = "127.0.0.1"
	}

	MC.mutex.Lock()
	value, ok := MC.users[user.Username]
	if !ok {
		value = newMcUser(user.Username)
		MC.users[user.Username] = value
	}
	MC.mutex.Unlock()

	user.user = value
	value.IP = ip

	return user, nil
}

func handleTrustUserResult(ctx *nix.Context, err error) {
	ctx.Error(http.StatusUnauthorized, "Unauthorized request", err)
}

//
// GET
//

func getLogout(ctx *nix.Context) {
	ctx.DisableLogging()
	ctx.DisableErrorCapture()
	ctx.DeleteCookie(nixcraft_cookie_name)
}

//
// POST
//

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

	user, err := trustUser(ctx)
	if err != nil {
		handleTrustUserResult(ctx, err)
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

	user, err := trustUser(ctx)
	if err != nil {
		handleTrustUserResult(ctx, err)
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

	user, err := trustUser(ctx)
	if err != nil {
		handleTrustUserResult(ctx, err)
		return
	}

	err = user.user.ConnectToServer(srvName)
	if err != nil {
		ctx.Error(http.StatusBadGateway, fmt.Sprintf("Server %s not found", srvName), err)
		return
	}

	ctx.String("Done!")
}

func postBroadcast(ctx *nix.Context) {
	srvName := ctx.R().PathValue("server")

	user, err := trustUser(ctx)
	if err != nil {
		handleTrustUserResult(ctx, err)
		return
	}

	MC.mutex.RLock()
	srv, ok := MC.Servers[srvName]
	MC.mutex.RUnlock()
	if !ok {
		ctx.Error(http.StatusBadRequest, fmt.Sprintf("Server %s not found", srvName))
		return
	}

	if !srv.IsRunning() {
		ctx.Error(http.StatusBadRequest, "No server is running")
		return
	}

	message, err := ctx.BodyString()
	if err != nil {
		ctx.Error(http.StatusInternalServerError, err.Error())
		return
	}

	srv.userLog.Printf(logger.LOG_LEVEL_WARNING, "User %s sent broadcast message: <%s>", user.Username, message)
	ctx.AddInteralMessage(fmt.Sprintf("User %s sent broadcast message: <%s>", user.Username, message))

	broadcastMessage := fmt.Sprintf("/title @a title {\"text\": \"%s\"}", message)
	err = srv.SendInput(broadcastMessage)
	if err != nil {
		ctx.Error(http.StatusInternalServerError, err.Error())
		return
	}
}

//
// WebSocket
//

func wsServersInfo(ctx *nix.Context) {
	ctx.DisableErrorCapture()

	_, err := trustUser(ctx)
	if err != nil {
		handleTrustUserResult(ctx, err)
		return
	}

	if !ctx.IsWebSocketRequest() {
		return
	}

	conn, err := websocket.Accept(ctx, ctx.R(), nil)
	if err != nil {
		ctx.Error(http.StatusBadRequest, "Invalid Request", err)
	}
	defer conn.CloseNow()

	err = conn.Write(ctx.R().Context(), websocket.MessageText, MC.generateState())
	if err != nil {
		ctx.AddInteralMessage(err)
		return
	}

	updates := MC.UpdateBroadcaster.Register(10)
	defer updates.Unregister()

	go func() {
		for data := range updates.Ch() {
			conn.Write(ctx.R().Context(), websocket.MessageText, data)
		}
	}()

	conn.Read(ctx.R().Context())
}

func wsUserInfo(ctx *nix.Context) {
	ctx.DisableErrorCapture()

	user, err := trustUser(ctx)
	if err != nil {
		handleTrustUserResult(ctx, err)
	}

	if !ctx.IsWebSocketRequest() {
		return
	}

	conn, err := websocket.Accept(ctx, ctx.R(), nil)
	if err != nil {
		ctx.Error(http.StatusBadRequest, "Invalid Request", err)
	}
	defer conn.CloseNow()

	err = conn.Write(ctx.R().Context(), websocket.MessageText, user.user.generateState())
	if err != nil {
		ctx.AddInteralMessage(err)
		return
	}

	updates := user.user.updateBroadcaster.Register(10)
	defer updates.Unregister()

	go func() {
		for range updates.Ch() {
			data, err := json.Marshal(user.user)
			if err != nil {
				conn.Close(websocket.StatusInternalError, err.Error())
				return
			}

			err = conn.Write(ctx.R().Context(), websocket.MessageText, data)
			if err != nil {
				ctx.AddInteralMessage(err)
				conn.CloseNow()
			}
		}
	}()

	conn.Read(ctx.R().Context())
}

func wsServerConsole(ctx *nix.Context) {
	ctx.DisableErrorCapture()

	user, err := trustUser(ctx)
	if err != nil {
		handleTrustUserResult(ctx, err)
	}

	srvName := ctx.R().PathValue("server")

	MC.mutex.RLock()
	srv, ok := MC.Servers[srvName]
	MC.mutex.RUnlock()

	if !ok {
		ctx.Error(http.StatusBadRequest, fmt.Sprintf("Server %s not found", srvName))
		return
	}

	srv.m.RLock()
	log := srv.log
	serverLog := srv.serverLog
	userLog := srv.userLog
	srv.m.RUnlock()

	if log == nil {
		ctx.Error(http.StatusBadRequest, fmt.Sprintf("Server %s was never started", srvName))
		return
	}

	// Questo permette al client prima di inviare una richiesta http normale e vedere se ci può
	// essere qualche errore, quindi in caso di richiesta valida allora aprirà la connessione
	// websocket vera
	if !ctx.IsWebSocketRequest() {
		return
	}

	conn, err := websocket.Accept(ctx, ctx.R(), nil)
	if err != nil {
		ctx.Error(http.StatusBadRequest, "Invalid Request", err)
	}
	defer conn.CloseNow()

	prevLogsN, ch := log.ListenForLogs(20)
	defer ch.Unregister()
	prevLogs := log.GetLogs(0, prevLogsN)

	for _, log := range prevLogs {
		err := conn.Write(ctx.R().Context(), websocket.MessageText, log.JSON())
		if err != nil {
			ctx.AddInteralMessage(fmt.Sprintf("websocket: write error: %v", err))
			return
		}
	}

	var wg sync.WaitGroup
	wg.Add(2)
	exitC := make(chan struct{})
	defer close(exitC)

	go func() {
		defer wg.Done()

		for {
			_, b, err := conn.Read(ctx.R().Context())
			if err != nil {
				// Not handling error, for 99% of the cases, this is fine
				exitC <- struct{}{}
				return
			}

			cmd := string(b)

			userLog.Printf(logger.LOG_LEVEL_WARNING, "User %s sent command: <%s>", user.Username, cmd)
			err = srv.SendInput(cmd)
			if err != nil {
				serverLog.Printf(logger.LOG_LEVEL_ERROR, "User %s sent command <%s> but an error occurred: %v", user.user.Name, cmd, err)
			}
		}
	}()

	go func() {
		defer wg.Done()

		logCh := ch.Ch()
	loop:
		for {
			select {
			case log, ok := <- logCh:
				if !ok {
					break loop
				}

				err := conn.Write(ctx.R().Context(), websocket.MessageText, log.JSON())
				if err != nil {
					conn.CloseNow()
					ctx.AddInteralMessage(fmt.Sprintf("websocket: write error: %v", err))
					return
				}
			case <- exitC:
				break loop
			}
		}
	}()

	wg.Wait()
	conn.Close(websocket.StatusNormalClosure, "")
}
