import '../assets/css/CraftServer.css'

import { Button } from "@mui/material";
import axios, { AxiosError, AxiosResponse } from "axios";
import { useEffect, useState } from "react";
import ServerLogs from '../components/ServerLogs';

export type ServerProps = {
    backToList: () => void;
    serverName: string;
    onMessage: (message: string) => void;
}

export type ServerInfo = {
    running: boolean;
    players: string[];
    name: string;
}

interface AxiosResponseServer extends AxiosResponse{
    data: ServerInfo;
}

export default function CraftServer({backToList, serverName, onMessage}: ServerProps) {
    const [serverInfo, setServerInfo] = useState({name: serverName} as ServerInfo);
    const [serverStarted, setServerStarted] = useState(serverInfo.running ?? false);

    const startServer = async () => {
        const response = await axios.post(`/${serverName}/start`);

        if (response.status === 200) {
            onMessage('Server started');
            setServerStarted(true);
        } else {
            onMessage('Server failed to start');
        }
    }

    const stopServer = async () => {
        const response = await axios.post(`/${serverName}/stop`);

        if (response.status === 200) {
            onMessage('Server stopped');
            setServerStarted(false);
        } else {
            onMessage('Server failed to stop');
        }
    }

    const getServer = async () => {
        const response = await axios.get(`/${serverName}/status`)
            .catch((err: AxiosError) => {
                if (!err.response) {
                    onMessage('Connection Error');
                    return
                }

                onMessage(err.response.data as string || err.response.statusText);
            }) as AxiosResponseServer;

        if (response == undefined)
            return;

        if (!response.data.players) {
            response.data.players = [];
        }

        setServerInfo(response.data);
    }

    useEffect(() => {
        setServerStarted(serverInfo.running);
    }, [serverInfo])

    useEffect(() => {
        getServer();

        const interval = setInterval(() => getServer(), 2000);

        return () => {
            clearInterval(interval);
        }

    }, [serverStarted, serverName]);

    return (
        <>
            <h1>Server {serverName}</h1>
            <Button onClick={backToList}>Back</Button>
            <p>{serverInfo.running ? 'Online' : 'Offline'}</p>
            {serverInfo.running && <p>Online Players: {serverInfo.players.length}</p>}
            <Button onClick={startServer} disabled={serverInfo.running}>Start Server</Button>
            <Button onClick={stopServer} disabled={!serverInfo.running}>Stop Server</Button>
            <ServerLogs serverName={serverName} serverStarted={serverStarted} onMessage={onMessage} />
        </>
    )
}
