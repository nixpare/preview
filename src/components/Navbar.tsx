import logo from '../assets/img/icon.png'

export type NavbarProps = {
    showLogoutButton: boolean;
    onLogout: () => void
}

export default function Navbar({showLogoutButton=false, onLogout=() => {}}: NavbarProps) {

    return <nav className="navbar navbar-dark navbar-expand-md sticky-top py-3" id="mainNav">
      <div className="container">
          <a className="navbar-brand d-flex align-items-center" href="/">
            <span className="bs-icon-md bs-icon-circle d-flex justify-content-center align-items-center me-2 bs-icon">
            <img className="logo-img" src={logo} style={{
                background: "radial-gradient(circle at center, #fff5 0, var(--bs-body-bg) 50%, var(--bs-body-bg) 100%)",
                borderRadius: "50%"
              }} />
            </span>
            <span className="brand-name">NixCraft</span>
          </a>
          <button className={"btn btn-primary " + (!showLogoutButton && "d-none")} type="button" onClick={onLogout}>Logout</button>
      </div>
    </nav>;
}