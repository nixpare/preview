import '../assets/css/CraftServerList.css'

import { useContext } from "react";
import UserContext from "../contexts/userContext";
import { ServerOnlineState } from './CraftServer';

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
        const showServer = () => {
          setCurrentServer(server.name);
        }

        return (
          <li key={server.name} className="server-entry" onClick={showServer}>
            <div>
              <div className="server-name">
                {server.name}
              </div>
              <div className="server-type">
                Vanilla
              </div>
              <ServerOnlineState server={server} />
            </div>
            <i className="fa-solid fa-chevron-right"></i>
          </li>
        )
      })}
    </ul>
  )
}