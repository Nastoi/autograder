import { Link, useLocation } from "react-router";
import {
  Home,
  GraduationCap,
  Bookmark,
  Package,
  Users,
  ClipboardList,
  FileCheck,
  BarChart,
  Settings,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import "../css/GlobalLayout.css";

export function GlobalSidebar() {
  const location = useLocation();
  const path = location.pathname;

  // We check if current route starts with a given prefix for active states
  const isActive = (prefix: string) => path === prefix || path.startsWith(prefix);
  
  const [academicOpen, setAcademicOpen] = useState(
    isActive("/admin/qualifications") || isActive("/admin/modules") || isActive("/admin/cohorts")
  );

  return (
    <aside className="global-sidebar">
      <div className="sidebar-brand">
        <Link to="/" className="sidebar-logo">
          <span className="highlight">LITHAN</span>
          <span style={{ fontSize: '14px', marginTop: '2px' }}>CLaaS<br/>2SaaS</span>
        </Link>
      </div>

      <nav className="sidebar-nav">
        <Link to="/dashboard" className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}>
          <Home className="nav-icon" size={18} />
          <span>Dashboard</span>
        </Link>

        {/* Academic Setup Group */}
        <div 
          className={`nav-item ${academicOpen ? "active" : ""}`}
          onClick={() => setAcademicOpen(!academicOpen)}
          style={{ paddingRight: '12px' }}
        >
          <GraduationCap className="nav-icon" size={18} />
          <span>Academic Setup</span>
          <ChevronDown className={`nav-chevron ${academicOpen ? "open" : ""}`} size={16} />
        </div>

        {academicOpen && (
          <div className="nav-group">
            <Link to="/admin/qualifications" className={`nav-item child ${isActive("/admin/qualifications") ? "active" : ""}`}>
              <Bookmark className="nav-icon" size={16} />
              <span>Qualifications</span>
            </Link>
            <Link to="/admin/modules" className={`nav-item child ${isActive("/admin/modules") ? "active" : ""}`}>
              <Package className="nav-icon" size={16} />
              <span>Modules</span>
            </Link>
            <Link to="/admin/cohorts" className={`nav-item child ${isActive("/admin/cohorts") ? "active" : ""}`}>
              <Users className="nav-icon" size={16} />
              <span>Cohorts</span>
            </Link>
          </div>
        )}

        <Link to="/admin/assignments" className={`nav-item ${isActive("/admin/assignments") ? "active" : ""}`}>
          <ClipboardList className="nav-icon" size={18} />
          <span>Assignments</span>
        </Link>

        <Link to="/admin/assessments" className={`nav-item ${isActive("/admin/assessments") ? "active" : ""}`}>
          <FileCheck className="nav-icon" size={18} />
          <span>Assessments</span>
        </Link>

        <div className="nav-item">
          <Users className="nav-icon" size={18} />
          <span>Users</span>
          <ChevronDown className="nav-chevron" size={16} />
        </div>

        <div className="nav-item">
          <BarChart className="nav-icon" size={18} />
          <span>Reports</span>
          <ChevronDown className="nav-chevron" size={16} />
        </div>

        <div className="nav-item">
          <Settings className="nav-icon" size={18} />
          <span>Settings</span>
          <ChevronDown className="nav-chevron" size={16} />
        </div>
      </nav>

      {/* Promotional AI Banner */}
      <div className="sidebar-promo">
        <h4>
          Let your Staff Learn
          <span>AI Skills</span>
        </h4>
        <div className="funding">
          <FileCheck size={14} /> up to 90% funding
        </div>
        <p>2 Days to take an AI skill back to work!</p>
        <button className="promo-btn">
          Enquire Now <ChevronRight size={16} />
        </button>
      </div>
    </aside>
  );
}
