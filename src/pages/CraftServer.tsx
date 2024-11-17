import '../assets/css/CraftServer.css'

import { Button } from "@mui/material";
import axios, { AxiosError, AxiosResponse } from "axios";
import { Updater, useImmer } from "use-immer";
import { useEffect, useState } from "react";

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
    const [serverStarted, setServerStarted] = useState(serverInfo.running);

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
        getServer();

        const interval = setInterval(() => getServer(), 2000);

        return () => {
            clearInterval(interval);
        }

    }, [serverStarted, serverName]);

    return (
        <>
            <h1>Server</h1>
            <Button onClick={backToList}>Back</Button>
            <h2>{serverName}</h2>
            <p>{serverInfo.running ? 'Online' : 'Offline'}</p>
            {serverInfo.running && <p>Online Players: {serverInfo.players.length}</p>}
            <Button onClick={startServer} disabled={serverInfo.running}>Start Server</Button>
            <Button onClick={stopServer} disabled={!serverInfo.running}>Stop Server</Button>
            <ServerLogs serverName={serverName} onMessage={onMessage} />
        </>
    )
}

type ServerLogsProps = {
    serverName: string;
    onMessage: (message: string) => void;
}

function ServerLogs({ serverName, onMessage }: ServerLogsProps) {
    const [connected, setConnected] = useState(false)
    const [logs, updateLogs] = useImmer([] as any[]);

    useEffect(() => {
        if (connected)
            return
        setConnected(true)

        console.log('new ws')
        
        updateLogs((logs) => {
            logs.length = 0
        })
        queryServerLogs({ serverName, onMessage }, setConnected, updateLogs)
    }, [connected]);

    useEffect(() => {
        console.log(logs.length)
    }, [logs])
    
    return (
        <div className="server-logs">
            <ul>
                {logs.map((log, logIdx) => {
                    return (
                        <p key={logIdx}>{log.message}</p>
                    )
                })}
            </ul>
        </div>
    );
}

async function queryServerLogs(
    { serverName, onMessage }: ServerLogsProps,
    setConnected: (connected: boolean) => void,
    updateLogs: Updater<any[]>
) {
    const url = `/ws/${serverName}/console`;

    const response = await axios.get(url)
        .catch(err => {
            onMessage(err.response.data);
        });

    if (response == undefined)
        return;

    const ws = new WebSocket(url)
    ws.onclose = () => {
        setConnected(false)
    }
    ws.onmessage = (ev) => {
        updateLogs(logs => {
            logs.push(JSON.parse(ev.data))
        })
    }
    ws.onerror = () => {
        onMessage('Server connection error')
    }
}
