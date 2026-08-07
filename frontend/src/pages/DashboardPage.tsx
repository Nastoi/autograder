import { useEffect, useState } from "react";
import { Link } from "react-router";
// import { useAuth } from "../auth/AuthContext";
import "../css/AssessmentMappings.css";
import {
  GraduationCap,
  BookOpen,
  Users,
  ClipboardList,
  Network,
  Bot
} from "lucide-react";

import {
  getQualifications,
  getModules,
  getCohorts,
  getModuleAssignments,
  getAssessmentMappings,
  getAIGradingProfiles,
} from "../api/lms";

export function DashboardPage() {

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


  return (
    <main className="admin-container">
      <div className="admin-header">
        <h1>Dashboard</h1>
      </div>

      <section>
        <h2 style={{ marginBottom: "16px", color: "#112642" }}>System Overview</h2>
        
        {isLoading ? (
          <p>Loading metrics...</p>
        ) : (
          <div className="status-grid">
            <Link to="/admin/qualifications" style={{ textDecoration: 'none' }}>
              <div className="status-card qualifications">
                <GraduationCap color="#10b981" size={32} style={{ marginBottom: "0.5rem" }} />
                <span className="status-label">Qualifications</span>
                <span className="status-value">{metrics.qualifications}</span>
              </div>
            </Link>
            
            <Link to="/admin/modules" style={{ textDecoration: 'none' }}>
              <div className="status-card modules">
                <BookOpen color="#f59e0b" size={32} style={{ marginBottom: "0.5rem" }} />
                <span className="status-label">Modules</span>
                <span className="status-value">{metrics.modules}</span>
              </div>
            </Link>

            <Link to="/admin/cohorts" style={{ textDecoration: 'none' }}>
              <div className="status-card cohorts">
                <Users color="#8b5cf6" size={32} style={{ marginBottom: "0.5rem" }} />
                <span className="status-label">Cohorts</span>
                <span className="status-value">{metrics.cohorts}</span>
              </div>
            </Link>

            <Link to="/admin/assignments" style={{ textDecoration: 'none' }}>
              <div className="status-card assignments">
                <ClipboardList color="#ef4444" size={32} style={{ marginBottom: "0.5rem" }} />
                <span className="status-label">Assignments</span>
                <span className="status-value">{metrics.assignments}</span>
              </div>
            </Link>
          </div>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ marginBottom: "16px", color: "#112642" }}>Grading Configuration</h2>
        
        {isLoading ? (
          <p>Loading metrics...</p>
        ) : (
          <div className="status-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <Link to="/admin/mappings" style={{ textDecoration: 'none' }}>
              <div className="status-card mappings">
                <Network color="#3b82f6" size={32} style={{ marginBottom: "0.5rem" }} />
                <span className="status-label">Assessment Mappings</span>
                <span className="status-value">{metrics.mappings}</span>
              </div>
            </Link>

            <Link to="/admin/ai-grading-profiles" style={{ textDecoration: 'none' }}>
              <div className="status-card profiles">
                <Bot color="#ec4899" size={32} style={{ marginBottom: "0.5rem" }} />
                <span className="status-label">AI Profiles</span>
                <span className="status-value">{metrics.profiles}</span>
              </div>
            </Link>
          </div>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ marginBottom: "16px", color: "#112642" }}>Quick Actions</h2>
        
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Link to="/admin/qualifications" style={{ textDecoration: "none" }}>
            <button className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <GraduationCap color="#10b981" size={18} /> Manage Qualifications
            </button>
          </Link>
          <Link to="/admin/assignments" style={{ textDecoration: "none" }}>
            <button className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <ClipboardList color="#ef4444" size={18} /> Manage Assignments
            </button>
          </Link>
          <Link to="/admin/mappings" style={{ textDecoration: "none" }}>
            <button className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Network color="#3b82f6" size={18} /> Assessment Mappings
            </button>
          </Link>
          <Link to="/admin/ai-grading-profiles" style={{ textDecoration: "none" }}>
            <button className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Bot color="#ec4899" size={18} /> AI Grading Profiles
            </button>
          </Link>
        </div>
      </section>

    </main>
  );
}