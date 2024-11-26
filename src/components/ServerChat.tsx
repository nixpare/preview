import './ServerLogs.css'

import { useImmer } from "use-immer";
import { useEffect, useState, MouseEvent, useRef, useContext } from "react";
import SendCommand from './SendCommand';
import { Server } from '../models/Server';
import { ChatLog, ServerLog } from '../models/Logs';
import { User } from '../models/User';
import { queryServerLogs, wsIsActive } from '../utils/wsLogs';
import UserContext from '../contexts/userContext';

type ServerLogsProps = {
    serverName: string;
    server: Server;
    show: boolean;
    showMessage: (message: string) => void;
}

let ws = false as WebSocket | boolean;

const setWs = (newWs: WebSocket | boolean) => {
    ws = newWs
}

export default function ServerChat({ serverName, server, show, showMessage }: ServerLogsProps) {
    const [logs, updateLogs] = useImmer([] as ChatLog[]);
    const { user } = useContext(UserContext);

    const serverLogsEl = useRef<HTMLDivElement>(null);
    const [scrollAtBottom, setScrollAtBottom] = useState(false)

    const cleanup = () => {
        wsIsActive(ws) && ws.close()
    }

    useEffect(() => {
        updateLogs(logs => {
            logs.length = 0
        })
    }, [serverName])

    useEffect(() => {
        cleanup()

        if ((ws && !wsIsActive(ws)))
            return cleanup

        setWs(true)
        queryServerLogs(setWs, server.name, showMessage, updateLogs, server, getChatMessage);

        return cleanup
    }, [server]);

    useEffect(() => {
        if (!scrollAtBottom)
            return
        
        serverLogsEl.current?.scroll({ top: serverLogsEl.current.scrollHeight, behavior: 'smooth' })
        setScrollAtBottom(true)
    }, [logs])

    const onLogsScroll = (ev: React.UIEvent<HTMLDivElement>) => {
        if (ev.currentTarget.scrollTop + ev.currentTarget.clientHeight < ev.currentTarget.scrollHeight) {
            setScrollAtBottom(false)
        } else {
            setScrollAtBottom(true)
        }
    }

    const send = (message: string) => {
        if (!wsIsActive(ws)) {
            showMessage('Could not send message to server')
            return
        }

        let cmd = `/tellraw @p "<${user?.name}> ${message}"`;

        updateLogs(logs => {
            logs.push({
                id: logs.length.toString(), date: new Date().toLocaleDateString(),
                from: user?.name || 'You', message
            });
        });

        ws.send(cmd)
    }
    
    return (
        <div style={!show ? { display: 'none'} : undefined}>
            <SendCommand label="Message" sendFunc={send}/>
            <div className="server-logs" onScroll={onLogsScroll} ref={serverLogsEl}>
                <table>
                    <thead>
                        <tr>
                            <th scope="col">TIME</th>
                            <th scope="col">FROM</th>
                            <th scope="col">LOG</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <Log key={log.id} log={log} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Log({ log }: { log: ChatLog }) {
    const multiline = log.message.includes('\n') ? 'multiline' : ''

    const [showing, setShowing] = useState(false)
    const toggleShowing = (ev: MouseEvent) => {
        ev.preventDefault()
        setShowing(!showing)
    }

    return <tr>
        <td>{log.date}</td>
        <td>{log.from}</td>
        <td>
            <div className={`log-message ${multiline} ${showing ? 'show' : ''}`} onClick={toggleShowing}>
                <div className="message">
                    {log.message}
                </div>
                <div className="expand">
                    <i className="fa-solid fa-chevron-right"></i>
                </div>
            </div>
        </td>
    </tr>
}

function getChatMessage(log: ServerLog, logs: ChatLog[], players: User[]) {
    let message = log.message

    const date = new Date(log.date).toLocaleDateString(undefined, {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).replace(', ', '\n')

    switch (true) {
        case message.indexOf('] ') >= 0 && message.indexOf(']: ') > message.indexOf('] '):
            message = message.substring(message.indexOf('] ') + 2, message.length); // first I remove the date/time
            message = message.substring(message.indexOf(']: ') + 3, message.length) // then I remove the sender
            break
        case message.indexOf(']: ') >= 0:
            message = message.substring(message.indexOf(']: ') + 3, message.length)
    }

    if (message.trim().startsWith('<')) {
        const from = message.slice(1, message.indexOf('>'))

        message = message.slice(message.indexOf('>') + 2, message.length);

        for (const player of players) {
            if (from === player.name) {
                logs.push({
                    id: log.id, date: date,
                    from, message: message
                });
                return;
            }
        }

        // if an online player is not found it is NOT a message
    }
}
