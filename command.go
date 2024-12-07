package craft

import (
	"fmt"
	"strings"

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
			srv, ok := msm.Servers[name]
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
			srv, ok := msm.Servers[name]
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
			srv, ok := msm.Servers[name]
			if !ok {
				err = fmt.Errorf("server %s not found", name)
				break
			}

			err = srv.Connect(sc)
		case "status":
			err = mcStatus(msm, sc)
		case "react":
			forwardToReact = true
			err = sc.WriteOutput("Now redirecting to react")
		case "static":
			forwardToReact = false
			err = sc.WriteOutput("Now serving static content")
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

func mcStatus(msm *McServerManager, sc *commands.ServerConn) error {
	msm.mutex.RLock()
	defer msm.mutex.RUnlock()

	sb := strings.Builder{}
	sb.WriteString("\nNixcraft Server Status:\n")

	sb.WriteString("\nInstalled servers: [ ")
	for srvName := range msm.Servers {
		sb.WriteString("\n        ")
		sb.WriteString(srvName)
	}
	if len(msm.Servers) != 0 {
		sb.WriteString("\n")
	}
	sb.WriteString("]\n")

	for srvName, srv := range msm.Servers {
		sb.WriteString("\n  - ")
		sb.WriteString(srvName)

		if !srv.IsRunning() {
			sb.WriteString("        Offline\n")
			continue
		}
		sb.WriteString("        Online\n")

		srv.mutex.RLock()

		sb.WriteString("\nOnline Players: [ ")
		for _, p := range srv.Players {
			sb.WriteString("\n            ")
			sb.WriteString(p.Name)
		}
		if len(srv.Players) != 0 {
			sb.WriteString("\n")
		}
		sb.WriteString("]\n")

		srv.mutex.RUnlock()
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
        - start   <server_name> : starts the named server
        - stop    <server_name> : stop the running server
        - kill    <server_name> : kills the running server

        - connect <server_name>         : attaches the terminal to the server process, end with CTRL-C
        - send    <server_name> <input> : sends the provided input to the running server

        - reload : reloads the servers list from the install directory
        - status : prints the servers status
        - react  : enable the redirection to vite server
        - static : serve static content, disabling the redirect to vite server
`
}
