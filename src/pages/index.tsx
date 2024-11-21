import { StrictMode, useEffect, useState } from 'react'
import CraftServerList from '../components/CraftServerList';
import CraftServer from '../components/CraftServer';
import Footer from '../components/Footer';
import { Snackbar } from '@mui/material';
import Navbar from '../components/Navbar';
import axios from 'axios';
import { createRoot } from 'react-dom/client';
import { ServersInfo } from '../models/Server';
import { User } from '../models/User';
import UserContext from '../contexts/userContext';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<CraftHome />
	</StrictMode>
)

let serversWS = false as WebSocket | boolean
let userWS = false as WebSocket | boolean

function CraftHome() {
	const [openSnackbar, setOpenSnackbar] = useState(false);
	const [errorMessage, setErrorMessage] = useState(localStorage.getItem('username'));

	const [servers, setServers] = useState(undefined as ServersInfo | undefined)
	useEffect(() => {
		if (serversWS) return

		serversWS = true
		startServersInfoWS(setServers, showMessage)
	})

	const [user, setUser] = useState(undefined as User | undefined)
	useEffect(() => {
		if (userWS) return

		userWS = true
		startUserInfoWS(setUser, showMessage)
	}, [userWS])

	const [currentServer, setCurrentServer] = useState(localStorage.getItem('selectedServer'));
	useEffect(() => {
		if (currentServer == null) {
			localStorage.removeItem('selectedServer')
		} else {
			localStorage.setItem('selectedServer', currentServer)
		}
	}, [currentServer])

	const showMessage = (message: string): void => {
		setOpenSnackbar(true);
		setErrorMessage(message);
	};

	const logout = async () => {
		await axios.get('/logout');
		window.location.href = '/login';
	}

	const closeServer = () => {
		setCurrentServer(null)
	}

	return (
		<>
			<UserContext.Provider value={{ user: user, servers: servers }}>
				<Navbar showLogoutButton onLogout={logout} />

				{user != undefined && <h2>Welcome, {user.name}</h2>}

				<div className="d-flex gap-3">
					<CraftServerList setCurrentServer={setCurrentServer} />
					{currentServer != undefined && servers?.servers[currentServer] != undefined ? <>
						<CraftServer
							closeServer={closeServer}
							serverName={currentServer}
							showMessage={showMessage}
						/>
					</> : undefined}
				</div>


				<Snackbar
					open={openSnackbar}
					message={errorMessage}
					autoHideDuration={6000}
					onClose={() => { setOpenSnackbar(false) }}
					onClick={() => { setOpenSnackbar(false) }}
				/>

				<Footer />
			</UserContext.Provider>
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

	serversWS = new WebSocket(url)

	serversWS.onclose = () => {
		serversWS = false
	}
	serversWS.onmessage = (ev) => {
		setServersInfo(JSON.parse(ev.data))
	}
	serversWS.onerror = () => {
		onMessage('Server connection error')
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

	userWS = new WebSocket(url)

	userWS.onclose = () => {
		userWS = false
	}
	userWS.onmessage = (ev) => {
		setUserInfo(JSON.parse(ev.data))
	}
	userWS.onerror = () => {
		onMessage('Server connection error')
	}
}
