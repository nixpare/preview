import './ServerInfo.css'

import axios, { AxiosError } from "axios";
import { Server } from "../../models/Server";
import { User } from "../../models/User";
import { useEffect, useState } from 'react';
import { getProfileImage, ProfileImageType } from '../../utils/ProfileImageCache';
import { InRelief } from '../UI/InRelief';

type ServerInfoProps = {
	user: User;
	server: Server;
	show: boolean;
	showMessage: (message: string) => void;
}

export default function ServerInfo({ user, server, show, showMessage }: ServerInfoProps) {
	const [playerPictures, setPlayerPictures] = useState<{ [key: string]: string }>({});

	useEffect(() => {
		const fetchPlayerPictures = async () => {
			const playerPictures: { [key: string]: string } = {};

			for (const player of Object.values(server.players ?? {})) {
				const data = await getProfileImage(player.name, ProfileImageType.ARMOR_BUST)
				playerPictures[player.name] = URL.createObjectURL(data)
			}

			setPlayerPictures(playerPictures);
		}

		fetchPlayerPictures();
	}, [server.players]);

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
		<div className="server-info" style={!show ? { display: 'none' } : undefined}>
			<div className="start-stop-buttons">
				<InRelief clickable disabled={server.running}>
					<button onClick={startServer} disabled={server.running}>
						<div>Start</div>
					</button>
				</InRelief>
				<InRelief clickable disabled={!server.running}>
					<button onClick={stopServer} disabled={!server.running}>
						<div>Stop</div>
					</button>
				</InRelief>
			</div>
			{<div className="connect">
				{user.server != server.name ? <>
					<InRelief clickable>
						<button onClick={connectToServer}>
							<div>Connect</div>
						</button>
					</InRelief>
				</> : <div>
					Connected
					<i className="fa-solid fa-circle-check connected-check"></i>
				</div>}
			</div>}
			<div>
				{server.running && Object.keys(playerPictures).map((username) => {
					return <div key={username}>
						<img src={playerPictures[username]} alt={username} />
						{username}
					</div>;
				})}
			</div>
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