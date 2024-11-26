import axios from "axios";
import { Updater } from "use-immer";
import { Server } from "../models/Server";
import { ChatLog, ParsedLog, ServerLog } from "../models/Logs";
import { User } from "../models/User";

export async function queryServerLogs(
    ws: WebSocket | boolean,
    serverName: string, onMessage: (message: string) => void,
    updateLogs: Updater<any[]>,
    server: Server,
    updateLogsFn: (log: ServerLog, logs: ChatLog[] | ParsedLog[], players: User[]) => void
) {
    const url = `/ws/${serverName}/console`;

    const players = Object.values(server.players ?? {});

    const response = await axios.get(url)
        .catch(err => {
            onMessage(err.response.data);
        });

    if (response == undefined) {
        ws = false
        return
    }

    ws = new WebSocket(url)
    ws.onopen = () => {
        updateLogs((logs) => {
            // settare length a 0 è più efficiente e non fa arrabbiare il compilatore
            logs.length = 0
        });
    }
    ws.onclose = () => {
        ws = false
    }
    ws.onmessage = (ev) => {
        updateLogs(logs => {
            const log = JSON.parse(ev.data)
            updateLogsFn(log, logs, players)
        })
    }
    ws.onerror = () => {
        onMessage('Server connection error')
    }
}

export function wsIsActive(ws: WebSocket | boolean): ws is WebSocket {
    // @ts-ignore
    return ws && ws.close
}