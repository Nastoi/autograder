import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  GraduationCap,
  Users,
  ClipboardList,
  Layers3,
  ArrowRight,
} from "lucide-react";

import "../css/AssessmentMappings.css";

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
    <main className="admin-container">
      <div className="admin-header">
        <div>
          <h1>Dashboard</h1>
          <p className="section-description">
            Overview of the AutoGrader academic setup and assessment workflow.
          </p>
        </div>
      </div>

      <section className="page-section">
        <div className="section-header">
          <div>
            <h2>System overview</h2>
            <p className="section-description">
              Current academic and assessment configuration.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p>Loading metrics...</p>
        ) : (
          <div className="dashboard-metric-grid">
            <Link
              to="/admin/qualifications"
              className="dashboard-metric-card"
            >
              <div className="dashboard-metric-icon">
                <GraduationCap size={24} />
              </div>

              <div>
                <span className="dashboard-metric-label">
                  Qualifications
                </span>
                <strong className="dashboard-metric-value">
                  {metrics.qualifications}
                </strong>
              </div>
            </Link>

            <Link
              to="/admin/qualifications"
              className="dashboard-metric-card"
            >
              <div className="dashboard-metric-icon">
                <Layers3 size={24} />
              </div>

              <div>
                <span className="dashboard-metric-label">
                  Modules
                </span>
                <strong className="dashboard-metric-value">
                  {metrics.modules}
                </strong>
              </div>
            </Link>

            <Link
              to="/admin/cohorts"
              className="dashboard-metric-card"
            >
              <div className="dashboard-metric-icon">
                <Users size={24} />
              </div>

              <div>
                <span className="dashboard-metric-label">
                  Cohorts
                </span>
                <strong className="dashboard-metric-value">
                  {metrics.cohorts}
                </strong>
              </div>
            </Link>

            <Link
              to="/admin/assignments"
              className="dashboard-metric-card"
            >
              <div className="dashboard-metric-icon">
                <ClipboardList size={24} />
              </div>

              <div>
                <span className="dashboard-metric-label">
                  Assignments
                </span>
                <strong className="dashboard-metric-value">
                  {metrics.assignments}
                </strong>
              </div>
            </Link>

            <Link
              to="/admin/cohorts"
              className="dashboard-metric-card"
            >
              <div className="dashboard-metric-icon">
                <Layers3 size={24} />
              </div>

              <div>
                <span className="dashboard-metric-label">
                  Assigned assessments
                </span>
                <strong className="dashboard-metric-value">
                  {metrics.mappings}
                </strong>
              </div>
            </Link>
          </div>
        )}
      </section>

      <section className="workspace-section">
        <div className="section-header">
          <div>
            <h2>Workflow</h2>
            <p className="section-description">
              Follow the setup order from academic structure to learner submission.
            </p>
          </div>
        </div>

        <div className="dashboard-workflow">
          <Link
            to="/admin/qualifications"
            className="workflow-card"
          >
            <span className="workflow-step">1</span>
            <div>
              <strong>Academic Setup</strong>
              <p>
                Create qualifications and manage modules.
              </p>
            </div>
            <ArrowRight size={18} />
          </Link>

          <Link
            to="/admin/assignments"
            className="workflow-card"
          >
            <span className="workflow-step">2</span>
            <div>
              <strong>Assignments</strong>
              <p>
                Configure assignments, grading levels and rubrics.
              </p>
            </div>
            <ArrowRight size={18} />
          </Link>

          <Link
            to="/admin/cohorts"
            className="workflow-card"
          >
            <span className="workflow-step">3</span>
            <div>
              <strong>Cohorts</strong>
              <p>
                Create cohorts and assign assessments.
              </p>
            </div>
            <ArrowRight size={18} />
          </Link>

          <Link
            to="/admin/cohorts"
            className="workflow-card"
          >
            <span className="workflow-step">4</span>
            <div>
              <strong>Submission URLs</strong>
              <p>
                Copy unique learner submission links from each cohort.
              </p>
            </div>
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-header">
          <div>
            <h2>Quick actions</h2>
          </div>
        </div>

        <div className="dashboard-actions">
          <Link
            to="/admin/qualifications"
            className="btn-secondary dashboard-action-link"
          >
            <GraduationCap size={17} />
            Manage Academic Setup
          </Link>

          <Link
            to="/admin/assignments"
            className="btn-secondary dashboard-action-link"
          >
            <ClipboardList size={17} />
            Manage Assignments
          </Link>

          <Link
            to="/admin/cohorts"
            className="btn-secondary dashboard-action-link"
          >
            <Users size={17} />
            Manage Cohorts
          </Link>
        </div>
      </section>
    </main>
  );
}
