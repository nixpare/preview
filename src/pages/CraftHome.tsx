import '../assets/css/bootstrap.min.css';
import '../assets/css/style.css';

import { useState } from 'react'
import CraftServerList from './CraftServerList';
import CraftServer from './CraftServer';
import Footer from '../components/Footer';
import { Snackbar } from '@mui/material';

type PageName = 'Server' | 'ServerList';
type Pages = {
	[key in PageName]: JSX.ElementType;
}
type PagesProps = {
	[key in PageName]: {};
}

export default function App() {
	const [pageName, _] = useState('ServerList' as PageName);
	const [openSnackbar, setOpenSnackbar] = useState(false);
	const [errorMessage, setErrorMessage] = useState(localStorage.getItem('username'));

	const showMessage = (message: string): void => {
		setOpenSnackbar(true);
		setErrorMessage(message);
	};

	const pages: Pages = {
		'ServerList': CraftServerList,
		'Server': CraftServer
	};

	const pagesProps: PagesProps = {
		'ServerList': { onMessage: showMessage },
		'Server': {}
	};

	const Page = pages[pageName];
	const pageProps = pagesProps[pageName];

	return (
		<>
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
