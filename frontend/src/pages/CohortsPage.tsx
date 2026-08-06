import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  createCohort,
  getCohorts,
  getModules,
  getQualifications,
  type Cohort,
  type Module,
  type Qualification,
} from "../api/lms";
import "../css/AssessmentMappings.css";

export function CohortsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [qualifications, setQualifications] = useState<
    Qualification[]
  >([]);

  const [qualificationId, setQualificationId] =
    useState("");
  const [moduleId, setModuleId] = useState("");
  const [cohortCode, setCohortCode] = useState("");
  const [cohortName, setCohortName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [error, setError] = useState("");

  const filteredModules = modules.filter(
    (module) =>
      !qualificationId ||
      module.qualification === qualificationId,
  );

  async function loadData() {
    try {
      const [
        cohortData,
        moduleData,
        qualificationData,
      ] = await Promise.all([
        getCohorts(),
        getModules(),
        getQualifications(),
      ]);

      setCohorts(cohortData);
      setModules(moduleData);
      setQualifications(qualificationData);
    } catch (caughtError: any) {
      if (caughtError instanceof SyntaxError && caughtError.message.includes('Unexpected token')) {
        setError(`Parse Error: The server returned HTML instead of JSON. Check your backend terminal for a 500 error or check your API_BASE_URL. (Error: ${caughtError.message})`);
      } else {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load cohorts.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

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

  if (isLoading) {
    return <main className="admin-container">Loading cohorts...</main>;
  }

  return (
    <main className="admin-container">
      <div className="admin-header">
        <h1>Cohorts</h1>
      </div>

      <div className="admin-split-layout">
        <section>
          <h2 style={{ marginBottom: "16px", color: "#112642" }}>Add cohort</h2>

          <form onSubmit={handleSubmit} className="modern-form">
            <div className="form-group">
              <label htmlFor="cohort-qualification">
                Qualification
              </label>

              <select
                id="cohort-qualification"
                value={qualificationId}
                onChange={(event) =>
                  handleQualificationChange(
                    event.target.value,
                  )
                }
                required
              >
                <option value="">
                  Select qualification
                </option>

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
                <option value="">
                  Select module
                </option>

                {filteredModules.map((module) => (
                  <option
                    key={module.id}
                    value={module.id}
                  >
                    {module.code} - {module.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="cohort-code">Cohort code
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
              <label htmlFor="cohort-name">Cohort name</label>

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

            <div className="form-group">
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

            {error && <p role="alert" style={{ color: "#ef4444" }}>{error}</p>}

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
                {isSubmitting
                  ? "Creating..."
                  : "Add cohort"}
              </button>
            </div>
          </form>
        </section>

        <section style={{ marginTop: "40px" }}>
          <h2 style={{ marginBottom: "16px", color: "#112642" }}>Existing cohorts</h2>

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
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {cohorts.map((cohort) => (
                    <tr key={cohort.id}>
                      <td>
                        {cohort.qualification_code}
                      </td>

                      <td>{cohort.module_code}</td>

                      <td>{cohort.cohort_code}</td>

                      <td>{cohort.cohort_name}</td>

                      <td>
                        {cohort.start_date || "—"} to{" "}
                        {cohort.end_date || "—"}
                      </td>

                      <td>
                        {cohort.is_active
                          ? "Active"
                          : "Inactive"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}