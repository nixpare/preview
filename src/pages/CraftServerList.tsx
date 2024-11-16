import { Button } from "@mui/material";
import axios, { AxiosError, AxiosResponse } from "axios"
import { useEffect, useState } from "react";

export type ServerListProps = {
  onMessage: (message: string) => void,
  onShowDetails: (serverName: string) => void
}

export default function CraftServerList({onMessage, onShowDetails}: ServerListProps) {
  const [servers, setServers] = useState([]);

  useEffect(() => {
      axios.get('/servers')
      .then((response: AxiosResponse) => {
        setServers(response.data);
        console.log(response.data);
      })
      .catch((error: AxiosError) => {
        onMessage(`${error.message}`);
      });
  }, []);

  return (
    <>
      <h1>Server List</h1>
      <ul>
        {servers?.map((server: any) => {
          const onlineState = server.online ? 'Online' : 'Offline'
          const playerCount = server.online ? `- Players: ${server.players.length}` : undefined

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