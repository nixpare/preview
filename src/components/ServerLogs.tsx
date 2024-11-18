import '../assets/css/ServerLogs.css'

import { Updater, useImmer } from "use-immer";
import { useEffect, useState } from "react";
import axios from 'axios';

type ServerLogsProps = {
    serverName: string;
    serverStarted: boolean;
    onMessage: (message: string) => void;
}

type ServerLog = {
    id: string
    level: string
    date: string
    message: string
    extra: string
    tags: string[]
}

type Log = {
    id: string
    date: string
    from: string
    level: string
    levelColor: string
    message: string
}

export default function ServerLogs({ serverName, serverStarted, onMessage }: ServerLogsProps) {
    const [ws, setWs] = useState(undefined as WebSocket | undefined)
    const [logs, updateLogs] = useImmer([] as Log[]);

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
            <table className="table table-dark table-borderless align-middle text-center text-wrap" style={{whiteSpace: 'pre-wrap'}}>
                <thead>
                    <tr>
                        <th scope="col">TIME</th>
                        <th scope="col">FROM</th>
                        <th scope="col">LEVEL</th>
                        <th scope="col">LOG</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map(log => {
                        const collapsed = log.message.includes('\n') ? 'collapsed' : ''

                        return <tr key={log.id}>
                            <td>{log.date}</td>
                            <td>{log.from}</td>
                            <td style={{ color: log.levelColor }}>{log.level}</td>
                            <td className={`log-message ${collapsed}`}>
                                <div>{log.message}</div>
                            </td>
                        </tr>
                    })}
                </tbody>
            </table>
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
            const log = JSON.parse(ev.data)
            parseLog(log, logs)
        })
    }
    ws.onerror = () => {
        onMessage('Server connection error')
    }

    setWs(ws)
}

function parseLog(log: ServerLog, logs: Log[]) {
    let from: string, level: string, levelColor: string;
    let message = log.message

    const date = new Date(log.date).toLocaleDateString(undefined, {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).replace(', ', '\n')

    let appendToPrevious = false

    if (log.tags.includes('stderr')) {
        from = 'Server'
        level = 'FATAL'
        levelColor = 'hsl(0, 80%, 60%)'
    } else if (log.tags.includes('user')) {
        from = 'NixCraft'
        level = 'USER'
        levelColor = 'hsl(90, 80%, 60%)'
    } else {
        switch (true) {
            case message.indexOf('] ') >= 0 && message.indexOf(']: ') > message.indexOf('] '):
                message = message.substring(message.indexOf('] ') + 2, message.length);
                [from, level] = message.substring(1, message.indexOf(']: ')).split('/', 2)
                message = message.substring(message.indexOf(']: ') + 3, message.length)

                break
            case message.indexOf(']: ') >= 0:
                from = 'Server'
                level = message.substring(1, message.indexOf(']: ')).split(' ', 2)[1]
                message = message.substring(message.indexOf(']: ') + 3, message.length)

                break
            default:
                from = 'Server'
                level = ''
                appendToPrevious = true
                break
        }

        switch (level) {
            case 'INFO':
                levelColor = 'hsl(190, 80%, 60%)'
                break
            case 'WARN':
                levelColor = 'hsl(20, 80%, 60%)'
                break
            case 'ERROR':
                levelColor = 'hsl(0, 80%, 60%)'
                break
            default:
                levelColor = ''
        }
    }

    if (log.extra != '')
        message = message.concat('\n', log.extra)

    if (appendToPrevious && logs[logs.length-1] != undefined) {
        let lastLog = logs[logs.length -1]
        lastLog.message = lastLog.message.concat('\n', message)
        logs[logs.length -1] = lastLog

        return
    }

    logs.push({ id: log.id, date, from, level, levelColor, message }) 
}
