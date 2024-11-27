import './ServerChat.css'

import { useEffect, useState, useRef } from "react";
import SendCommand from './SendCommand';
import { ChatMessage, ParsedLog } from '../models/Logs';
import { User } from '../models/User';
import axios from 'axios';
import { getProfileImage, ProfileImageType } from '../utils/ProfileImageCache';

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
        <div className="server-chat" style={!show ? { display: 'none' } : undefined}>
            <div className="send-broadcast">
                <SendCommand label="Broadcast Message" sendFunc={sendBroadcast} />
            </div>
            <div className="chat" onScroll={onScroll} ref={serverChatEl}>
                {chat.map(message => (
                    <Message key={message.id} message={message} />
                ))}
            </div>
            <div className="send-message">
                <SendCommand label="Message" sendFunc={sendMessage} />
            </div>
        </div>
    );
}

function Message({ message }: { message: ChatMessage }) {
    const [profilePicture, setProfilePicture] = useState<string | null>(null)
    useEffect(() => {
        getProfileImage(message.from, ProfileImageType.HEADHELM)
            .then(image => {
                setProfilePicture(URL.createObjectURL(image))
            });
    }, []);
    
    let date = message.date.slice(message.date.indexOf('\n') + 1)
    date = date.slice(0, date.lastIndexOf(':'))

    return <div className={`message ${message.self ? 'self' : ''}`}>
        <div className="from">
            {profilePicture && <img src={profilePicture} />}
            <div>{message.from}</div>
        </div>
        <div className="content">{message.message}</div>
        <div className="date">{date}</div>
    </div>
}

export function parseChatMessage(user: User, log: ParsedLog, chat: ChatMessage[]) {
    let message = log.message
    if (log.tags?.includes('chat')) {
        message = message.slice(message.indexOf('\n') + 1)
    }

    if (!message.trim().startsWith('<'))
        return

    let from = message.slice(1, message.indexOf('>'))
    message = message.slice(message.indexOf('>') + 2, message.length);

    chat.push({
        id: log.id, date: log.date,
        from: from, message: message,
        self: from == user.name
    });
}
