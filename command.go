package craft

import (
	"fmt"
	"strings"
	"time"

	"github.com/nixpare/server/v3/commands"
)

func mcCommand(msm *McServerManager) commands.ServerCommandHandler {
	return func(sc *commands.ServerConn, args ...string) (exitCode int, err error) {
		if len(args) == 0 {
			err = sc.WriteOutput(help(""))
			if err != nil {
				exitCode = 1
			}
			return
		}

		switch args[0] {
		case "reload":
			err = msm.loadServers()
			if err == nil {
				err = sc.WriteOutput("Servers reloaded!")
			}
		case "start":
			name := args[1]
			err = msm.Start(name)
			if err == nil {
				err = sc.WriteOutput("Server " + name + " started!")
			}
		case "stop":
			name := args[1]
			err = msm.Stop(name)
			if err == nil {
				err = sc.WriteOutput("Server stopped!")
			}
		case "kill":
			name := args[1]
			srv, ok := msm.servers[name]
			if !ok {
				err = fmt.Errorf("server %s not found", name)
				break
			}

			err = srv.process.Kill()
			if err == nil {
				err = sc.WriteOutput("Server killed!")
			}
		case "send":
			name := args[1]
			srv, ok := msm.servers[name]
			if !ok {
				err = fmt.Errorf("server %s not found", name)
				break
			}

			err = srv.SendInput(strings.Join(args[2:], " "))
			if err == nil {
				err = sc.WriteOutput("Sent!")
			}
		case "connect":
			name := args[1]
			srv, ok := msm.servers[name]
			if !ok {
				err = fmt.Errorf("server %s not found", name)
				break
			}

			err = srv.Connect(sc)
		case "status":
			err = mcStatus(msm, sc)
		case "help":
			err = sc.WriteOutput(help(""))
		default:
			return 1, sc.WriteError(help(fmt.Sprintf("unknown command: %s", args[0])))
		}

		if err != nil {
			return 1, sc.WriteError(err.Error())
		}

		return
	}
}

func taskCheckUsers(msm *McServerManager, alreadyOffline *bool) error {
	msm.mutex.Lock()
	defer msm.mutex.Unlock()

	now := time.Now()
	for _, srv := range msm.servers {
		var playing bool

		for userName, user := range msm.users {
			if user.server != srv {
				continue
			}

			if now.After(user.t.Add(time.Minute * 10)) {
				defer func(key string, value *McUser) {
					delete(msm.users, key)
					if value.conn != nil {
						value.conn.Close()
					}
				}(userName, user)
			} else if user.conn != nil {
				playing = true
			}
		}

		if !playing && srv.IsRunning() {
			if *alreadyOffline {
				*alreadyOffline = false
				return srv.Stop(true)
			} else {
				*alreadyOffline = true
			}
		} else {
			*alreadyOffline = false
		}
	}

	return nil
}

func mcStatus(msm *McServerManager, sc *commands.ServerConn) error {
	sb := strings.Builder{}
	sb.WriteString("\nNixcraft Server Status:\n")

	sb.WriteString("\nInstalled servers: [ ")
	for srvName := range msm.servers {
		sb.WriteString("\n        ")
		sb.WriteString(srvName)
	}
	if len(msm.servers) != 0 {
		sb.WriteString("\n")
	}
	sb.WriteString("]\n")

	for srvName, srv := range msm.servers {
		sb.WriteString("\n  - ")
		sb.WriteString(srvName)

		if !srv.IsRunning() {
			sb.WriteString("        Offline\n")
			continue
		}
		sb.WriteString("        Online\n")

		msm.mutex.RLock()
		players := srv.getOnlinePlayersNoLock()
		msm.mutex.RUnlock()

		sb.WriteString("\nOnline Players: [ ")
		for _, p := range players {
			sb.WriteString("\n            ")
			sb.WriteString(p)
		}
		if len(players) != 0 {
			sb.WriteString("\n")
		}
		sb.WriteString("]\n")
	}

	return sc.WriteOutput(sb.String())
}

func help(errMessage string) string {
	message := "Nixcraft: Minecraft Server platform from Nixpare"
	if errMessage != "" {
		message += "\n    Invalid command: " + errMessage + ""
	}
	return message + `

Usage: mc [ option [ args ... ] ]
    Options:
        - start < server_name > : starts the named server
        - stop                  : stop the running server
        - kill                  : kills the running server
        - connect               : attaches the terminal to the server process, end with CTRL-C
        - send < input >        : sends the provided input to the running server
        - reload                : reloads the server list from the install directory
        - status                : prints the server status
`
}
