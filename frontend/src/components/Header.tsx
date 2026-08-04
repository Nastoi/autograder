import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import "../css/Header.css";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  return (
    <header className="global-header">
      <div className="logo-container">
        <Link to="/" className="logo-link">
          <span className="logo-icon">🤖</span>
          <span className="logo-text">AI Autograder</span>
        </Link>
      </div>

      {user && (
        <nav className="header-nav">
          <div className="nav-links">
            <Link to="/admin/mappings" className="nav-link">Mappings</Link>
            <Link to="/admin/mappings/new" className="nav-link">Create Mapping</Link>
            <Link to="/admin/qualifications" className="nav-link">Qualifications</Link>
          </div>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </nav>
      )}
    </header>
  );
}
