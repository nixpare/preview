import './assets/css/bootstrap.min.css';
import './assets/css/style.css';

import { useState } from 'react'
import Login from './pages/CraftLogin';
import CraftServerList from './pages/CraftServerList';
import CraftServer from './pages/CraftServer';
import Footer from './components/Footer';
import { Snackbar } from '@mui/material';

type PageName = 'Login' | 'Server' | 'ServerList';
type Pages = {
  [key in PageName]: JSX.ElementType;
}
type PagesProps = {
  [key in PageName]: {};
}

export default function App() {
  const [pageName, setPage] = useState('Login' as PageName);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const showMessage = (message: string) : void => {
      setOpenSnackbar(true);
      setErrorMessage(message);
  };

  const login = (username: string) : void => {
    setPage('ServerList');
    showMessage(`Welcome ${username}`);
    // TODO: Implement login screen with fixed username and THEN disable snackbar message!
    //setOpenSnackbar(false);
    //setErrorMessage(undefined);
  }

  const pages: Pages = {
    'Login': Login,
    'ServerList': CraftServerList,
    'Server': CraftServer
  };

  const pagesProps: PagesProps = {
    'Login': {onLogin: login, onMessage: showMessage},
    'ServerList': {onMessage: showMessage},
    'Server': {}
  };

  const Page = pages[pageName];
  const pageProps = pagesProps[pageName];

  return (
    <>
          <Page {...pageProps}/>

          <Footer />

          <Snackbar
            open={openSnackbar}
            message={errorMessage}
            autoHideDuration={6000}
            onClose={() => {setOpenSnackbar(false)}}
            onClick={() => {setOpenSnackbar(false)}}
          />
    </>
  )
}
