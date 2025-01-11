import './index.css'

import { StrictMode, useEffect, useState } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import axios from 'axios';
import CraftServerList from '../components/Craft/CraftServerList';
import CraftServer from '../components/Craft/CraftServer';
import Footer from '../components/UI/Footer';
import { Snackbar } from '@mui/material';
import Navbar from '../components/UI/Navbar';
import { ServersInfo } from '../models/Server';
import { User } from '../models/User';
import { wsCleanup } from '../utils/websocket';

const App = (
	<StrictMode>
		<CraftHome />
	</StrictMode>
)

const rootElement = document.getElementById("root");
if (rootElement?.hasChildNodes()) {
	hydrateRoot(rootElement, App)
} else {
	createRoot(rootElement!).render(App)
}

let serversWS = false as WebSocket | boolean
let userWS = false as WebSocket | boolean

function CraftHome() {
	const [openSnackbar, setOpenSnackbar] = useState(false);
	const [errorMessage, setErrorMessage] = useState(localStorage.getItem('username'));

	const showMessage = (message: string): void => {
		setOpenSnackbar(true);
		setErrorMessage(message);
	};

	const [servers, setServers] = useState(undefined as ServersInfo | undefined)
	useEffect(() => {
		if (serversWS) return

		serversWS = true
		startServersInfoWS(setServers, showMessage)

		return () => { wsCleanup(serversWS) }
	}, [])

	const [user, setUser] = useState(undefined as User | undefined)
	useEffect(() => {
		if (userWS) return

		userWS = true
		startUserInfoWS(setUser, showMessage)

		return () => { wsCleanup(userWS) }
	}, [])

	const [currentServer, setCurrentServer] = useState(localStorage.getItem('selectedServer'));
	useEffect(() => {
		if (currentServer == null) {
			localStorage.removeItem('selectedServer')
		} else {
			localStorage.setItem('selectedServer', currentServer)
		}
	}, [currentServer])

	if (!user || !servers)
		return undefined

	const logout = async () => {
		await axios.get('/logout');
		window.location.href = '/login';
	}

	const closeServer = () => {
		setCurrentServer(null)
	}

	const serverOpened = currentServer != undefined && servers?.servers[currentServer] != undefined

	return (
		<>
			<div className="page-wrapper">
				<div>
					<Navbar showLogoutButton onLogout={logout} />
					<div className="page">
						{user != undefined && <h2 className="welcome">Welcome, <span>{user.name}</span></h2>}
						<div className="servers">
							<CraftServerList
								servers={servers}
								aside={serverOpened}
								setCurrentServer={setCurrentServer}
							/>
							{serverOpened ? <>
								<CraftServer
									user={user} server={servers.servers[currentServer]}
									closeServer={closeServer}
									serverName={currentServer}
									showMessage={showMessage}
								/>
							</> : undefined}
						</div>
					</div>
				</div>
				<div>
					<Footer />
				</div>
			</div>

			<Snackbar
				open={openSnackbar}
				message={errorMessage}
				autoHideDuration={6000}
				onClose={() => { setOpenSnackbar(false) }}
				onClick={() => { setOpenSnackbar(false) }}
			/>
		</>
	)
}

async function startServersInfoWS(
	setServersInfo: (info: ServersInfo) => void,
	onMessage: (message: string) => void,
) {
	const url = `/ws/servers`;

	const response = await axios.get(url)
		.catch(err => {
			onMessage(err.response.data);
		});

	if (response == undefined) return
	setServersInfo(response.data)

	serversWS = new WebSocket(url)

	serversWS.onclose = () => {
		serversWS = false
	}
	serversWS.onmessage = (ev) => {
		setServersInfo(JSON.parse(ev.data))
	}
	serversWS.onerror = () => {
		onMessage('Server list connection error')
	}
}

async function startUserInfoWS(
	setUserInfo: (info: User) => void,
	onMessage: (message: string) => void,
) {
	const url = `/ws/user`;

	const response = await axios.get(url)
		.catch(err => {
			onMessage(err.response.data);
		});

	if (response == undefined) return
	setUserInfo(response.data)

	userWS = new WebSocket(url)

	userWS.onclose = () => {
		userWS = false
	}
	userWS.onmessage = (ev) => {
		setUserInfo(JSON.parse(ev.data))
	}
	userWS.onerror = () => {
		onMessage('User info connection error')
	}
}
