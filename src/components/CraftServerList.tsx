import './CraftServerList.css'

import { useContext } from "react";
import UserContext from "../contexts/userContext";
import { ServerOnlineState } from './ServerInfo';

export type ServerListProps = {
  aside: boolean
  setCurrentServer: (serverName: string) => void
}

export default function CraftServerList({ aside, setCurrentServer }: ServerListProps) {
  const { user, servers } = useContext(UserContext)

  if (!user || !servers)
    return undefined

  return (
    <div className={`servers-list ${aside ? 'aside' : ''}`}>
      <h3>Servers</h3>
      <ul>
        {servers.servers && Object.values(servers.servers).map(server => {
          const showServer = () => {
            setCurrentServer(server.name);
          }

          return (
            <li key={server.name} className="server-entry" onClick={showServer}>
              <div>
                <div>
                  <div className="server-name">
                    {server.name}
                  </div>
                  <div className="server-type">
                    Vanilla
                  </div>
                </div>
                <ServerOnlineState server={server} />
              </div>
              <i className="fa-solid fa-chevron-right"></i>
            </li>
          )
        })}
      </ul>
    </div>
  )
}