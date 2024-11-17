import { Updater, useImmer } from "use-immer";
import { useCallback, useEffect, useState } from "react";
import axios from 'axios';

type ServerLogsProps = {
    serverName: string;
    onMessage: (message: string) => void;
}

export default function ServerLogs({ serverName, onMessage }: ServerLogsProps) {
    const [connected, setConnected] = useState(false)
    const [logs, updateLogs] = useImmer([] as any[]);

    useEffect(() => {
        if (connected) return

        console.log('new ws')
        
        updateLogs((logs) => {
            logs = []
        });
        setConnected(true);

        queryServerLogs({ serverName, onMessage }, setConnected, updateLogs);
    }, [serverName]);
    
    return (
        <div className="server-logs">
            <ul>
                {connected && logs.map((log, logIdx) => {
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