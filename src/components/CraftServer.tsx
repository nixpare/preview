import './CraftServer.css'

import ServerLogs from './ServerLogs';
import UserContext from "../contexts/userContext";
import { useContext, useState } from "react";
import { Server } from "../models/Server";
import ServerInfo, { ServerOnlineState } from './ServerInfo';

type Section = 'info' | 'logs'

export type ServerProps = {
    closeServer: () => void;
    serverName: string;
    showMessage: (message: string) => void;
}

export default function CraftServer({ closeServer, serverName, showMessage }: ServerProps) {
    const [section, setSection] = useState('info' as Section)
    
    const { user, servers } = useContext(UserContext)
    if (!user || !servers)
        return undefined

    const server: Server | undefined = servers.servers[serverName]
    if (!server)
        return

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
            </div>
            <div className="sections">
                <ServerInfo
                    user={user} server={server}
                    show={section == 'info'}
                    showMessage={showMessage}
                />
                <ServerLogs
                    server={server}
                    show={section == 'logs'}
                    showMessage={showMessage}
                />
            </div>
        </div>
    )
}
