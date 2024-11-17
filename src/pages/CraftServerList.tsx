import { Button } from "@mui/material";
import axios, { AxiosResponse } from "axios"
import { useEffect, useState } from "react";
import { ServerInfo } from './CraftServer';

export type ServerListProps = {
  onMessage: (message: string) => void,
  onShowDetails: (serverName: string) => void
}

interface AxiosResponseServerList extends AxiosResponse{
  data: ServerInfo[];
}

export default function CraftServerList({onMessage, onShowDetails}: ServerListProps) {
  const [servers, setServers] = useState([] as ServerInfo[]);

  const getServers = async () => {
    const response = await axios.get('/servers') as AxiosResponseServerList;

    if (response.status !== 200) {
      onMessage(response.statusText);
      return;
    }

    const serverList = response.data.map((server: ServerInfo) => {
      if (!server.players) {
        server.players = [];
      }
      return server;
    });

    setServers(serverList);
  }

  useEffect(() => {
      getServers();

      const interval = setInterval(() => getServers(), 2000);

      return () => {
        clearInterval(interval);
      }
  }, []);

  return (
    <>
      <h1>Server List</h1>
      <ul>
        {servers?.map((server: ServerInfo) => {
          const onlineState = server.running ? 'Online' : 'Offline';
          const playerCount = server.running ? `- Players: ${server.players.length}` : undefined;

          const handleClick = () => {
            onShowDetails(server.name);
          }

          return (
            <li key={server.name}>{server.name} - {onlineState} {playerCount} <Button onClick={handleClick}>Show</Button></li>
          )
        })}
      </ul>
    </>
  )
}