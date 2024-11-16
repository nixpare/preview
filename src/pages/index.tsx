import { StrictMode, useState } from 'react'
import CraftServerList from './CraftServerList';
import CraftServer, { ServerProps } from './CraftServer';
import Footer from '../components/Footer';
import { Snackbar } from '@mui/material';
import { ServerListProps } from './CraftServerList';
import Navbar from '../components/Navbar';
import axios from 'axios';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<CraftHome />
	</StrictMode>,
)

type PageName = 'Server' | 'ServerList';
type Pages = {
	[key in PageName]: JSX.ElementType;
}
type PagesProps = {
	'ServerList': ServerListProps,
	'Server': ServerProps
}

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
		'ServerList': { onMessage: showMessage, onShowDetails: showDetails },
		'Server': { backToList, serverName: currentServer, onMessage: showMessage }
	};

	const logout = async () => {
        localStorage.removeItem('username');
        await axios.get('/logout');
        window.location.href = '/login';
	}

	const Page = pages[pageName];
	const pageProps = pagesProps[pageName];

	return (
		<>
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
		</>
	)
}
