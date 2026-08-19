import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <nav className="navbar">
      <div className="navbar__links">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/accounts">Accounts</NavLink>
        <NavLink to="/transactions">Transactions</NavLink>
        <NavLink to="/profile">Profile</NavLink>
        <NavLink to="/legal">Legal</NavLink>
      </div>
      <div className="navbar__user">
        {user && <span>{user.name}</span>}
        <button className="link-button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </nav>
  );
}
