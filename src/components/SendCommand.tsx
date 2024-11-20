import '../assets/css/SendCommand.css'

import { Button } from "@mui/material"
import axios from "axios";
import { useState } from "react";

export type SendCommandProps = {
    showMessage: (message: string) => void;
    route: string;
    prefix?: string;
    cmd: string;
}

export default ({showMessage, route, cmd, prefix=""}: SendCommandProps) => {
    const [command, setCommand] = useState(prefix);

    const send = async () => {
        const response = await axios.post(route, command)
        .catch((error) => {
            showMessage(error.message);
        });

        if (!response) return;

        setCommand(prefix);
        if (response.status >= 400)
            showMessage(response.data);

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
            <h5>{cmd}</h5> {/*We need to add a label prop.*/}
            <input type="text" value={command} onChange={changeCommand} onKeyDown={handleEnter} />
            <Button onClick={send}>Send</Button>
        </div>
    )    
}