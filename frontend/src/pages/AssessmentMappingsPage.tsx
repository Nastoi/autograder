import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import {
  getAssessmentMappings,
  type AssessmentMapping,
} from "../api/lms";
import "../css/AssessmentMappings.css";

export function AssessmentMappingsPage() {
  const navigate = useNavigate();

  const [mappings, setMappings] = useState<
    AssessmentMapping[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMappings() {
      try {
        const data = await getAssessmentMappings();
        setMappings(data);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load assessment mappings.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadMappings();
  }, []);

  if (isLoading) {
    return <main className="admin-container">Loading assessment mappings...</main>;
  }

  if (error) {
    return (
      <main className="admin-container">
        <header className="admin-header">
          <div className="admin-header">
                <h1>Assessment mappings</h1>
            </div>
        </header>
        <div className="error-message" role="alert" style={{ marginTop: '20px' }}>
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="admin-container">
      <header className="admin-header">
        <div className="admin-header">
                <h1>Assessment mappings</h1>
            </div>
      </header>

      {mappings.length === 0 ? (
        <section className="table-container" style={{ padding: "32px", textAlign: "center" }}>
          <p style={{ color: "#94a3b8" }}>No assessment mappings have been created yet.</p>
        </section>
      ) : (
        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Cohort</th>
                <th>Assignment</th>
                <th>Level</th>
                <th>Status</th>
                <th>Usage</th>
              </tr>
            </thead>

            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.id}>
                  <td style={{ fontWeight: 500 }}>{mapping.name}</td>

                  <td>
                    {mapping.cohort_code} —{" "}
                    <span style={{ color: "#94a3b8" }}>{mapping.cohort_name}</span>
                  </td>

                  <td>
                    {mapping.assignment_code} —{" "}
                    <span style={{ color: "#94a3b8" }}>{mapping.assignment_title}</span>
                  </td>

                  <td>{mapping.level_code}</td>

                  <td>
                    <span className={`status-badge ${mapping.is_active ? 'status-active' : 'status-inactive'}`}>
                      {mapping.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td>
                    {mapping.has_submissions ? (
                      <span style={{ color: "#60a5fa" }}>Used by submissions</span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>Not used</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}