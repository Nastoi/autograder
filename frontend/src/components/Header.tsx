import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import "../css/Header.css";
import {
  GraduationCap,
  BookOpen,
  Users,
  ClipboardList,
  Layers,
  Network,
  Settings,
  ListChecks,
  BarChart,
  Bot,
  LayoutDashboard,
  GitMerge
} from "lucide-react";

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

  if (!user) {
    return null;
  }

  return (
    <header className="global-header">
      <div className="logo-container">
        <Link to="/" className="logo-link">
          <span className="logo-icon">🤖</span>
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
                <Link to="/admin/modules" className="nav-link" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <BookOpen size={16} color="#f59e0b" /> Modules
                </Link>
                <Link to="/admin/cohorts" className="nav-link" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Users size={16} color="#8b5cf6" /> Cohorts
                </Link>
              </div>
            </div>

            <div className="dropdown">
              <button className="dropdown-btn">Assignments</button>
              <div className="dropdown-content">
                <Link to="/admin/assignments" className="nav-link" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <ClipboardList size={16} color="#ef4444" /> Assignments
                </Link>
                <Link to="/admin/assignment-levels" className="nav-link" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Layers size={16} color="#3b82f6" /> Assignment Levels
                </Link>
                <Link to="/admin/mappings" className="nav-link" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Network size={16} color="#10b981" /> Mappings
                </Link>
              </div>
            </div>

            <div className="dropdown">
              <button className="dropdown-btn">Grading</button>
              <div className="dropdown-content">
                <Link to="/admin/grading-configurations" className="nav-link" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Settings size={16} color="#f59e0b" /> Configurations
                </Link>
                <Link to="/admin/rubric-criteria" className="nav-link" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <ListChecks size={16} color="#8b5cf6" /> Rubric Criteria
                </Link>
                <Link to="/admin/rubric-bands" className="nav-link" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <BarChart size={16} color="#ef4444" /> Rubric Bands
                </Link>
                <Link to="/admin/ai-grading-profiles" className="nav-link" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Bot size={16} color="#ec4899" /> AI Profiles
                </Link>
                <Link to="/admin/task-criteria-mappings" className="nav-link" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <GitMerge size={16} color="#6366f1" /> Task-Criteria Mappings
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
