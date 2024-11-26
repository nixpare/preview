import './ServerLogs.css'

import { useEffect, useState, MouseEvent, useRef, useContext } from "react";
import SendCommand from './SendCommand';
import { ChatMessage, ParsedLog } from '../models/Logs';
import { User } from '../models/User';
import { getWS } from './CraftServer';
import UserContext from '../contexts/userContext';

type ServerChatProps = {
    chat: ChatMessage[];
    show: boolean;
    showMessage: (message: string) => void;
}

export default function ServerChat({ chat, show, showMessage }: ServerChatProps) {
    const { user } = useContext(UserContext);
    const serverChatEl = useRef<HTMLDivElement>(null);
    const [scrollAtBottom, setScrollAtBottom] = useState(false)

    useEffect(() => {
        if (!scrollAtBottom)
            return
        
        serverChatEl.current?.scroll({ top: serverChatEl.current.scrollHeight, behavior: 'smooth' })
        setScrollAtBottom(true)
    }, [chat])

    const onScroll = (ev: React.UIEvent<HTMLDivElement>) => {
        if (ev.currentTarget.scrollTop + ev.currentTarget.clientHeight < ev.currentTarget.scrollHeight) {
            setScrollAtBottom(false)
        } else {
            setScrollAtBottom(true)
        }
    }

    const send = (message: string) => {
        const ws = getWS()
        if (!ws) {
            showMessage('Could not send command to server')
            return
        }

        ws.send(`/tellraw @p "<${user?.name}> ${message}"`)
    }
    
    return (
        <div style={!show ? { display: 'none'} : undefined}>
            <SendCommand label="Message" sendFunc={send} />
            <div className="server-logs" onScroll={onScroll} ref={serverChatEl}>
                <table>
                    <thead>
                        <tr>
                            <th scope="col">TIME</th>
                            <th scope="col">FROM</th>
                            <th scope="col">LOG</th>
                        </tr>
                    </thead>
                    <tbody>
                        {chat.map(message => (
                            <Message key={message.id} message={message} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Message({ message }: { message: ChatMessage }) {
    const multiline = message.message.includes('\n') ? 'multiline' : ''

    const [showing, setShowing] = useState(false)
    const toggleShowing = (ev: MouseEvent) => {
        ev.preventDefault()
        setShowing(!showing)
    }

    return <tr>
        <td>{message.date}</td>
        <td>{message.from}</td>
        <td>
            <div className={`log-message ${multiline} ${showing ? 'show' : ''}`} onClick={toggleShowing}>
                <div className="message">
                    {message.message}
                </div>
                <div className="expand">
                    <i className="fa-solid fa-chevron-right"></i>
                </div>
            </div>
        </td>
    </tr>
}

export function parseChatMessage(log: ParsedLog, chat: ChatMessage[], players: User[]) {
    let message = log.message
    
    if (message.trim().startsWith('<')) {
        const from = message.slice(1, message.indexOf('>'))
        message = message.slice(message.indexOf('>') + 2, message.length);

        chat.push({
            id: log.id, date: log.date,
            from: from, message: message
        });
        return;

        for (const player of players) {
            if (from === player.name) {
                chat.push({
                    id: log.id, date: log.date,
                    from: from, message: message
                });
                return;
            }
        }

        // if an online player is not found it is NOT a message
    }
}
