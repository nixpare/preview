package craft

import (
	"encoding/json"
	"maps"
)

func (msm *McServerManager) generateState() []byte {
	msm.mutex.RLock()
	defer msm.mutex.RUnlock()

	data, _ := json.Marshal(msm)
	return data
}

func (msm *McServerManager) SignalStateUpdate() {
	go func() {
		msm.UpdateBroadcaster.Send(msm.generateState())
	}()
}

func (msm *McServerManager) SignalServerUpdateForUsers(srv *McServer) {
	go func() {
		msm.mutex.RLock()
		defer msm.mutex.RUnlock()

		for _, user := range msm.users {
			if user.server == srv {
				user.SignalStateUpdate()
			}
		}
	}()
}

type aliasMcServer McServer

type privateMcServerInfo struct {
	*aliasMcServer
	Running bool     `json:"running"`
	Players []string `json:"players"`
}

func (srv *McServer) generatePrivateState() {
	srv.mutex.RLock()
	players := make([]string, 0, len(srv.Players))
	for p := range maps.Keys(srv.Players) {
		players = append(players, p)
	}
	srv.mutex.RUnlock()

	srv.privateInfo = &privateMcServerInfo{
		aliasMcServer: (*aliasMcServer)(srv),
		Running:       srv.IsRunning(),
		Players:       players,
	}
}

type publicMcServerInfo struct {
	*aliasMcServer
	Running bool `json:"running"`
	Players int  `json:"players"`
}

func (srv *McServer) MarshalJSON() ([]byte, error) {
	publicServer := publicMcServerInfo{
		aliasMcServer: (*aliasMcServer)(srv),
		Running:       srv.IsRunning(),
		Players:       len(srv.Players),
	}

	return json.Marshal(publicServer)
}

func (srv *McServer) SignalStateUpdate() {
	go func() {
		srv.generatePrivateState()

		srv.msm.SignalServerUpdateForUsers(srv)
		srv.msm.SignalStateUpdate()
	}()
}

type aliasMcUser McUser

type jsonMcUser struct {
	*aliasMcUser
	Server *privateMcServerInfo `json:"server"`
}

func (user *McUser) MarshalJSON() ([]byte, error) {
	var privateServer *privateMcServerInfo
	if user.server != nil {
		privateServer = user.server.privateInfo
	}

	userData := jsonMcUser{
		aliasMcUser: (*aliasMcUser)(user),
		Server:      privateServer,
	}

	return json.Marshal(userData)
}

func (user *McUser) generateState() []byte {
	data, _ := json.Marshal(user)
	return data
}

func (user *McUser) SignalStateUpdate() {
	go func() {
		user.updateBroadcaster.Send(user.generateState())
	}()
}
