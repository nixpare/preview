import './ServerLogs.css'

import { useEffect, useState, MouseEvent, useRef } from "react";
import SendCommand from './SendCommand';
import { ParsedLog, ServerLog } from '../models/Logs';
import { getWS } from './CraftServer';

type ServerLogsProps = {
    logs: ParsedLog[];
    show: boolean;
    showMessage: (message: string) => void;
}

export default function ServerLogs({ logs, show, showMessage }: ServerLogsProps) {
    const serverLogsEl = useRef<HTMLDivElement>(null);
    const [scrollAtBottom, setScrollAtBottom] = useState(false)

    useEffect(() => {
        if (!scrollAtBottom)
            return
        
        serverLogsEl.current?.scroll({ top: serverLogsEl.current.scrollHeight, behavior: 'smooth' })
        setScrollAtBottom(true)
    }, [logs])

    const onLogsScroll = (ev: React.UIEvent<HTMLDivElement>) => {
        if (ev.currentTarget.scrollTop + ev.currentTarget.clientHeight < ev.currentTarget.scrollHeight) {
            setScrollAtBottom(false)
        } else {
            setScrollAtBottom(true)
        }
    }

    const send = (cmd: string) => {
        const ws = getWS()
        if (!ws) {
            showMessage('Could not send command to server')
            return
        }

        ws.send(cmd)
    }
    
    return (
        <div style={!show ? { display: 'none'} : undefined}>
            <SendCommand label="Command" sendFunc={send} prefix="/" />
            <div className="server-logs" onScroll={onLogsScroll} ref={serverLogsEl}>
                <table>
                    <thead>
                        <tr>
                            <th scope="col">TIME</th>
                            <th scope="col">FROM</th>
                            <th scope="col">LEVEL</th>
                            <th scope="col">LOG</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <Log key={log.id} log={log} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Log({ log }: { log: ParsedLog }) {
    const multiline = log.message.includes('\n') ? 'multiline' : ''

    const [showing, setShowing] = useState(false)
    const toggleShowing = (ev: MouseEvent) => {
        ev.preventDefault()
        setShowing(!showing)
    }

    return <tr>
        <td>{log.date}</td>
        <td>{log.from}</td>
        <td style={{ color: log.levelColor }}>{log.level}</td>
        <td>
            <div className={`log-message ${multiline} ${showing ? 'show' : ''}`} onClick={toggleShowing}>
                <div className="message">
                    {log.message}
                    <div className="tags">
                        Tags:
                        {log.tags?.map(tag => (
                            <p key={tag}>{tag}</p>
                        ))}
                    </div>
                </div>
                <div className="expand">
                    <i className="fa-solid fa-chevron-right"></i>
                </div>
            </div>
        </td>
    </tr>
}

export function parseLog(log: ServerLog, logs: ParsedLog[]): ParsedLog {
    let from: string, level: string, levelColor: string;
    let message = log.message

    const date = new Date(log.date).toLocaleDateString(undefined, {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).replace(', ', '\n')

    let appendToPrevious = false

    switch (true) {
        case log.tags?.includes('stderr'):
            from = 'Server'
            level = 'FATAL'
            levelColor = 'hsl(0, 80%, 60%)'

            break;
        case log.tags?.includes('user'):
            from = 'NixCraft'
            level = 'USER'
            levelColor = 'hsl(90, 80%, 60%)'

            break;
        case log.tags?.includes('server'):
            from = 'NixCraft'
            level = 'SERVER'
            levelColor = 'hsl(90, 80%, 60%)'

            break;
        default:
            switch (true) {
                case message.indexOf('] ') >= 0 && message.indexOf(']: ') > message.indexOf('] '):
                    message = message.substring(message.indexOf('] ') + 2, message.length);
                    [from, level] = message.substring(1, message.indexOf(']: ')).split('/', 2)
                    message = message.substring(message.indexOf(']: ') + 3, message.length)

                    break
                case message.indexOf(']: ') >= 0:
                    from = 'Server'
                    level = message.substring(1, message.indexOf(']: ')).split(' ', 2)[1]
                    message = message.substring(message.indexOf(']: ') + 3, message.length)

                    break
                default:
                    from = 'Server'
                    level = ''
                    appendToPrevious = true
                    break
            }

            switch (level) {
                case 'INFO':
                    levelColor = 'hsl(190, 80%, 60%)'
                    break
                case 'WARN':
                    levelColor = 'hsl(20, 80%, 60%)'
                    break
                case 'ERROR':
                    levelColor = 'hsl(0, 80%, 60%)'
                    break
                default:
                    levelColor = ''
            }
    }

    if (log.extra != '')
        message = message.concat('\n', log.extra)

    const parsed: ParsedLog = {
        id: log.id, date: date,
        from: from, level: level, levelColor: levelColor,
        message: message, tags: log.tags
    }

    if (appendToPrevious && logs[logs.length-1] != undefined) {
        let lastLog = logs[logs.length -1]
        lastLog.message = lastLog.message.concat('\n', message)
        logs[logs.length -1] = lastLog
    } else {
        logs.push(parsed)
    }
    
    return parsed
}
