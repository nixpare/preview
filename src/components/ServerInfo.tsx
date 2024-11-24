import './ServerInfo.css'

import axios, { AxiosError } from "axios";
import { Server } from "../models/Server";
import { Button } from "@mui/material";
import { User } from "../models/User";
import SendCommand from "./SendCommand";

type ServerInfoProps = {
	user: User;
	server: Server;
	show: boolean;
	showMessage: (message: string) => void;
}

export default function ServerInfo({ user, server, show, showMessage }: ServerInfoProps) {
	if (!show)
		return
	
	const startServer = async () => {
		const response = await axios.post(`/${server.name}/start`);

		if (response.status === 200) {
			showMessage('Server started');
		} else {
			showMessage('Server failed to start');
		}
	}

	const stopServer = async () => {
		const response = await axios.post(`/${server.name}/stop`);

		if (response.status === 200) {
			showMessage('Server stopped');
		} else {
			showMessage('Server failed to stop');
		}
	}

	const connectToServer = async () => {
		const response = await axios.post(`/${server.name}/connect`)
			.catch((err: AxiosError) => {
				showMessage(err.message);
			});

		if (response == undefined) return;

		if (response.status >= 400) {
			showMessage('Failed to connect to server');
		} else {
			showMessage('Connected to server');
		}
	}

	return (
		<div className="server-info">
			<div>
				<Button onClick={startServer} disabled={server.running}>Start Server</Button>
				<Button onClick={stopServer} disabled={!server.running}>Stop Server</Button>
			</div>
			{server.running && <div>
				{user.server != server.name ? <>
					<Button onClick={connectToServer}>Connect to this Server</Button>
				</> : <>
					Connected
					<i className="fa-solid fa-circle-check connected-check"></i>
				</>}
			</div>}
			<SendCommand cmd="Broadcast Message" route={`/${server.name}/broadcast`} showMessage={showMessage} />
		</div>
	)
}

type ServerOnlineStateProps = {
	server: Server
}

export function ServerOnlineState({ server }: ServerOnlineStateProps) {
	return (
		<div className={`server-state ${server.running ? 'online' : ''}`}>
			<i className="server-state-dot"></i>
			<div className="server-state-descr">
				{server.running ? 'Online' : 'Offline'}
			</div>
			{server.running ? <div className="online-players">
				<i className="fa-solid fa-users"></i>
				{server.players?.length ?? 0}
			</div> : undefined}
		</div>
	)
}