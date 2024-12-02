import './CraftServerList.css'

import { ServersInfo } from '../../models/Server';
import { ServerOnlineState } from './ServerInfo';

export type ServerListProps = {
  servers: ServersInfo
  aside: boolean
  setCurrentServer: (serverName: string) => void
}

export default function CraftServerList({ servers, aside, setCurrentServer }: ServerListProps) {
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