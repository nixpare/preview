import { Button } from "@mui/material";
import axios from "axios";
import { useEffect, useState } from "react";

export type ServerProps = {
    backToList: () => void;
    serverName: string;
    onMessage: (message: string) => void;
}

export type ServerInfo = {
    online: boolean;
    players: string[];
    name: string;
}

export default function CraftServer({backToList, serverName, onMessage}: ServerProps) {
    const [serverInfo, setServerInfo] = useState({name: serverName} as ServerInfo);

    useEffect(() => {
        axios.get(`/${serverName}/status`)
        .then((response) => {
            setServerInfo(response.data);
        })
        .catch((error) => {
            onMessage(`${error.message}`);
        });
    });

    return (
        <>
            <h1>Server</h1>
            <Button onClick={backToList}>Back</Button>
            <h2>{serverName}</h2>
            <p>{serverInfo.online ? 'Online' : 'Offline'}</p>
            {serverInfo.online && <p>Online Players: {serverInfo.players?.length}</p>}
        </>
    )
}