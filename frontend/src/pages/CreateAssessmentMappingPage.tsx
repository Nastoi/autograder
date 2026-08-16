import {
  useEffect,
  useMemo,
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
  type LtiConfiguration = {
    clientId: string;
    deploymentId: string;
    jwksUrl: string;
    accessTokenUrl: string;
  };

  const [ltiConfigurations, setLtiConfigurations] =
    useState<Record<string, LtiConfiguration>>({});

  const [finalMarkWeights, setFinalMarkWeights] =
    useState<Record<string, string>>({});

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
    setFinalMarkWeights({});
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
      const data = await getModuleAssignments(
        selectedCohort.module,
      );

      setAssignments(data);
    }
    catch (caughtError) {
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

  const existingContributionTotal = useMemo(() => {
    if (!cohortId) return 0;

    return existingMappings
      .filter(
        (mapping) =>
          mapping.cohort.toString() === cohortId,
      )
      .reduce((total, mapping) => {
        const assignment = assignments.find(
          (item) => item.id === mapping.assignment,
        );

        if (!assignment?.contributes_to_final_mark) {
          return total;
        }

        return total + Number(mapping.final_mark_weight || 0);
      }, 0);
  }, [assignments, cohortId, existingMappings]);

  const selectedContributionTotal = selectedAssignmentIds.reduce(
    (total, assignmentId) => {
      const assignment = assignments.find(
        (item) => item.id === assignmentId,
      );

      if (!assignment?.contributes_to_final_mark) {
        return total;
      }

      return total + Number(finalMarkWeights[assignmentId] || 0);
    },
    0,
  );

  const finalContributionTotal =
    existingContributionTotal + selectedContributionTotal;

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

    if (finalContributionTotal > 100.0001) {
      setError("Final mark allocation cannot exceed 100%.");
      return;
    }

    const contributingWithoutWeight =
      selectedAssignmentIds.find((assignmentId) => {
        const assignment = assignments.find(
          (item) => item.id === assignmentId,
        );

        return (
          assignment?.contributes_to_final_mark &&
          Number(finalMarkWeights[assignmentId] || 0) <= 0
        );
      });

    if (contributingWithoutWeight) {
      const assignment = assignments.find(
        (item) => item.id === contributingWithoutWeight,
      );

      setError(
        `Enter a final mark weight for ${
          assignment?.assignment_code ?? "the selected assignment"
        }.`,
      );
      return;
    }

    const incompleteLtiAssignment =
      selectedAssignmentIds.find((assignmentId) => {
        const lti = ltiConfigurations[assignmentId];

        return (
          !lti?.clientId.trim() ||
          !lti?.deploymentId.trim() ||
          !lti?.jwksUrl.trim() ||
          !lti?.accessTokenUrl.trim()
        );
      });

    if (incompleteLtiAssignment) {
      const assignment = assignments.find(
        (item) => item.id === incompleteLtiAssignment,
      );

      setError(
        `Please complete all LTI fields for ${assignment?.assignment_code ?? "the selected assignment"
        }.`,
      );

      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await Promise.all(
        selectedAssignmentIds.map((assignmentId) => {
          const lti = ltiConfigurations[assignmentId];

          const assignment = assignments.find(
            (item) => item.id === assignmentId,
          );

          return createAssessmentMapping({
            cohort: cohortId,
            assignment: assignmentId,
            final_mark_weight:
              assignment?.contributes_to_final_mark
                ? (finalMarkWeights[assignmentId] || "0")
                : "0",
            lti_client_id: lti?.clientId ?? "",
            lti_deployment_id: lti?.deploymentId ?? "",
            lti_jwks_url: lti?.jwksUrl ?? "",
            lti_access_token_url: lti?.accessTokenUrl ?? "",
            is_active: true,
          });
        }),
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
              <>
                <div className="detail-block">
                  <span className="detail-label">
                    Selected cohort
                  </span>
                  <strong>
                    {selectedCohort.cohort_code} —{" "}
                    {selectedCohort.cohort_name}
                  </strong>
                </div>

                <div className="detail-block">
                  <span className="detail-label">
                    Final mark allocation
                  </span>
                  <strong>
                    {finalContributionTotal.toFixed(2)}%
                  </strong>
                  <small className="table-subtext">
                    Existing: {existingContributionTotal.toFixed(2)}%.
                    Total may stay below 100% while setup is incomplete,
                    but it cannot exceed 100%.
                  </small>
                </div>
              </>
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
                      (assignment: ModuleAssignment) => (
                        <div
                          key={assignment.id}
                          className="assignment-checkbox-card"
                        >
                          <label>
                            <input
                              type="checkbox"
                              checked={selectedAssignmentIds.includes(
                                assignment.id,
                              )}
                              onChange={() =>
                                toggleAssignment(assignment.id)
                              }
                            />

                            <span>
                              <strong>
                                {assignment.assignment_code}
                              </strong>

                              <small>
                                {assignment.assignment_title}
                              </small>
                              <small>
                                {assignment.contributes_to_final_mark
                                  ? "Contributes to final mark"
                                  : "Does not contribute to final mark"}
                              </small>
                            </span>
                          </label>

                          {selectedAssignmentIds.includes(
                            assignment.id,
                          ) && (
                              <div className="modern-form">
                                {assignment.contributes_to_final_mark && (
                                  <div className="form-group">
                                    <label>Final mark weight (%)</label>
                                    <input
                                      type="number"
                                      min="0.01"
                                      max="100"
                                      step="0.01"
                                      value={finalMarkWeights[assignment.id] ?? ""}
                                      onChange={(event) =>
                                        setFinalMarkWeights((current) => ({
                                          ...current,
                                          [assignment.id]: event.target.value,
                                        }))
                                      }
                                      required
                                    />
                                  </div>
                                )}

                                <div className="form-grid form-grid-2">
                                  <div className="form-group">
                                    <label>Client ID</label>

                                    <input
                                      value={
                                        ltiConfigurations[assignment.id]
                                          ?.clientId ?? ""
                                      }
                                      onChange={(event) =>
                                        setLtiConfigurations(
                                          (current) => ({
                                            ...current,
                                            [assignment.id]: {
                                              clientId:
                                                event.target.value,
                                              deploymentId:
                                                current[assignment.id]
                                                  ?.deploymentId ?? "",
                                              jwksUrl:
                                                current[assignment.id]
                                                  ?.jwksUrl ?? "",
                                              accessTokenUrl:
                                                current[assignment.id]
                                                  ?.accessTokenUrl ?? "",
                                            },
                                          }),
                                        )
                                      }
                                      required
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Deployment ID</label>

                                    <input
                                      value={
                                        ltiConfigurations[assignment.id]
                                          ?.deploymentId ?? ""
                                      }
                                      onChange={(event) =>
                                        setLtiConfigurations(
                                          (current) => ({
                                            ...current,
                                            [assignment.id]: {
                                              clientId:
                                                current[assignment.id]
                                                  ?.clientId ?? "",
                                              deploymentId:
                                                event.target.value,
                                              jwksUrl:
                                                current[assignment.id]
                                                  ?.jwksUrl ?? "",
                                              accessTokenUrl:
                                                current[assignment.id]
                                                  ?.accessTokenUrl ?? "",
                                            },
                                          }),
                                        )
                                      }
                                      required
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Keyset URL</label>

                                    <input
                                      type="url"
                                      value={
                                        ltiConfigurations[assignment.id]
                                          ?.jwksUrl ?? ""
                                      }
                                      onChange={(event) =>
                                        setLtiConfigurations(
                                          (current) => ({
                                            ...current,
                                            [assignment.id]: {
                                              clientId:
                                                current[assignment.id]
                                                  ?.clientId ?? "",
                                              deploymentId:
                                                current[assignment.id]
                                                  ?.deploymentId ?? "",
                                              jwksUrl:
                                                event.target.value,
                                              accessTokenUrl:
                                                current[assignment.id]
                                                  ?.accessTokenUrl ?? "",
                                            },
                                          }),
                                        )
                                      }
                                      required
                                    />
                                  </div>

                                  <div className="form-group">
                                    <label>Access Token URL</label>

                                    <input
                                      type="url"
                                      value={
                                        ltiConfigurations[assignment.id]
                                          ?.accessTokenUrl ?? ""
                                      }
                                      onChange={(event) =>
                                        setLtiConfigurations(
                                          (current) => ({
                                            ...current,
                                            [assignment.id]: {
                                              clientId:
                                                current[assignment.id]
                                                  ?.clientId ?? "",
                                              deploymentId:
                                                current[assignment.id]
                                                  ?.deploymentId ?? "",
                                              jwksUrl:
                                                current[assignment.id]
                                                  ?.jwksUrl ?? "",
                                              accessTokenUrl:
                                                event.target.value,
                                            },
                                          }),
                                        )
                                      }
                                      required
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                        </div>
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
                  selectedAssignmentIds.length === 0 ||
                  finalContributionTotal > 100.0001
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
