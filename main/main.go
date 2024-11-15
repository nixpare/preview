package main

import (
	"craft"
	"os"
	"os/signal"

	"github.com/nixpare/server/v3"
)

func main() {
	router := server.NewRouter(nil)

	srv, err := router.NewHTTPServer("", 8080)
	if err != nil {
		panic(err)
	}

	err = craft.CraftInit(router, nil)
	if err != nil {
		panic(err)
	}
	srv.Handler = craft.Nixcraft()

	router.Start()
	defer router.Stop()

	exitC := make(chan os.Signal, 10)
	signal.Notify(exitC, os.Interrupt)

	<- exitC
}