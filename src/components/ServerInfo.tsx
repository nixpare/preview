import './ServerInfo.css'

import axios, { AxiosError } from "axios";
import { Server } from "../models/Server";
import { User } from "../models/User";
import SendCommand from "./SendCommand";

type ServerInfoProps = {
	user: User;
	server: Server;
	show: boolean;
	showMessage: (message: string) => void;
}

export default function ServerInfo({ user, server, show, showMessage }: ServerInfoProps) {
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

	const sendBroadcast = async (message: string) => {
		const response = await axios.post(`/${server.name}/broadcast`, message)
			.catch((error) => {
				showMessage(error.message);
			});

		if (!response) return;

		if (response.status >= 400)
			showMessage(response.data);
	}

	return (
		<div className="server-info" style={!show ? { display: 'none' } : undefined}>
			<div className="start-stop-buttons">
				<button onClick={startServer} disabled={server.running}>Start</button>
				<button onClick={stopServer} disabled={!server.running}>Stop</button>
			</div>
			{server.running && <div className="connect">
				{user.server != server.name ? <>
					<button onClick={connectToServer}>Connect</button>
				</> : <div>
					Connected
					<i className="fa-solid fa-circle-check connected-check"></i>
				</div>}
			</div>}
			<SendCommand label="Broadcast Message" sendFunc={sendBroadcast} />
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
				{Object.values(server.players ?? {}).length}
			</div> : undefined}
		</div>
	)
}