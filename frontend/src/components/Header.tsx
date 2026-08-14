import { Link, useNavigate, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";
import "../css/Header.css";
import {
  GraduationCap,
  Users,
  ClipboardList,
  LayoutDashboard,
  FileText,
} from "lucide-react";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const location = useLocation();

  const isSubmissionFlow =
    location.pathname.startsWith("/submit/mapping/") ||
    location.pathname.startsWith("/results/");

  async function handleLogout() {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  if (!user) {
    return null;
  }

  if (isSubmissionFlow) {
    return null;
  }
  return (
    <header className="global-header">
      <div className="logo-container">
        <Link to="/" className="logo-link">
          <span className="logo-text">AutoGrader</span>
        </Link>
      </div>

      <nav className="header-nav">
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <LayoutDashboard size={16} color="#3b82f6" />
            Dashboard
          </Link>

          <div className="dropdown">
            <button className="dropdown-btn">Academics</button>
            <div className="dropdown-content">
              <Link to="/admin/qualifications" className="nav-link" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <GraduationCap size={16} color="#10b981" /> Qualifications
              </Link>

              <Link to="/admin/cohorts" className="nav-link" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Users size={16} color="#8b5cf6" /> Cohorts
              </Link>
            </div>
          </div>

          <div className="dropdown">
            <button className="dropdown-btn">Assignments</button>

            <div className="dropdown-content">
              <Link
                to="/admin/assignments"
                className="nav-link"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <ClipboardList size={16} color="#ef4444" />
                Assignments
              </Link>

              <Link
                to="/admin/submission-records"
                className="nav-link"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FileText size={16} color="#f59e0b" />
                Records
              </Link>
            </div>
          </div>

        </div>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </nav>
    </header>
  );
}
