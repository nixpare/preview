import '../assets/css/CraftServer.css'

import { Button } from "@mui/material";
import axios, { AxiosError } from "axios";
import ServerLogs from './ServerLogs';
import SendCommand from "./SendCommand";
import UserContext from "../contexts/userContext";
import { useContext } from "react";
import { Server } from "../models/Server";

export type ServerProps = {
    closeServer: () => void;
    serverName: string;
    showMessage: (message: string) => void;
}

export default function CraftServer({ closeServer, serverName, showMessage }: ServerProps) {
    const { user, servers } = useContext(UserContext)
    if (!user || !servers)
        return undefined

    const server = servers.servers[serverName] as Server | undefined
    if (!server)
        return undefined

    const startServer = async () => {
        const response = await axios.post(`/${serverName}/start`);

        if (response.status === 200) {
            showMessage('Server started');
        } else {
            showMessage('Server failed to start');
        }
    }

    const stopServer = async () => {
        const response = await axios.post(`/${serverName}/stop`);

        if (response.status === 200) {
            showMessage('Server stopped');
        } else {
            showMessage('Server failed to stop');
        }
    }

    const connectToServer = async () => {
        const response = await axios.post(`/${serverName}/connect`)
            .catch((err: AxiosError) => {
                showMessage(err.message);
            });

        if (response == undefined) return;

        if (response.status >= 400) {
            showMessage('Failed to connect to server');
        } else {
            showMessage('Connected to server');
        }
    }

    return (
        <div className="selected-server">
            <h1>{serverName}</h1>
            <button className="close-button" onClick={closeServer}>
                <i className="fa-solid fa-xmark"></i>
            </button>
            <ServerOnlineState server={server} />
            <div>
                <Button onClick={startServer} disabled={server.running}>Start Server</Button>
                <Button onClick={stopServer} disabled={!server.running}>Stop Server</Button>
            </div>
            {server.running && <div>
                {user.server != serverName ? <>
                    <Button onClick={connectToServer}>Connect to this Server</Button>
                </> : <>
                    Connected
                    <i className="fa-solid fa-circle-check connected-check"></i>
                </>}
            </div>}
            <ServerLogs serverName={serverName} serverStarted={server.running} onMessage={showMessage} />
            {server.running && <div>
                <SendCommand cmd="Command" route={`/${serverName}/cmd`} showMessage={showMessage} prefix="/" />
                <SendCommand cmd="Broadcast Message" route={`/${serverName}/broadcast`} showMessage={showMessage} />
            </div>}
        </div>
    )
}

export type ServerOnlineStateProps = {
    server: Server
}

export function ServerOnlineState({ server }: ServerOnlineStateProps) {
    return (
        <div className={`server-state ${server.running ? 'online' : ''}`}>
            <i className="server-state-dot"></i>
            <div className="server-state-descr">
                {server.running ? 'Online' : 'Offline'}
            </div>
            {server.running ? <div className="online-players">
                <i className="fa-solid fa-users"></i>
                {server.players?.length ?? 0}
            </div> : undefined}
        </div>
    )
}
