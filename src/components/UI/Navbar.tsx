import './Navbar.css'
import logo from '../../img/icon.png'

export type NavbarProps = {
    showLogoutButton: boolean;
    onLogout: () => void
}

export default function Navbar({showLogoutButton=false, onLogout=() => {}}: NavbarProps) {
    return <nav>
      <a className="logo" href="/">
        <img className="logo-img" src={logo} style={{
          background: "radial-gradient(circle at center, #fff5 0, var(--bs-body-bg) 50%, var(--bs-body-bg) 100%)",
          borderRadius: "50%"
        }} />
        <h1>NixCraft</h1>
      </a>
      <button className={`primary-button logout-button ${!showLogoutButton ? 'hidden' : ''}`} type="button" onClick={onLogout}>Logout</button>
    </nav>;
}