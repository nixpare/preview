import { Button, TextField } from "@mui/material"
import axios from "axios";
import { useContext, useState } from "react";
import UserContext from "../contexts/userContext";

export type Command = "send-broadcast" | "send";

export type SendCommandProps = {
    showMessage: (message: string) => void;
    route: string;
    prefix?: string;
    cmd: Command;
}

type AxiosCommandBody = {
    cmd: Command;
    args: string[];
}

export default ({showMessage, route, cmd, prefix=""}: SendCommandProps) => {
    const [command, setCommand] = useState(prefix);
    const user = useContext(UserContext).user;

    const body: AxiosCommandBody = {
        cmd,
        args: [user, command]
    };

    const send = async () => {
        const response = await axios.post(route, body)
        .catch((error) => {
            showMessage(error.message);
        });

        if (!response) return;

        setCommand("");
        if (response.status >= 400)
            showMessage(response.statusText);

    }

    const changeCommand = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (prefix !== "" && !event.target.value.startsWith(prefix))
            setCommand(prefix + event.target.value);
        else
            setCommand(event.target.value);
    }

    return (
        <div>
            <h3>{cmd}</h3> {/*We need to add a label prop.*/}
            <TextField variant="outlined" value={command} onChange={changeCommand}/>
            
            <Button onClick={send} onKeyUp={(event) => {
                if (event.key === 'Enter') {
                    send();
                }
            }}>Send</Button>
        </div>
    )    
}