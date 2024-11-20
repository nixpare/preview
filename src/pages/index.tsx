import { StrictMode, useEffect, useState } from 'react'
import CraftServerList from './CraftServerList';
import CraftServer, { ServerProps } from './CraftServer';
import Footer from '../components/Footer';
import { Snackbar } from '@mui/material';
import { ServerListProps } from './CraftServerList';
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

type PageName = 'Server' | 'ServerList';
type Pages = {
	[key in PageName]: JSX.ElementType;
}
type PagesProps = {
	'ServerList': ServerListProps,
	'Server': ServerProps
}

let serversWS = false as WebSocket | boolean
let userWS = false as WebSocket | boolean

function CraftHome() {
	const [pageName, setPageName] = useState('ServerList' as PageName);
	const [openSnackbar, setOpenSnackbar] = useState(false);
	const [errorMessage, setErrorMessage] = useState(localStorage.getItem('username'));
	const [currentServer, setCurrentServer] = useState("" as string);

	const showMessage = (message: string): void => {
		setOpenSnackbar(true);
		setErrorMessage(message);
	};

	const showDetails = (serverName: string): void => {
		setPageName('Server');
		setCurrentServer(serverName);
	}

	const backToList = (): void => {
		setPageName('ServerList');
		setCurrentServer("");
	}

	const pages: Pages = {
		'ServerList': CraftServerList,
		'Server': CraftServer
	};

	const pagesProps: PagesProps = {
		'ServerList': { onShowDetails: showDetails },
		'Server': { backToList, serverName: currentServer, onMessage: showMessage }
	};

	const logout = async () => {
        await axios.get('/logout');
        window.location.href = '/login';
	}

	const Page = pages[pageName];
	const pageProps = pagesProps[pageName];

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

	return (
		<>
			<UserContext.Provider value={{ user: user, servers: servers }}>
				<Navbar showLogoutButton onLogout={logout}/>
				<Page {...pageProps} />

				<Footer />

				<Snackbar
					open={openSnackbar}
					message={errorMessage}
					autoHideDuration={6000}
					onClose={() => { setOpenSnackbar(false) }}
					onClick={() => { setOpenSnackbar(false) }}
				/>
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
