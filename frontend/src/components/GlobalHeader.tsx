import { Menu, Bell, ChevronDown } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router";
import "../css/GlobalLayout.css";

export function GlobalHeader() {
  const { logout } = useAuth();
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
      <div className="header-left">
        <button className="menu-btn">
          <Menu size={20} />
        </button>
      </div>

      <div className="header-right">
        <button className="notification-btn">
          <Bell size={20} />
          <span className="notification-badge">4</span>
        </button>

        <div className="user-profile" onClick={handleLogout} title="Click to logout">
          <div className="avatar">AD</div>
          <div className="user-info">
            <span className="user-name">Admin User</span>
            <span className="user-role">Super Admin</span>
          </div>
          <ChevronDown size={16} style={{ color: "var(--text-muted)", marginLeft: "4px" }} />
        </div>
      </div>
    </header>
  );
}
