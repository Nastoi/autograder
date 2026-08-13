import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router";

import "../css/AssessmentMappings.css";

import {
  createAssessmentMapping,
  getAssessmentMappings,
  getCohorts,
  getModuleAssignments,
  type AssessmentMapping,
  type Cohort,
  type ModuleAssignment,
} from "../api/lms";

export function CreateAssessmentMappingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [assignments, setAssignments] =
    useState<ModuleAssignment[]>([]);
  const [existingMappings, setExistingMappings] =
    useState<AssessmentMapping[]>([]);

  const [cohortId, setCohortId] = useState("");
  const [selectedAssignmentIds, setSelectedAssignmentIds] =
    useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [cohortData, mappingData] = await Promise.all([
          getCohorts(),
          getAssessmentMappings(),
        ]);

        setCohorts(cohortData);
        setExistingMappings(mappingData);

        const cohortFromUrl = searchParams.get("cohort");

        if (cohortFromUrl) {
          setCohortId(cohortFromUrl);

          const selectedCohort = cohortData.find(
            (cohort) =>
              cohort.id.toString() === cohortFromUrl,
          );

          if (selectedCohort) {
            const assignmentData =
              await getModuleAssignments(
                selectedCohort.module,
              );

            setAssignments(assignmentData);
          }
        }
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load assessment mapping setup.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadInitialData();
  }, [searchParams]);

  async function handleCohortChange(
    selectedCohortId: string,
  ) {
    setCohortId(selectedCohortId);
    setSelectedAssignmentIds([]);
    setAssignments([]);
    setError("");

    if (!selectedCohortId) {
      return;
    }

    const selectedCohort = cohorts.find(
      (cohort) =>
        cohort.id.toString() === selectedCohortId,
    );

    if (!selectedCohort) {
      setError("Selected cohort was not found.");
      return;
    }

    try {
      await getModuleAssignments(
        selectedCohort.module,
      );

      setAssignments(data);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load assignments.",
      );
    }
  }

  const mappedAssignmentIds = new Set(
    existingMappings
      .filter(
        (mapping) =>
          mapping.cohort.toString() === cohortId,
      )
      .map((mapping) => mapping.assignment),
  );

  const availableAssignments = assignments.filter(
    (assignment) =>
      !mappedAssignmentIds.has(assignment.id),
  );

  function toggleAssignment(assignmentId: string) {
    setSelectedAssignmentIds((current) =>
      current.includes(assignmentId)
        ? current.filter((id) => id !== assignmentId)
        : [...current, assignmentId],
    );
  }

  function selectAllAssignments() {
    setSelectedAssignmentIds(
      availableAssignments.map(
        (assignment) => assignment.id,
      ),
    );
  }

  function clearAssignments() {
    setSelectedAssignmentIds([]);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !cohortId ||
      selectedAssignmentIds.length === 0
    ) {
      setError(
        "Please select a cohort and at least one assignment.",
      );
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await Promise.all(
        selectedAssignmentIds.map((assignmentId) =>
          createAssessmentMapping({
            cohort: cohortId,
            assignment: assignmentId,
            is_active: true,
          }),
        ),
      );

      navigate("/admin/cohorts", {
        replace: true,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to assign assessments.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="admin-container">
        Loading assessment setup...
      </main>
    );
  }

  const selectedCohort = cohorts.find(
    (cohort) =>
      cohort.id.toString() === cohortId,
  );

  return (
    <main className="admin-container">
      <div className="admin-header">
        <div>
          <h1>Assign Assessments</h1>
          <p className="section-description">
            Select multiple assignments and add them to one cohort.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      <section className="assignment-workspace">
        <div className="workspace-panel">
          <form
            onSubmit={handleSubmit}
            className="modern-form assignment-create-form"
          >
            <div className="form-group">
              <label htmlFor="cohort">
                Cohort
              </label>

              <select
                id="cohort"
                value={cohortId}
                onChange={(event) =>
                  void handleCohortChange(
                    event.target.value,
                  )
                }
                required
              >
                <option value="">Select cohort</option>

                {cohorts.map((cohort) => (
                  <option
                    key={cohort.id}
                    value={cohort.id}
                  >
                    {cohort.qualification_code}
                    {" → "}
                    {cohort.module_code}
                    {" → "}
                    {cohort.cohort_code}
                  </option>
                ))}
              </select>
            </div>

            {selectedCohort && (
              <div className="detail-block">
                <span className="detail-label">
                  Selected cohort
                </span>
                <strong>
                  {selectedCohort.cohort_code} —{" "}
                  {selectedCohort.cohort_name}
                </strong>
              </div>
            )}

            {cohortId && (
              <>
                <div className="section-header">
                  <div>
                    <h2>Available assignments</h2>
                    <p className="section-description">
                      Already-mapped assignments are hidden.
                    </p>
                  </div>

                  {availableAssignments.length > 0 && (
                    <div className="section-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={selectAllAssignments}
                      >
                        Select All
                      </button>

                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={clearAssignments}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {availableAssignments.length === 0 ? (
                  <p>
                    All assignments for this module are already
                    mapped to this cohort.
                  </p>
                ) : (
                  <div className="assignment-checkbox-list">
                    {availableAssignments.map(
                      (assignment) => (
                        <label
                          key={assignment.id}
                          className="assignment-checkbox-card"
                        >
                          <input
                            type="checkbox"
                            checked={selectedAssignmentIds.includes(
                              assignment.id,
                            )}
                            onChange={() =>
                              toggleAssignment(
                                assignment.id,
                              )
                            }
                          />

                          <span>
                            <strong>
                              {assignment.assignment_code}
                            </strong>
                            <small>
                              {assignment.assignment_title}
                            </small>
                          </span>
                        </label>
                      ),
                    )}
                  </div>
                )}
              </>
            )}

            <div className="form-actions">
              <button
                type="submit"
                className="btn-primary"
                disabled={
                  isSubmitting ||
                  !cohortId ||
                  selectedAssignmentIds.length === 0
                }
              >
                {isSubmitting
                  ? "Assigning..."
                  : `Assign ${selectedAssignmentIds.length} assessment${selectedAssignmentIds.length === 1
                    ? ""
                    : "s"
                  }`}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  navigate("/admin/cohorts")
                }
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
