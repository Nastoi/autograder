import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router";
import { Plus, Users, Link as LinkIcon, Copy, Search, X } from "lucide-react";

import {
  createCohort,
  getAssessmentMappings,
  getCohorts,
  getModules,
  getQualifications,
  type AssessmentMapping,
  type Cohort,
  type Module,
  type Qualification,
} from "../api/lms";

import "../css/AssessmentMappings.css";
import "../css/QualificationsPage.css"; // For modern UI classes

export function CohortsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [mappings, setMappings] = useState<AssessmentMapping[]>([]);

  const [qualificationId, setQualificationId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [cohortCode, setCohortCode] = useState("");
  const [cohortName, setCohortName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null);
  const [showCreateCohort, setShowCreateCohort] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  async function loadData() {
    try {
      const [
        cohortData,
        moduleData,
        qualificationData,
        mappingData,
      ] = await Promise.all([
        getCohorts(),
        getModules(),
        getQualifications(),
        getAssessmentMappings(),
      ]);

      setCohorts(cohortData);
      setModules(moduleData);
      setQualifications(qualificationData);
      setMappings(mappingData);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load cohorts.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const filteredModules = modules.filter(
    (module) =>
      !qualificationId ||
      module.qualification === qualificationId,
  );

  const selectedCohort = cohorts.find(
    (cohort) =>
      Number(cohort.id) === selectedCohortId,
  );

  const filteredCohorts = cohorts.filter((cohort) => {
    const term = searchTerm.toLowerCase();
    return (
      cohort.cohort_code.toLowerCase().includes(term) ||
      cohort.cohort_name.toLowerCase().includes(term) ||
      cohort.qualification_code.toLowerCase().includes(term) ||
      cohort.module_code.toLowerCase().includes(term)
    );
  });

  const selectedCohortMappings = mappings.filter(
    (mapping) =>
      Number(mapping.cohort) === selectedCohortId,
  );

  function handleQualificationChange(
    selectedQualificationId: string,
  ) {
    setQualificationId(selectedQualificationId);
    setModuleId("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      await createCohort({
        cohort_code: cohortCode,
        cohort_name: cohortName,
        module: moduleId,
        start_date: startDate || null,
        end_date: endDate || null,
        is_active: isActive,
      });

      setCohortCode("");
      setCohortName("");
      setStartDate("");
      setEndDate("");
      setIsActive(true);
      setQualificationId("");
      setModuleId("");
      setShowCreateCohort(false);

      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create cohort.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function copyLtiUrl(mappingId: string) {
    const publicUrl =
      import.meta.env.VITE_AUTOGRADER_PUBLIC_URL;

    const ltiUrl =
      `${publicUrl}/api/lms/lti/launch/${mappingId}/`;

    void navigator.clipboard.writeText(ltiUrl);
  }


  if (isLoading) {
    return (
      <main className="academic-main-centered">
        Loading cohorts...
      </main>
    );
  }

  return (
    <main className="academic-main-centered">
      <div className="academic-header">
        <div>
          <h1>Cohorts</h1>
          <p className="section-description">
            Create cohorts, assign assessments and manage submission URLs.
          </p>
        </div>

        <button
          type="button"
          className="btn-accent"
          onClick={() =>
            setShowCreateCohort((current) => !current)
          }
        >
          {showCreateCohort ? (
            "Close Form"
          ) : (
            <><Plus size={16} /> New Cohort</>
          )}
        </button>
      </div>

      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      {showCreateCohort && (
        <section className="workspace-section" style={{ marginBottom: '32px' }}>
          <form
            onSubmit={handleSubmit}
            className="modern-form assignment-create-form"
            style={{ maxWidth: '100%' }}
          >
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label htmlFor="cohort-qualification">
                  Qualification
                </label>
                <select
                  id="cohort-qualification"
                  value={qualificationId}
                  onChange={(event) =>
                    handleQualificationChange(event.target.value)
                  }
                  required
                >
                  <option value="">Select qualification</option>
                  {qualifications.map((qualification) => (
                    <option
                      key={qualification.id}
                      value={qualification.id}
                    >
                      {qualification.qualification_code} -{" "}
                      {qualification.qualification_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="cohort-module">
                  Module
                </label>
                <select
                  id="cohort-module"
                  value={moduleId}
                  onChange={(event) =>
                    setModuleId(event.target.value)
                  }
                  disabled={!qualificationId}
                  required
                >
                  <option value="">Select module</option>
                  {filteredModules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.module_code} - {module.module_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="cohort-code">
                  Cohort code
                </label>
                <input
                  id="cohort-code"
                  value={cohortCode}
                  onChange={(event) =>
                    setCohortCode(event.target.value)
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="cohort-name">
                  Cohort name
                </label>
                <input
                  id="cohort-name"
                  value={cohortName}
                  onChange={(event) =>
                    setCohortName(event.target.value)
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="cohort-start-date">
                  Start date
                </label>
                <input
                  id="cohort-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) =>
                    setStartDate(event.target.value)
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="cohort-end-date">
                  End date
                </label>
                <input
                  id="cohort-end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) =>
                    setEndDate(event.target.value)
                  }
                />
              </div>
            </div>

            <div className="checkbox-row">
              <label className="checkbox-group">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) =>
                    setIsActive(event.target.checked)
                  }
                />
                Active
              </label>
            </div>

            <div className="form-actions form-actions-compact">
              <button
                type="submit"
                className="btn-accent"
                disabled={
                  isSubmitting ||
                  !qualificationId ||
                  !moduleId
                }
              >
                {isSubmitting ? "Creating..." : "Create Cohort"}
              </button>

              <button
                type="button"
                className="btn-secondary"
                disabled={isSubmitting}
                onClick={() => setShowCreateCohort(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Cohorts Table Card */}
      <div className="content-card">
        <div className="content-card-header">
          <div className="content-title-section">
            <div className="content-icon">
              <Users size={20} />
            </div>
            <div className="content-title">
              <h2>Existing cohorts</h2>
              <p>Select a cohort to view its mapped assessments and URLs.</p>
            </div>
          </div>
          <div className="section-actions">
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                type="text"
                placeholder="Search cohorts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  paddingLeft: "32px",
                  height: "36px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  width: "250px",
                  fontSize: "14px",
                }}
              />
            </div>
          </div>
        </div>

        {cohorts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No cohorts found.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Qualification</th>
                <th>Module</th>
                <th>Code</th>
                <th>Name</th>
                <th>Dates</th>
                <th>Assessments</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCohorts.map((cohort) => {
                const mappingCount = mappings.filter(
                  (mapping) => mapping.cohort === cohort.id,
                ).length;

                return (
                  <tr
                    key={cohort.id}
                    onClick={() =>
                      setSelectedCohortId(Number(cohort.id))
                    }
                    style={{
                      cursor: "pointer",
                      backgroundColor:
                        selectedCohortId === Number(cohort.id)
                          ? "rgba(238, 242, 255, 0.5)"
                          : undefined,
                    }}
                  >
                    <td>{cohort.qualification_code}</td>
                    <td>{cohort.module_code}</td>
                    <td><span className="tag-pill">{cohort.cohort_code}</span></td>
                    <td style={{ fontWeight: 500, color: 'var(--text-h)' }}>{cohort.cohort_name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {cohort.start_date || "—"} to{" "}
                      {cohort.end_date || "—"}
                    </td>
                    <td style={{ fontWeight: 500 }}>{mappingCount}</td>
                    <td>
                      <span
                        className={`status-badge ${!cohort.is_active ? 'inactive' : ''}`}
                      >
                        <span className="status-dot"></span>
                        {cohort.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedCohort && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              zIndex: 9998,
            }}
            onClick={() => setSelectedCohortId(null)}
          />
          <section
            className="content-card"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '70%',
              margin: 0,
              zIndex: 9999,
              borderRadius: '16px 0 0 16px',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'white'
            }}
          >
            <div className="content-card-header" style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10 }}>
              <div className="content-title-section">
                <div className="content-title">
                  <h2>
                    {selectedCohort.cohort_code} — {selectedCohort.cohort_name}
                  </h2>
                  <p>
                    {selectedCohort.qualification_code} {" → "} {selectedCohort.module_code}
                  </p>
                </div>
              </div>

              <div className="section-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  type="button"
                  className="btn-action"
                  onClick={() =>
                    navigate(
                      `/admin/mappings/new?cohort=${selectedCohort.id}`,
                    )
                  }
                >
                  <LinkIcon size={16} /> Assign assessments
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCohortId(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  aria-label="Close panel"
                >
                  <X size={20} color="var(--text-muted)" />
                </button>
              </div>
            </div>

            <div style={{ padding: '24px', flex: 1 }}>
              {selectedCohortMappings.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>No assignments mapped to this cohort.</p>
              ) : (
                <table className="data-table" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <thead>
                    <tr>
                      <th>Assignment</th>
                      <th>Status</th>
                      <th>Submission URL</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedCohortMappings.map((mapping) => (
                      <tr key={mapping.id}>
                        <td
                          style={{
                            fontWeight: 500,
                            color: "var(--text-h)",
                          }}
                        >
                          {mapping.assignment_code} —{" "}
                          {mapping.assignment_title}
                        </td>

                        <td>
                          <span
                            className={`status-badge ${!mapping.is_active ? "inactive" : ""
                              }`}
                          >
                            <span className="status-dot"></span>
                            {mapping.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td>
                          <span
                            style={{
                              fontFamily: "monospace",
                              color: "var(--text-muted)",
                              fontSize: "13px",
                            }}
                          >
                            {`${import.meta.env.VITE_AUTOGRADER_PUBLIC_URL}/api/lms/lti/launch/${mapping.id}/`}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="btn-action"
                            onClick={() => copyLtiUrl(mapping.id)}
                          >
                            <Copy size={14} /> Copy LTI URL
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
