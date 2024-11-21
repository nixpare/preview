import '../assets/css/CraftServerList.css'

import { Button } from "@mui/material";
import { useContext } from "react";
import UserContext from "../contexts/userContext";

export type ServerListProps = {
  aside: boolean
  setCurrentServer: (serverName: string) => void
}

export default function CraftServerList({ aside, setCurrentServer }: ServerListProps) {
  const { user, servers } = useContext(UserContext)

  if (!user || !servers)
    return undefined

  return (
    <ul className={`servers-list ${aside ? 'aside' : ''}`}>
      {servers.servers && Object.values(servers.servers).map(server => {
        const handleClick = () => {
          setCurrentServer(server.name);
        }

        return (
          <li key={server.name} className="server-entry">
            <div>
              <div className="server-name">
                {server.name}
              </div>
              <div className="server-type">
                Vanilla
              </div>
              <div className={`server-state ${server.running ? 'online' : ''}`}>
                <i className="server-state-dot"></i>
                <div>{server.running ? 'Online' : 'Offline'}</div>
                {server.running ? <div className="online-players">
                  <i className="fa-solid fa-users"></i>
                  {server.players?.length ?? 0}
                </div> : undefined}
              </div>
            </div>
            <Button onClick={handleClick}>Show</Button>
          </li>
        )
      })}
    </ul>
  )
}