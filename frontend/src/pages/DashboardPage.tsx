import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import "../css/AssessmentMappings.css";

import {
  getQualifications,
  getModules,
  getCohorts,
  getModuleAssignments,
  getAssessmentMappings,
  getAIGradingProfiles,
} from "../api/lms";

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    qualifications: 0,
    modules: 0,
    cohorts: 0,
    assignments: 0,
    mappings: 0,
    profiles: 0,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [
          qualificationsData,
          modulesData,
          cohortsData,
          assignmentsData,
          mappingsData,
          profilesData,
        ] = await Promise.all([
          getQualifications(),
          getModules(),
          getCohorts(),
          getModuleAssignments(),
          getAssessmentMappings(),
          getAIGradingProfiles(),
        ]);

        setMetrics({
          qualifications: qualificationsData.length,
          modules: modulesData.length,
          cohorts: cohortsData.length,
          assignments: assignmentsData.length,
          mappings: mappingsData.length,
          profiles: profilesData.length,
        });
      } catch (error) {
        console.error("Failed to load dashboard metrics", error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, []);

  async function handleLogout() {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Unable to log out.");
    }
  }

  return (
    <main className="admin-container">
      <div className="admin-header">
        <h1>Dashboard</h1>
        <div>
          <span style={{ marginRight: "1rem" }}>
            Logged in as <strong>{user?.username}</strong> ({user?.role})
          </span>
          <button type="button" onClick={handleLogout} className="btn-primary" style={{ padding: "0.5rem 1rem" }}>
            Log out
          </button>
        </div>
      </div>

      <section>
        <h2 style={{ marginBottom: "16px", color: "white" }}>System Overview</h2>
        
        {isLoading ? (
          <p>Loading metrics...</p>
        ) : (
          <div className="status-grid">
            <div className="status-card">
              <span className="status-label">Qualifications</span>
              <span className="status-value">{metrics.qualifications}</span>
            </div>
            <div className="status-card">
              <span className="status-label">Modules</span>
              <span className="status-value">{metrics.modules}</span>
            </div>
            <div className="status-card">
              <span className="status-label">Cohorts</span>
              <span className="status-value">{metrics.cohorts}</span>
            </div>
            <div className="status-card">
              <span className="status-label">Assignments</span>
              <span className="status-value">{metrics.assignments}</span>
            </div>
          </div>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ marginBottom: "16px", color: "white" }}>Grading Configuration</h2>
        
        {isLoading ? (
          <p>Loading metrics...</p>
        ) : (
          <div className="status-grid">
            <div className="status-card">
              <span className="status-label">Assessment Mappings</span>
              <span className="status-value">{metrics.mappings}</span>
            </div>
            <div className="status-card">
              <span className="status-label">AI Profiles</span>
              <span className="status-value">{metrics.profiles}</span>
            </div>
          </div>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ marginBottom: "16px", color: "white" }}>Quick Actions</h2>
        
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Link to="/admin/qualifications" style={{ textDecoration: "none" }}>
            <button className="btn-primary" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
              Manage Qualifications
            </button>
          </Link>
          <Link to="/admin/assignments" style={{ textDecoration: "none" }}>
            <button className="btn-primary" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
              Manage Assignments
            </button>
          </Link>
          <Link to="/admin/mappings" style={{ textDecoration: "none" }}>
            <button className="btn-primary" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
              Assessment Mappings
            </button>
          </Link>
          <Link to="/admin/ai-grading-profiles" style={{ textDecoration: "none" }}>
            <button className="btn-primary" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
              AI Grading Profiles
            </button>
          </Link>
        </div>
      </section>

    </main>
  );
}