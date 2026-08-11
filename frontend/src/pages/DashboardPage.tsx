import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  GraduationCap,
  Users,
  ClipboardList,
  Layers3,
  ArrowRight,
  Package,
} from "lucide-react";

import "../css/AssessmentMappings.css";
import "../css/QualificationsPage.css"; // Import for modern layout classes

import {
  getAssessmentMappings,
  getCohorts,
  getModuleAssignments,
  getModules,
  getQualifications,
} from "../api/lms";

export function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);

  const [metrics, setMetrics] = useState({
    qualifications: 0,
    modules: 0,
    cohorts: 0,
    assignments: 0,
    mappings: 0,
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
        ] = await Promise.all([
          getQualifications(),
          getModules(),
          getCohorts(),
          getModuleAssignments(),
          getAssessmentMappings(),
        ]);

        setMetrics({
          qualifications: qualificationsData.length,
          modules: modulesData.length,
          cohorts: cohortsData.length,
          assignments: assignmentsData.length,
          mappings: mappingsData.length,
        });
      } catch (error) {
        console.error(
          "Failed to load dashboard metrics",
          error,
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, []);

  return (
    <div className="dashboard-layout">
      <main className="academic-main-centered">
        <div className="academic-header">
          <div>
            <h1>Dashboard</h1>
            <p className="section-description">
              Overview of the AutoGrader academic setup and assessment workflow.
            </p>
          </div>
        </div>

        <section style={{ marginBottom: '40px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-h)', margin: 0, paddingBottom: '4px' }}>System overview</h2>
            <p className="section-description" style={{ margin: 0 }}>
              Current academic and assessment configuration.
            </p>
          </div>

          {isLoading ? (
            <p>Loading metrics...</p>
          ) : (
            <div className="metrics-row-5">
              <Link to="/admin/qualifications" className="metric-card-modern">
                <div className="metric-icon-wrapper purple">
                  <GraduationCap size={24} />
                </div>
                <div className="metric-content">
                  <span className="metric-label" style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>Qualifications</span>
                  <span className="metric-value" style={{ marginTop: '4px' }}>{metrics.qualifications}</span>
                </div>
              </Link>

              <Link to="/admin/modules" className="metric-card-modern">
                <div className="metric-icon-wrapper blue">
                  <Package size={24} />
                </div>
                <div className="metric-content">
                  <span className="metric-label" style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>Modules</span>
                  <span className="metric-value" style={{ marginTop: '4px' }}>{metrics.modules}</span>
                </div>
              </Link>

              <Link to="/admin/cohorts" className="metric-card-modern">
                <div className="metric-icon-wrapper green">
                  <Users size={24} />
                </div>
                <div className="metric-content">
                  <span className="metric-label" style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>Cohorts</span>
                  <span className="metric-value" style={{ marginTop: '4px' }}>{metrics.cohorts}</span>
                </div>
              </Link>

              <Link to="/admin/assignments" className="metric-card-modern">
                <div className="metric-icon-wrapper orange">
                  <ClipboardList size={24} />
                </div>
                <div className="metric-content">
                  <span className="metric-label" style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>Assignments</span>
                  <span className="metric-value" style={{ marginTop: '4px' }}>{metrics.assignments}</span>
                </div>
              </Link>

              <Link to="/admin/cohorts" className="metric-card-modern">
                <div className="metric-icon-wrapper purple">
                  <Layers3 size={24} />
                </div>
                <div className="metric-content">
                  <span className="metric-label" style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>Assigned Assessments</span>
                  <span className="metric-value" style={{ marginTop: '4px' }}>{metrics.mappings}</span>
                </div>
              </Link>
            </div>
          )}
        </section>

        <section style={{ marginBottom: '40px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-h)', margin: 0, paddingBottom: '4px' }}>Workflow</h2>
            <p className="section-description" style={{ margin: 0 }}>
              Follow the setup order from academic structure to learner submission.
            </p>
          </div>

          <div className="workflow-row">
            <Link to="/admin/qualifications" className="workflow-card-modern">
              <span className="workflow-step-badge">1</span>
              <div className="workflow-card-content">
                <strong>Academic Setup</strong>
                <p>Create qualifications and manage modules.</p>
              </div>
              <ArrowRight size={18} className="workflow-arrow" />
            </Link>

            <Link to="/admin/assignments" className="workflow-card-modern">
              <span className="workflow-step-badge" style={{ backgroundColor: '#3b82f6' }}>2</span>
              <div className="workflow-card-content">
                <strong>Assignments</strong>
                <p>Configure assignments, grading levels and rubrics.</p>
              </div>
              <ArrowRight size={18} className="workflow-arrow" />
            </Link>

            <Link to="/admin/cohorts" className="workflow-card-modern">
              <span className="workflow-step-badge" style={{ backgroundColor: 'var(--success)' }}>3</span>
              <div className="workflow-card-content">
                <strong>Cohorts</strong>
                <p>Create cohorts and assign assessments.</p>
              </div>
              <ArrowRight size={18} className="workflow-arrow" />
            </Link>

            <Link to="/admin/cohorts" className="workflow-card-modern">
              <span className="workflow-step-badge" style={{ backgroundColor: 'var(--warning)' }}>4</span>
              <div className="workflow-card-content">
                <strong>Submission URLs</strong>
                <p>Copy unique learner submission links from each cohort.</p>
              </div>
              <ArrowRight size={18} className="workflow-arrow" />
            </Link>
          </div>
        </section>

        <section>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-h)', margin: 0, paddingBottom: '4px' }}>Quick actions</h2>
          </div>

          <div className="dashboard-actions-modern">
            <Link to="/admin/qualifications" className="btn-secondary" style={{ textDecoration: 'none' }}>
              <GraduationCap size={16} />
              Manage Academic Setup
            </Link>

            <Link to="/admin/assignments" className="btn-secondary" style={{ textDecoration: 'none' }}>
              <ClipboardList size={16} />
              Manage Assignments
            </Link>

            <Link to="/admin/cohorts" className="btn-secondary" style={{ textDecoration: 'none' }}>
              <Users size={16} />
              Manage Cohorts
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
