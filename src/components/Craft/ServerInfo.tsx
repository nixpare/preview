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
				<InRelief clickable reversed={server.running} disabled={server.running}>
					<button onClick={startServer} disabled={server.running}>
						<div>Start</div>
					</button>
				</InRelief>
				<InRelief clickable reversed={!server.running} disabled={!server.running}>
					<button onClick={stopServer} disabled={!server.running}>
						<div>Stop</div>
					</button>
				</InRelief>
			</div>
			{<div className="connect">
				<InRelief clickable>
					<button onClick={connectToServer}>
						{user.server != server.name ? <div>Connect</div> : <>
							<div>Connected</div>
							<i className="fa-solid fa-circle-check connected-check"></i>
						</>}
						<div></div>
					</button>
				</InRelief>
			</div>}
			<div className="online-players">
				{server.running && Object.values(server.players || {}).map(player => {
					return <PlayerTag name={player.name} key={player.name} />
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

type PlayerTagProps = {
	name: string
}

function PlayerTag({ name }: PlayerTagProps) {
	const [profilePicture, setProfilePicture] = useState<string | null>(null)
	const [switchProfile, setSwitchProfile] = useState(false)

	useEffect(() => {
		getProfileImage(name, switchProfile ? ProfileImageType.HEADHELM : ProfileImageType.ARMOR_BUST)
			.then(image => {
				setProfilePicture(URL.createObjectURL(image))
			});
	}, [switchProfile]);

	const onHoverOrClick = () => {
		setSwitchProfile(!switchProfile)
	}

	return (
		<InRelief hoverable>
			<div className="player-tag" onClick={onHoverOrClick} onMouseEnter={onHoverOrClick}>
				{profilePicture && <img src={profilePicture} />}
				<div>{name}</div>
			</div>
		</InRelief>
	)
}