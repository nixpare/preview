import './ServerLogs.css'
import './ServerChat.css'

import { useEffect, useState, MouseEvent, useRef } from "react";
import SendCommand from './SendCommand';
import { ChatMessage, ParsedLog } from '../models/Logs';
import { User } from '../models/User';
import axios from 'axios';

type ServerChatProps = {
    serverName: string;
    chat: ChatMessage[];
    show: boolean;
    showMessage: (message: string) => void;
}

export default function ServerChat({ serverName, chat, show, showMessage }: ServerChatProps) {
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

    const sendMessage = async (message: string) => {
        const response = await axios.post(`/${serverName}/message`, message)
            .catch((error) => {
                showMessage(error.message);
            });

        if (!response) return;

        if (response.status >= 400)
            showMessage(response.data);
    }

    const sendBroadcast = async (message: string) => {
        const response = await axios.post(`/${serverName}/broadcast`, message)
            .catch((error) => {
                showMessage(error.message);
            });

        if (!response) return;

        if (response.status >= 400)
            showMessage(response.data);
    }
    
    return (
        <div className="server-chat" style={!show ? { display: 'none'} : undefined}>
            <div className="send-broadcast">
                <SendCommand label="Broadcast Message" sendFunc={sendBroadcast} />
            </div>
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
            <div className="send-message">
                <SendCommand label="Message" sendFunc={sendMessage} />
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

export function parseChatMessage(user: User, log: ParsedLog, chat: ChatMessage[], players: User[]) {
    let message = log.message
    if (log.tags?.includes('chat')){
        message = message.slice(message.indexOf('\n')+1)
    }
    
    if (!message.trim().startsWith('<'))
        return

    let from = message.slice(1, message.indexOf('>'))
    message = message.slice(message.indexOf('>') + 2, message.length);

    if (players.filter(user => user.name == from).length == 0)
        // if an online player is not found it is NOT a message
        return

    if (from == user.name) {
        from = 'You'
    }

    chat.push({
        id: log.id, date: log.date,
        from: from, message: message
    });
}
