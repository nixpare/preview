import { Button } from "@mui/material";
import { useContext } from "react";
import UserContext from "../contexts/userContext";

export type ServerListProps = {
  onShowDetails: (serverName: string) => void
}

export default function CraftServerList({ onShowDetails }: ServerListProps) {
  const { user, servers } = useContext(UserContext)

  if (!user || !servers)
    return undefined

  return (
    <>
      <h1>Server List</h1>
      <ul>
        {servers.servers && Object.values(servers.servers).map(server => {
          const onlineState = server.running ? 'Online' : 'Offline';
          const playerCount = server.running ? `- Players: ${server.players?.length ?? 0}` : undefined;

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