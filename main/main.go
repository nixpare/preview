package main

import (
	"craft"
	"log"
	"os"
	"os/signal"

	"github.com/nixpare/server/v3"
	"github.com/nixpare/server/v3/commands"
)

func main() {
	router := server.NewRouter(nil)

	srv, err := router.NewHTTPServer("", 8080)
	if err != nil {
		log.Fatalln(err)
	}

	ln := newChanListener()
	cmdServer, err := newCommandServer(ln, router.Logger.Clone(nil, true, "commands"), router)
	if err != nil {
		log.Fatalln(err)
	}

	err = craft.CraftInit(router, []*commands.CommandServer{cmdServer})
	if err != nil {
		log.Fatalln(err)
	}
	srv.Handler = craft.Nixcraft()

	router.Start()
	defer router.Stop()

	go cmdServer.ListenAndServe()
	defer cmdServer.Shutdown()

	go sendCmdsOverStdin(ln)

	exitC := make(chan os.Signal, 10)
	signal.Notify(exitC, os.Interrupt)

	<- exitC
}