import './CraftServer.css'

import ServerLogs, { parseLog } from './ServerLogs';
import { useEffect, useState } from "react";
import { PublicServer } from "../../models/Server";
import ServerInfo, { ServerOnlineState, ServerType } from './ServerInfo';
import ServerChat, { parseChatMessage } from './ServerChat';
import { Updater, useImmer } from 'use-immer';
import { Logs } from '../../models/Logs';
import { User } from '../../models/User';
import axios from 'axios';
import { wsCleanup, wsIsActive } from '../../utils/websocket';

type Section = 'info' | 'chat' | 'logs'

export type ServerProps = {
    user: User;
    server: PublicServer;
    serverName: string;
    closeServer: () => void;
    showMessage: (message: string) => void;
}

export default function CraftServer({ user, server, serverName, closeServer, showMessage }: ServerProps) {
    const [section, setSection] = useState('info' as Section)

    const [logs, updateLogs] = useImmer<Logs>({
        rawLogs: [],
        chat: [],
    })

    useEffect(() => {
        updateLogs(logs => {
            logs.rawLogs.length = 0
            logs.chat.length = 0
        })
    }, [serverName])

    useEffect(() => {
        const callback = () => {
            if (!wsIsActive(logsWS[server.name]))
                return

            const ws = logsWS[server.name]
            logsWS[server.name] = false
            wsCleanup(ws)
        }

        if (logsWS[server.name])
            return callback

        logsWS[server.name] = true
        queryServerLogs(
            server.name, user,
            updateLogs, showMessage
        );

        return callback
    }, [server.name, server.running]);

    return (
        <div className="selected-server">
            <div>
                <div className="server-title">
                    <h1>{server.name}</h1>
                    <a href={`/map/${serverName}`} target='_self'><i className="fa-solid fa-map"></i></a>
                </div>
                <ServerType server={server} />
            </div>


            <button className="close-button" onClick={closeServer}>
                <i className="fa-solid fa-xmark"></i>
            </button>
            <ServerOnlineState server={server} />
            <div className="sections-selector">
                <div
                    className={section == 'info' ? 'selected' : undefined}
                    onClick={() => setSection('info')}
                >
                    Info
                </div>
                <div
                    className={section == 'chat' ? 'selected' : undefined}
                    onClick={() => setSection('chat')}
                >
                    Chat
                </div>
                <div
                    className={section == 'logs' ? 'selected' : undefined}
                    onClick={() => setSection('logs')}
                >
                    Logs
                </div>
            </div>
            <div className="sections">
                <ServerInfo
                    user={user} server={server}
                    show={section == 'info'}
                    showMessage={showMessage}
                />
                <ServerChat
                    serverName={serverName}
                    chat={logs.chat}
                    show={section == 'chat'}
                    showMessage={showMessage}
                />
                <ServerLogs
                    serverName={serverName}
                    logs={logs.rawLogs}
                    show={section == 'logs'}
                    showMessage={showMessage}
                />
            </div>
        </div>
    )
}

let logsWS: Record<string, WebSocket | boolean> = {}

async function queryServerLogs(
    serverName: string, user: User,
    updateLogs: Updater<Logs>, showMessage: (message: string) => void
) {
    const url = `/ws/${serverName}/console`;

    const response = await axios.get(url)
        .catch(err => {
            showMessage(err.response.data);
        });

    if (response == undefined) {
        logsWS[serverName] = false
        return
    }

    const ws = new WebSocket(url)
    logsWS[serverName] = ws

    ws.onopen = () => {
        updateLogs((logs) => {
            // settare length a 0 è più efficiente e non fa arrabbiare il compilatore
            logs.rawLogs.length = 0
            logs.chat.length = 0
        });
    }
    ws.onmessage = (ev) => {
        updateLogs(logs => {
            const log = JSON.parse(ev.data)
            const parsed = parseLog(log, logs.rawLogs)
            parseChatMessage(user, parsed, logs.chat)
        })
    }
    ws.onerror = () => {
        showMessage('Server logs connection error')
    }
}

export function getLogsWS(serverName: string): WebSocket | null {
    const ws = logsWS[serverName]
    if (wsIsActive(ws)) {
        return ws
    } else {
        return null
    }
}
