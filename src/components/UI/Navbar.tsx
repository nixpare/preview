import './Navbar.css'
import logo from '../../img/icon.png'

export type NavbarProps = {
    showLogoutButton: boolean;
    onLogout: () => void
}

export default function Navbar({showLogoutButton=false, onLogout=() => {}}: NavbarProps) {
    return <nav>
      <a className="logo" href="/">
        <img className="logo-img" src={logo} />
        <h1>NixCraft</h1>
      </a>
      <button className={`primary-button logout-button ${!showLogoutButton ? 'hidden' : ''}`} type="button" onClick={onLogout}>Logout</button>
    </nav>;
}