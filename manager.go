package craft

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"

	"github.com/nixpare/broadcaster"
	"github.com/nixpare/logger/v3"
	"github.com/nixpare/process"
)

type McServerManager struct {
	Logger         *logger.Logger       `json:"-"`
	Servers        map[string]*McServer `json:"servers"`
	users          map[string]*McUser
	pingIPToServer map[string]*McServer
	mutex          sync.RWMutex

	UpdateBroadcaster *broadcaster.Broadcaster[[]byte] `json:"-"`
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

		srv.process.Close()
	}
	clear(msm.Servers)

	entries, err := os.ReadDir(mc_servers_path)
	if err != nil {
		return err
	}

	var errs []error
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		dir := mc_servers_path + "/" + e.Name()

		childs, _ := os.ReadDir(dir)
		for _, child := range childs {
			if child.Name() != "nixcraft.json" {
				continue
			}

			filepath := dir + "/" + child.Name()
			data, err := os.ReadFile(filepath)
			if err != nil {
				errs = append(errs, fmt.Errorf("failer reading file %s: %w", filepath, err))
				break
			}

			var serverJSON mcServerInfoFile
			err = json.Unmarshal(data, &serverJSON)
			if err != nil {
				errs = append(errs, fmt.Errorf("failer decoding json %s: %w", filepath, err))
				break
			}

			execName, args, port := mcServerCmd(serverJSON.Jar)
			proc, err := process.NewProcess(dir, execName, args...)
			if err != nil {
				errs = append(errs, fmt.Errorf("failer creating process for %s: %w", serverJSON.Name, err))
				break
			}
			proc.InheritConsole(false)
				
			msm.Servers[e.Name()] = msm.NewMcServer(&serverJSON, proc, port)
			break
		}
	}
	if err = errors.Join(errs...); err != nil {
		return err
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

	msm.SignalStateUpdate()
	return nil
}

func (msm *McServerManager) GetServer(name string) (*McServer, bool) {
	msm.mutex.RLock()
	defer msm.mutex.RUnlock()

	srv, ok := msm.Servers[name]
	return srv, ok
}

func (msm *McServerManager) Start(name string) error {
	srv, ok := msm.GetServer(name)
	if !ok {
		return fmt.Errorf("server %s not found", name)
	}

	err := srv.Start()
	if err != nil {
		return err
	}

	return nil
}

func (msm *McServerManager) Stop(name string) error {
	srv, ok := msm.GetServer(name)
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
	errsChan := make(chan error, len(msm.Servers))
	var wg sync.WaitGroup

	wg.Add(len(msm.Servers))
	for _, srv := range msm.Servers {
		go func() {
			defer wg.Done()
			errsChan <- srv.Stop()
		}()
	}

	wg.Wait()
	close(errsChan)

	for err := range errsChan {
		errs = append(errs, err)
	}

	return errors.Join(errs...)
}

