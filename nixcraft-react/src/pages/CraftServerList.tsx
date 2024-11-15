import axios, { AxiosError, AxiosResponse } from "axios"
import { useEffect, useState } from "react";

export type ServerListProps = {
  onMessage: (message: string) => void
}

export default function CraftServerList({onMessage}: ServerListProps) {
  const [servers, setServers] = useState([]);

  useEffect(() => {
      axios.get('/servers')
      .then((response: AxiosResponse) => {
        setServers(response.data);
        console.log(response);
      })
      .catch((error: AxiosError) => {
        onMessage(`${error.message}`);
      });
  }, []);

  return (
    <>
      <h1>Server List</h1>
      <ul>
        {servers?.map((server: any) => (
          <li key={server.id}>{server.name}</li>
        ))}
      </ul>
    </>
  )
}