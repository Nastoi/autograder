import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router";

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

  const [selectedCohortId, setSelectedCohortId] =
    useState<number | null>(null);
  const [showCreateCohort, setShowCreateCohort] = useState(false);

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
    (cohort) => cohort.id === selectedCohortId,
  );

  const selectedCohortMappings = mappings.filter(
    (mapping) => mapping.cohort === selectedCohortId,
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

  function getSubmissionUrl(mappingId: string) {
    return `${window.location.origin}/submit/mapping/${mappingId}`;
  }

  async function copyUrl(mappingId: string) {
    await navigator.clipboard.writeText(
      getSubmissionUrl(mappingId),
    );
  }


  if (isLoading) {
    return (
      <main className="admin-container">
        Loading cohorts...
      </main>
    );
  }

  return (
    <main className="admin-container">
      <div className="admin-header">
        <div>
          <h1>Cohorts</h1>
          <p className="section-description">
            Create cohorts, assign assessments and manage submission URLs.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            setShowCreateCohort((current) => !current)
          }
        >
          {showCreateCohort ? "Close" : "+ New Cohort"}
        </button>
      </div>

      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      {showCreateCohort && (
        <section className="workspace-section">
          <form
            onSubmit={handleSubmit}
            className="modern-form assignment-create-form"
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
                      {module.code} - {module.name}
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

            <div className="form-actions">
              <button
                type="submit"
                className="btn-primary"
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

      <section className="page-section">
        <div className="section-header">
          <div>
            <h2>Existing cohorts</h2>
            <p className="section-description">
              Select a cohort to view its mapped assessments and URLs.
            </p>
          </div>
        </div>

        {cohorts.length === 0 ? (
          <p>No cohorts found.</p>
        ) : (
          <div className="table-container">
            <table className="modern-table">
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
                {cohorts.map((cohort) => {
                  const mappingCount = mappings.filter(
                    (mapping) => mapping.cohort === cohort.id,
                  ).length;

                  return (
                    <tr
                      key={cohort.id}
                      className={
                        selectedCohortId === cohort.id
                          ? "selected-row"
                          : ""
                      }
                      onClick={() =>
                        setSelectedCohortId(cohort.id)
                      }
                      style={{ cursor: "pointer" }}
                    >
                      <td>{cohort.qualification_code}</td>
                      <td>{cohort.module_code}</td>
                      <td>{cohort.cohort_code}</td>
                      <td>{cohort.cohort_name}</td>
                      <td>
                        {cohort.start_date || "—"} to{" "}
                        {cohort.end_date || "—"}
                      </td>
                      <td>{mappingCount}</td>
                      <td>
                        <span
                          className={
                            cohort.is_active
                              ? "status-badge status-active"
                              : "status-badge status-inactive"
                          }
                        >
                          {cohort.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedCohort && (
        <section className="assignment-workspace">
          <div className="section-header">
            <div>
              <h2>
                {selectedCohort.cohort_code} —{" "}
                {selectedCohort.cohort_name}
              </h2>

              <p className="section-description">
                {selectedCohort.qualification_code}
                {" → "}
                {selectedCohort.module_code}
              </p>
            </div>

            <div className="section-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  navigate(
                    `/admin/mappings/new?cohort=${selectedCohort.id}`,
                  )
                }
              >
                Assign assessments
              </button>


            </div>
          </div>

          <div className="workspace-panel">
            {selectedCohortMappings.length === 0 ? (
              <p>No assignments mapped to this cohort.</p>
            ) : (
              <div className="table-container">
                <table className="modern-table">
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
                        <td>
                          {mapping.assignment_code} —{" "}
                          {mapping.assignment_title}
                        </td>

                        <td>
                          <span
                            className={
                              mapping.is_active
                                ? "status-badge status-active"
                                : "status-badge status-inactive"
                            }
                          >
                            {mapping.is_active
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td>
                          <span className="mapping-url-text">
                            {getSubmissionUrl(mapping.id)}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="mapping-copy-button"
                            onClick={() =>
                              void copyUrl(mapping.id)
                            }
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
          </div>
        </section>
      )}
    </main>
  );
}
