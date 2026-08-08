import { useEffect, useState } from "react";
// import { useNavigate } from "react-router";

import {
  getAssessmentMappings,
  type AssessmentMapping,
} from "../api/lms";
import "../css/AssessmentMappings.css";

export function AssessmentMappingsPage() {
  // const navigate = useNavigate();

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

  function getSubmissionUrl(mappingId: string) {
    return `${window.location.origin}/submit/mapping/${mappingId}`;
  }

  async function handleCopySubmissionUrl(mappingId: string) {
    const url = getSubmissionUrl(mappingId);

    await navigator.clipboard.writeText(url);
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
          <p style={{ color: "#64748b" }}>No assessment mappings have been created yet.</p>
        </section>
      ) : (
        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Cohort</th>
                <th>Assignment</th>
                <th>Status</th>
                <th>Usage</th>
                <th>Url</th>
                <th>Embed</th>
              </tr>
            </thead>

            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.id}>
                  <td style={{ fontWeight: 500 }}>{mapping.name}</td>

                  <td>
                    {mapping.cohort_code} —{" "}
                    <span style={{ color: "#64748b" }}>{mapping.cohort_name}</span>
                  </td>

                  <td>
                    {mapping.assignment_code} —{" "}
                    <span style={{ color: "#64748b" }}>{mapping.assignment_title}</span>
                  </td>


                  <td>
                    <span className={`status-badge ${mapping.is_active ? 'status-active' : 'status-inactive'}`}>
                      {mapping.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td>
                    {mapping.has_submissions ? (
                      <span style={{ color: "#2563eb" }}>Used by submissions</span>
                    ) : (
                      <span style={{ color: "#64748b" }}>Not used</span>
                    )}
                  </td>

                  <td>
                    <span
                      className="mapping-url-text"
                      onClick={(event) => {
                        const selection = window.getSelection();
                        const range = document.createRange();

                        range.selectNodeContents(event.currentTarget);

                        selection?.removeAllRanges();
                        selection?.addRange(range);
                      }}
                    >
                      {getSubmissionUrl(mapping.id)}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="mapping-copy-button"
                      onClick={() => handleCopySubmissionUrl(mapping.id)}
                    >
                      Copy URL
                    </button>

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

