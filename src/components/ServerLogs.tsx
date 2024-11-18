import { Updater, useImmer } from "use-immer";
import { useEffect, useState } from "react";
import axios from 'axios';

type ServerLogsProps = {
    serverName: string;
    serverStarted: boolean;
    onMessage: (message: string) => void;
}

export default function ServerLogs({ serverName, serverStarted, onMessage }: ServerLogsProps) {
    const [ws, setWs] = useState(undefined as WebSocket | undefined)
    const [logs, updateLogs] = useImmer([] as any[]);

    useEffect(() => {
        if (ws != undefined && !serverStarted) {
            ws.close()
            return
        }

        if (ws == undefined && !serverStarted)
            return

        if (ws != undefined)
            return

        queryServerLogs(serverName, onMessage, setWs, updateLogs);
    }, [serverStarted]);
    
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
    serverName: string, onMessage: (message: string) => void,
    setWs: (ws: WebSocket | undefined) => void,
    updateLogs: Updater<any[]>
) {
    const url = `/ws/${serverName}/console`;

    const response = await axios.get(url)
        .catch(err => {
            onMessage(err.response.data);
        });

    if (response == undefined)
        return undefined;

    const ws = new WebSocket(url)

    ws.onopen = () => {
        updateLogs((logs) => {
            // settare length a 0 è più efficiente e non fa arrabbiare il compilatore
            logs.length = 0
        });
    }
    ws.onclose = () => {
        setWs(undefined)
    }
    ws.onmessage = (ev) => {
        updateLogs(logs => {
            logs.push(JSON.parse(ev.data))
        })
    }
    ws.onerror = () => {
        onMessage('Server connection error')
    }

    setWs(ws)
}