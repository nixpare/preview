import { Button } from "@mui/material";
import axios, { AxiosError } from "axios";
import ServerLogs from '../components/ServerLogs';
import SendCommand from "../components/SendCommand";
import UserContext from "../contexts/userContext";
import { useContext } from "react";
import { Server } from "../models/Server";

export type ServerProps = {
    backToList: () => void;
    serverName: string;
    onMessage: (message: string) => void;
}

export default function CraftServer({backToList, serverName, onMessage}: ServerProps) {
    const { user, servers } = useContext(UserContext)
    if (!user || !servers)
        return undefined

    const server = servers.servers[serverName] as Server | undefined
    if (!server)
        return undefined
    
    const startServer = async () => {
        const response = await axios.post(`/${serverName}/start`);

        if (response.status === 200) {
            onMessage('Server started');
        } else {
            onMessage('Server failed to start');
        }
    }

    const stopServer = async () => {
        const response = await axios.post(`/${serverName}/stop`);

        if (response.status === 200) {
            onMessage('Server stopped');
        } else {
            onMessage('Server failed to stop');
        }
    }

    const connectToServer = async () => {
        const response = await axios.post(`/${serverName}/connect`)
            .catch((err: AxiosError)=> {
                onMessage(err.message);
        });

        if (response == undefined) return;

        if (response.status >= 400) {
            onMessage('Failed to connect to server');
        } else {
            onMessage('Connected to server');
        }
    }

    return (
        <>
            <h1>Server {serverName}</h1>
            <Button onClick={backToList}>Back</Button>
            <p>{server.running ? 'Online' : 'Offline'}</p>
            {server.running && <p>Online Players: {servers.servers[serverName].players?.length ?? 0}</p>}
            <Button onClick={startServer} disabled={server.running}>Start Server</Button>
            <Button onClick={stopServer} disabled={!server.running}>Stop Server</Button>
            {server.running && <div>
                <Button onClick={connectToServer}>Connect to this Server</Button>
                {user.server == serverName && <>
                    <i className="fa-solid fa-circle-check"></i>
                </>}
            </div>
            }
            <ServerLogs serverName={serverName} serverStarted={server.running} onMessage={onMessage} />
            {server.running && <div>
                <SendCommand cmd="Command" route={`/${serverName}/cmd`} showMessage={onMessage} prefix="/"/>
                <SendCommand cmd="Broadcast Message" route={`/${serverName}/broadcast`} showMessage={onMessage}/>
            </div>}
        </>
    )
}
