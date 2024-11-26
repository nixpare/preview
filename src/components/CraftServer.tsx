import './CraftServer.css'

import ServerLogs, { parseLog } from './ServerLogs';
import UserContext from "../contexts/userContext";
import { useContext, useEffect, useState } from "react";
import { Server } from "../models/Server";
import ServerInfo, { ServerOnlineState } from './ServerInfo';
import ServerChat, { parseChatMessage } from './ServerChat';
import { Updater, useImmer } from 'use-immer';
import { Logs } from '../models/Logs';
import { User } from '../models/User';
import axios from 'axios';

type Section = 'info' | 'logs' | 'chat'

export type ServerProps = {
    closeServer: () => void;
    serverName: string;
    showMessage: (message: string) => void;
}

export default function CraftServer({ closeServer, serverName, showMessage }: ServerProps) {
    const [section, setSection] = useState('info' as Section)

    const [logs, updateLogs] = useImmer<Logs>({
        rawLogs: [],
        chat: [],
    })

    const { user, servers } = useContext(UserContext)
    const server: Server | undefined = servers?.servers[serverName]

    useEffect(() => {
        updateLogs(logs => {
            logs.rawLogs.length = 0
            logs.chat.length = 0
        })
    }, [serverName])

    useEffect(() => {
        if (!server)
            return
        
        cleanup()

        if ((ws && !wsIsActive(ws)))
            return cleanup

        ws = true
        queryServerLogs(
            server.name, Object.values(server.players ?? {}),
            updateLogs, showMessage
        );

        return cleanup
    }, [server]);

    if (!user || !servers || !server)
        return undefined

    return (
        <div className="selected-server">
            <h1>{server.name}</h1>
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
                    className={section == 'logs' ? 'selected' : undefined}
                    onClick={() => setSection('logs')}
                >
                    Logs
                </div>
                <div
                    className={section == 'chat' ? 'selected' : undefined}
                    onClick={() => setSection('chat')}
                >
                    Chat
                </div>
            </div>
            <div className="sections">
                <ServerInfo
                    user={user} server={server}
                    show={section == 'info'}
                    showMessage={showMessage}
                />
                <ServerLogs
                    logs={logs.rawLogs}
                    show={section == 'logs'}
                    showMessage={showMessage}
                />
                <ServerChat
                    chat={logs.chat}
                    show={section == 'chat'}
                    showMessage={showMessage}
                />
            </div>
        </div>
    )
}

let ws = false as WebSocket | boolean

async function queryServerLogs(
    serverName: string, players: User[],
    updateLogs: Updater<Logs>, showMessage: (message: string) => void
) {
    const url = `/ws/${serverName}/console`;

    const response = await axios.get(url)
        .catch(err => {
            showMessage(err.response.data);
        });

    if (response == undefined) {
        ws = false
        return
    }

    ws = new WebSocket(url)
    ws.onopen = () => {
        updateLogs((logs) => {
            // settare length a 0 è più efficiente e non fa arrabbiare il compilatore
            logs.rawLogs.length = 0
            logs.chat.length = 0
        });
    }
    ws.onclose = () => {
        ws = false
    }
    ws.onmessage = (ev) => {
        updateLogs(logs => {
            const log = JSON.parse(ev.data)
            const parsed = parseLog(log, logs.rawLogs)
            parseChatMessage(parsed, logs.chat, players)
        })
    }
    ws.onerror = () => {
        showMessage('Server connection error')
    }
}

function cleanup() {
    wsIsActive(ws) && ws.close()
}

function wsIsActive(ws: WebSocket | boolean): ws is WebSocket {
    // @ts-ignore
    return ws && ws.close
}

export function getWS(): WebSocket | null {
    if (wsIsActive(ws)) {
        return ws
    } else {
        return null
    }
}
