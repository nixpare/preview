import './SendCommand.css'

import { Button } from "@mui/material"
import { useState } from "react";

export type SendCommandProps = {
    label: string;
    sendFunc: (cmd: string) => void;
    prefix?: string;
}

export default ({label, sendFunc, prefix=""}: SendCommandProps) => {
    const [command, setCommand] = useState(prefix);

    const send = async () => {
        sendFunc(command)
        setCommand(prefix);
    }

    const changeCommand = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.value == "")
            event.target.value = prefix

        setCommand(event.target.value);
    }

    const handleEnter = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            send();
        }
    }

    return (
        <div className='send-command'>
            <h5>{label}</h5> {/*We need to add a label prop.*/}
            <input type="text" value={command} onChange={changeCommand} onKeyDown={handleEnter} />
            <Button onClick={send}>Send</Button>
        </div>
    )    
}