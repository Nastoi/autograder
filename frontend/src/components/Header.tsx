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
            <Link to="/dashboard" className="nav-link">Dashboard</Link>
            
            <div className="dropdown">
              <button className="dropdown-btn">Academics</button>
              <div className="dropdown-content">
                <Link to="/admin/qualifications" className="nav-link">Qualifications</Link>
                <Link to="/admin/modules" className="nav-link">Modules</Link>
                <Link to="/admin/cohorts" className="nav-link">Cohorts</Link>
              </div>
            </div>

            <div className="dropdown">
              <button className="dropdown-btn">Assignments</button>
              <div className="dropdown-content">
                <Link to="/admin/assignments" className="nav-link">Assignments</Link>
                <Link to="/admin/assignment-levels" className="nav-link">Assignment Levels</Link>
                <Link to="/admin/mappings" className="nav-link">Mappings</Link>
              </div>
            </div>

            <div className="dropdown">
              <button className="dropdown-btn">Grading</button>
              <div className="dropdown-content">
                <Link to="/admin/grading-configurations" className="nav-link">Configurations</Link>
                <Link to="/admin/rubric-criteria" className="nav-link">Rubric Criteria</Link>
                <Link to="/admin/rubric-bands" className="nav-link">Rubric Bands</Link>
                <Link to="/admin/ai-grading-profiles" className="nav-link">AI Profiles</Link>
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </nav>
      )}
    </header>
  );
}
