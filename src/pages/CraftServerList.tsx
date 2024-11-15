import axios, { AxiosError, AxiosResponse } from "axios"
import { useEffect, useState } from "react";

type ServerListProps = {
  onMessage: (message: string) => void
}

export default function CraftServerList({onMessage}: ServerListProps) {
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

          return (
            <li key={server.name}>{server.name} - {onlineState} {playerCount}</li>
          )
        })}
      </ul>
    </>
  )
}