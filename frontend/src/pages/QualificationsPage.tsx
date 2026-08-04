import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  createQualification,
  getQualifications,
  type Qualification,
} from "../api/lms";
import "../css/AssessmentMappings.css";

export function QualificationsPage() {
  const [qualifications, setQualifications] = useState<
    Qualification[]
  >([]);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadQualifications() {
    try {
      const data = await getQualifications();
      setQualifications(data);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load qualifications.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadQualifications();
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      await createQualification({
        code,
        name,
        description,
        is_active: isActive,
      });

      setCode("");
      setName("");
      setDescription("");
      setIsActive(true);

      await loadQualifications();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create qualification.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="admin-container">
        <header className="admin-header">
          <h1>Qualifications</h1>
        </header>
        <p style={{ color: "#94a3b8" }}>Loading qualifications...</p>
      </main>
    );
  }

  return (
    <main className="admin-container">
      <header className="admin-header">
        <h1>Qualifications</h1>
      </header>

      <section style={{ marginBottom: "40px" }}>
        <h2 style={{ marginBottom: "20px", fontSize: "20px" }}>Add qualification</h2>

        <form onSubmit={handleSubmit} className="modern-form">
          <div className="form-group">
            <label htmlFor="qualification-code">Code</label>
            <input
              id="qualification-code"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="qualification-name">Name</label>
            <input
              id="qualification-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="qualification-description">Description</label>
            <textarea
              id="qualification-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="checkbox-group">
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Active Qualification
            </label>
          </div>

          {error && (
            <div style={{ color: "#ef4444", background: "rgba(239, 68, 68, 0.1)", padding: "12px", borderRadius: "8px", fontSize: "14px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
              {error}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Add qualification"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 style={{ marginBottom: "20px", fontSize: "20px" }}>Existing qualifications</h2>

        {qualifications.length === 0 ? (
          <div className="table-container" style={{ padding: "32px", textAlign: "center" }}>
            <p style={{ color: "#94a3b8" }}>No qualifications found.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Can delete</th>
                </tr>
              </thead>

              <tbody>
                {qualifications.map((qualification) => (
                  <tr key={qualification.id}>
                    <td style={{ fontWeight: 500, color: "#f8fafc" }}>{qualification.code}</td>
                    <td>{qualification.name}</td>
                    <td>
                      {qualification.is_active ? (
                        <span className="status-badge status-active">Active</span>
                      ) : (
                        <span className="status-badge status-inactive">Inactive</span>
                      )}
                    </td>
                    <td>
                      {qualification.can_delete ? (
                        <span style={{ color: "#94a3b8" }}>Yes</span>
                      ) : (
                        <span style={{ color: "#ef4444" }}>No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}