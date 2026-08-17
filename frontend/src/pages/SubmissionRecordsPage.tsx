import {
  Fragment,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";

import "../css/AssessmentMappings.css";
import "../css/SubmissionRecordsPage.css";

import {
  getAssessmentMappings,
  type AssessmentMapping,
} from "../api/lms";
import {
  getAdminSubmissionRecords,
  type AdminSubmissionRecordsResponse,
} from "../api/adminSubmissionRecords";
import { jsPDF } from "jspdf";
type RecordsTab = "records" | "gradebook";


function displayStatus(status: string, fallback: string) {
  if (status === "completed" || status === "graded") {
    return "Graded";
  }

  if (status === "error" || status === "failed") {
    return "Not Graded";
  }

  if (status === "uploaded" || status === "processing") {
    return "Processing";
  }

  if (status === "manual_review") {
    return "Manual Review";
  }

  return fallback;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatResult(
  score: string | null,
  maximumScore: string | null,
) {
  if (
    score === null ||
    maximumScore === null
  ) {
    return "Pending";
  }

  const numericScore = Number(score);
  const numericMaximum = Number(maximumScore);

  if (
    !Number.isFinite(numericScore) ||
    !Number.isFinite(numericMaximum) ||
    numericMaximum <= 0
  ) {
    return "Pending";
  }

  const percentage =
    (numericScore / numericMaximum) * 100;

  return `${percentage.toFixed(2)} / 100`;
}

function percentageFromAttempt(attempt: {
  final_score: string | null;
  maximum_score: string | null;
}) {
  if (
    attempt.final_score === null ||
    attempt.maximum_score === null
  ) {
    return null;
  }

  const score = Number(attempt.final_score);
  const maximum = Number(attempt.maximum_score);

  if (
    !Number.isFinite(score) ||
    !Number.isFinite(maximum) ||
    maximum <= 0
  ) {
    return null;
  }

  return (score / maximum) * 100;
}

export function SubmissionRecordsPage() {
  const [data, setData] =
    useState<AdminSubmissionRecordsResponse | null>(null);
  const [mappings, setMappings] =
    useState<AssessmentMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] =
    useState<RecordsTab>("records");

  const [search, setSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("");

  const [expandedCohorts, setExpandedCohorts] =
    useState<string[]>([]);
  const [expandedAssignments, setExpandedAssignments] =
    useState<string[]>([]);
  const [expandedLearners, setExpandedLearners] =
    useState<string[]>([]);

  useEffect(() => {
    async function loadRecords() {
      setIsLoading(true);
      setError("");

      try {
        const [recordsResponse, mappingResponse] =
          await Promise.all([
            getAdminSubmissionRecords(),
            getAssessmentMappings(),
          ]);

        setData(recordsResponse);
        setMappings(mappingResponse);
        setExpandedCohorts(
          recordsResponse.cohorts.map(
            (cohort) => cohort.id,
          ),
        );
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load submission records.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadRecords();
  }, []);

  const assignmentOptions = useMemo(() => {
    if (!data) return [];

    const seen = new Map<
      string,
      { id: string; label: string }
    >();

    data.cohorts.forEach((cohort) => {
      cohort.assignments.forEach((assignment) => {
        if (!seen.has(assignment.id)) {
          seen.set(assignment.id, {
            id: assignment.id,
            label: `${assignment.code} — ${assignment.title}`,
          });
        }
      });
    });

    return Array.from(seen.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [data]);

  const filteredCohorts = useMemo(() => {
    if (!data) return [];

    const query = search.trim().toLowerCase();

    return data.cohorts
      .filter(
        (cohort) =>
          !cohortFilter || cohort.id === cohortFilter,
      )
      .map((cohort) => ({
        ...cohort,
        assignments: cohort.assignments
          .filter(
            (assignment) =>
              !assignmentFilter ||
              assignment.id === assignmentFilter,
          )
          .map((assignment) => ({
            ...assignment,
            learners: assignment.learners.filter((learner) => {
              if (!query) return true;

              return [
                cohort.code,
                cohort.name,
                assignment.code,
                assignment.title,
                learner.learner_id,
                learner.name,
                learner.email,
              ]
                .join(" ")
                .toLowerCase()
                .includes(query);
            }),
          }))
          .filter(
            (assignment) =>
              assignment.learners.length > 0 || !query,
          ),
      }))
      .filter((cohort) => cohort.assignments.length > 0);
  }, [data, search, cohortFilter, assignmentFilter]);

  const gradebookCohorts = useMemo(() => {
    if (!data) return [];

    const query = search.trim().toLowerCase();

    return data.cohorts
      .filter(
        (cohort) =>
          !cohortFilter || cohort.id === cohortFilter,
      )
      .map((cohort) => {
        const cohortMappings = mappings.filter(
          (mapping) =>
            mapping.cohort.toString() === cohort.id &&
            mapping.assignment_contributes_to_final_mark &&
            Number(mapping.final_mark_weight || 0) > 0,
        );

        const contributingAssignments = cohortMappings
          .map((mapping) => {
            const assignment = cohort.assignments.find(
              (item) => item.id === mapping.assignment,
            );

            if (!assignment) return null;

            return {
              ...assignment,
              weight: Number(
                mapping.final_mark_weight || 0,
              ),
            };
          })
          .filter(
            (
              assignment,
            ): assignment is NonNullable<typeof assignment> =>
              assignment !== null,
          );

        const learnerMap = new Map<
          string,
          {
            id: string;
            learner_id: string;
            name: string;
            email: string;
          }
        >();

        // Final Gradebook uses the cohort learner list returned by the
        // backend, so learners with no submissions still appear with 0.
        const gradebookCohort = data.gradebook_cohorts.find(
          (item) => item.id === cohort.id,
        );

        gradebookCohort?.learners.forEach((learner) => {
          learnerMap.set(learner.id, {
            id: learner.id,
            learner_id: learner.learner_id,
            name: learner.name,
            email: learner.email,
          });
        });

        // Keep submission learners as a safe fallback in case an older
        // context record is missing from gradebook_cohorts.
        cohort.assignments.forEach((assignment) => {
          assignment.learners.forEach((learner) => {
            if (!learnerMap.has(learner.id)) {
              learnerMap.set(learner.id, {
                id: learner.id,
                learner_id: learner.learner_id,
                name: learner.name,
                email: learner.email,
              });
            }
          });
        });

        const learners = Array.from(
          learnerMap.values(),
        )
          .map((learner) => {
            const assignmentScores =
              contributingAssignments.map((assignment) => {
                const assignmentLearner =
                  assignment.learners.find(
                    (item) => item.id === learner.id,
                  );

                const bestPercentage = assignmentLearner
                  ? assignmentLearner.attempts.reduce(
                    (best, attempt) => {
                      const percentage =
                        percentageFromAttempt(attempt);

                      if (percentage === null) {
                        return best;
                      }

                      return Math.max(
                        best,
                        percentage,
                      );
                    },
                    0,
                  )
                  : 0;

                return {
                  assignmentId: assignment.id,
                  percentage: bestPercentage,
                  weightedContribution:
                    bestPercentage *
                    (assignment.weight / 100),
                };
              });

            const finalScore = assignmentScores.reduce(
              (total, item) =>
                total + item.weightedContribution,
              0,
            );

            return {
              ...learner,
              assignmentScores,
              finalScore,
            };
          })
          .filter((learner) => {
            if (!query) return true;

            return [
              cohort.code,
              cohort.name,
              learner.learner_id,
              learner.name,
              learner.email,
            ]
              .join(" ")
              .toLowerCase()
              .includes(query);
          });

        return {
          ...cohort,
          contributingAssignments,
          learners,
        };
      })
      .filter(
        (cohort) =>
          cohort.contributingAssignments.length > 0,
      );
  }, [data, mappings, search, cohortFilter]);

  function toggleItem(
    id: string,
    setter: React.Dispatch<
      React.SetStateAction<string[]>
    >,
  ) {
    setter((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  if (isLoading) {
    return (
      <main className="admin-container">
        Loading submission records...
      </main>
    );
  }

  return (
    <main className="admin-container">
      <div className="admin-header">
        <div>
          <h1>Submission Records</h1>
          <p className="section-description">
            Review learner submission attempts and cohort final grades.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      {data && (
        <>
          <div
            className="workspace-tabs"
            style={{ marginBottom: "24px" }}
          >
            <button
              type="button"
              className={
                activeTab === "records"
                  ? "workspace-tab active"
                  : "workspace-tab"
              }
              onClick={() => setActiveTab("records")}
            >
              Submission Records
            </button>

            <button
              type="button"
              className={
                activeTab === "gradebook"
                  ? "workspace-tab active"
                  : "workspace-tab"
              }
              onClick={() => {
                setActiveTab("gradebook");
                setAssignmentFilter("");
              }}
            >
              Final Gradebook
            </button>
          </div>

          {activeTab === "records" && (
            <section className="submission-record-metrics">
              <div className="submission-record-metric">
                <span>Cohorts</span>
                <strong>{data.summary.cohorts}</strong>
              </div>
              <div className="submission-record-metric">
                <span>Assignments</span>
                <strong>{data.summary.assignments}</strong>
              </div>
              <div className="submission-record-metric">
                <span>Unique learners</span>
                <strong>{data.summary.unique_learners}</strong>
              </div>
              <div className="submission-record-metric">
                <span>Total attempts</span>
                <strong>{data.summary.total_attempts}</strong>
              </div>
            </section>
          )}

          <section className="submission-record-filters content-card">
            <div className="submission-record-search">
              <Search size={16} />
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search learner or cohort..."
              />
            </div>

            <select
              value={cohortFilter}
              onChange={(event) => {
                setCohortFilter(event.target.value);
                setAssignmentFilter("");
              }}
            >
              <option value="">All cohorts</option>
              {data.cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.code} — {cohort.name}
                </option>
              ))}
            </select>

            {activeTab === "records" && (
              <select
                value={assignmentFilter}
                onChange={(event) =>
                  setAssignmentFilter(event.target.value)
                }
              >
                <option value="">All assignments</option>
                {assignmentOptions.map((assignment) => (
                  <option
                    key={assignment.id}
                    value={assignment.id}
                  >
                    {assignment.label}
                  </option>
                ))}
              </select>
            )}
          </section>

          {activeTab === "records" ? (
            <section className="submission-record-list">
              {filteredCohorts.length === 0 ? (
                <div className="empty-state">
                  No submission records match the current filters.
                </div>
              ) : (
                filteredCohorts.map((cohort) => {
                  const cohortOpen =
                    expandedCohorts.includes(cohort.id);

                  return (
                    <article
                      key={cohort.id}
                      className="submission-cohort-card content-card"
                    >
                      <button
                        type="button"
                        className="submission-group-heading"
                        onClick={() =>
                          toggleItem(
                            cohort.id,
                            setExpandedCohorts,
                          )
                        }
                      >
                        <span className="submission-heading-icon">
                          {cohortOpen ? (
                            <ChevronDown size={18} />
                          ) : (
                            <ChevronRight size={18} />
                          )}
                        </span>

                        <span>
                          <small>Cohort</small>
                          <strong>
                            {cohort.code} — {cohort.name}
                          </strong>
                        </span>

                        <span className="submission-heading-count">
                          {cohort.assignments.length} assignment
                          {cohort.assignments.length === 1
                            ? ""
                            : "s"}
                        </span>
                      </button>

                      {cohortOpen && (
                        <div className="submission-assignment-list">
                          {cohort.assignments.map((assignment) => {
                            const assignmentKey =
                              `${cohort.id}:${assignment.id}`;
                            const assignmentOpen =
                              expandedAssignments.includes(
                                assignmentKey,
                              );

                            return (
                              <div
                                key={assignmentKey}
                                className="submission-assignment-card"
                              >
                                <button
                                  type="button"
                                  className="submission-assignment-heading"
                                  onClick={() =>
                                    toggleItem(
                                      assignmentKey,
                                      setExpandedAssignments,
                                    )
                                  }
                                >
                                  <span className="submission-heading-icon">
                                    {assignmentOpen ? (
                                      <ChevronDown size={17} />
                                    ) : (
                                      <ChevronRight size={17} />
                                    )}
                                  </span>

                                  <span className="submission-assignment-title">
                                    <small>Assignment</small>
                                    <strong>
                                      {assignment.code} —{" "}
                                      {assignment.title}
                                    </strong>
                                  </span>

                                  <span className="submission-assignment-stats">
                                    <span>
                                      <strong>
                                        {assignment.unique_learners}
                                      </strong>
                                      learners
                                    </span>
                                    <span>
                                      <strong>
                                        {assignment.total_attempts}
                                      </strong>
                                      attempts
                                    </span>
                                  </span>
                                </button>

                                {assignmentOpen && (
                                  <div className="submission-learner-list">
                                    {assignment.learners.map(
                                      (learner) => {
                                        const learnerKey =
                                          `${assignmentKey}:${learner.id}`;
                                        const learnerOpen =
                                          expandedLearners.includes(
                                            learnerKey,
                                          );

                                        return (
                                          <div
                                            key={learnerKey}
                                            className="submission-learner-card"
                                          >
                                            <button
                                              type="button"
                                              className="submission-learner-heading"
                                              onClick={() =>
                                                toggleItem(
                                                  learnerKey,
                                                  setExpandedLearners,
                                                )
                                              }
                                            >
                                              <span className="submission-heading-icon">
                                                {learnerOpen ? (
                                                  <ChevronDown
                                                    size={16}
                                                  />
                                                ) : (
                                                  <ChevronRight
                                                    size={16}
                                                  />
                                                )}
                                              </span>

                                              <span className="submission-learner-identity">
                                                <strong>
                                                  {learner.learner_id}
                                                </strong>
                                                <span>
                                                  {learner.name}
                                                </span>
                                                {learner.email && (
                                                  <small>
                                                    {learner.email}
                                                  </small>
                                                )}
                                              </span>

                                              <span className="submission-attempt-count">
                                                {learner.attempts.length}{" "}
                                                attempt
                                                {learner.attempts
                                                  .length === 1
                                                  ? ""
                                                  : "s"}
                                              </span>
                                            </button>

                                            {learnerOpen && (
                                              <div className="submission-attempt-table-wrap">
                                                <table className="submission-attempt-table">
                                                  <thead>
                                                    <tr>
                                                      <th>Attempt</th>
                                                      <th>Path</th>
                                                      <th>Status</th>
                                                      <th>Result</th>
                                                      <th>Band</th>
                                                      <th>Submitted</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {learner.attempts.map(
                                                      (attempt) => (
                                                        <Fragment key={attempt.id}>
                                                          <tr>
                                                            <td>
                                                              #{attempt.attempt_number}
                                                            </td>
                                                            <td>
                                                              <span className="submission-level-pill">
                                                                {attempt.level_name ||
                                                                  attempt.level_code}
                                                              </span>
                                                            </td>
                                                            <td>
                                                              {displayStatus(attempt.status, attempt.status_display)}
                                                            </td>
                                                            <td>
                                                              <strong>
                                                                {formatResult(
                                                                  attempt.final_score,
                                                                  attempt.maximum_score,
                                                                )}
                                                              </strong>
                                                            </td>
                                                            <td>
                                                              {attempt.achieved_band ||
                                                                "—"}
                                                            </td>
                                                            <td>
                                                              {formatDate(
                                                                attempt.submitted_at,
                                                              )}
                                                            </td>
                                                          </tr>

                                                          <tr className="submission-feedback-row">
                                                            <td colSpan={6}>
                                                              <div className="submission-feedback">
                                                                <span>Feedback</span>
                                                                <p>
                                                                  {attempt.feedback ||
                                                                    "No feedback available."}
                                                                </p>
                                                              </div>
                                                            </td>
                                                          </tr>
                                                        </Fragment>
                                                      ),
                                                    )}
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      },
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </section>
          ) : (
            <section className="submission-record-list">
              {gradebookCohorts.length === 0 ? (
                <div className="empty-state">
                  No contributing assignments are configured for the
                  selected cohort.
                </div>
              ) : (
                gradebookCohorts.map((cohort) => {
                  const allocation =
                    cohort.contributingAssignments.reduce(
                      (total, assignment) =>
                        total + assignment.weight,
                      0,
                    );

                  return (
                    <article
                      key={cohort.id}
                      className="submission-cohort-card content-card"
                    >
                      <div className="submission-group-heading">
                        <span>
                          <small>Cohort</small>
                          <strong>
                            {cohort.code} — {cohort.name}
                          </strong>
                        </span>

                        <span className="submission-heading-count">
                          Allocation: {allocation.toFixed(2)}%
                        </span>
                      </div>

                      <div
                        className="table-container"
                        style={{ overflowX: "auto" }}
                      >
                        <table className="modern-table">
                          <thead>
                            <tr>
                              <th>Learner</th>
                              {cohort.contributingAssignments.map(
                                (assignment) => (
                                  <th key={assignment.id}>
                                    {assignment.code}
                                    <small
                                      className="table-subtext"
                                      style={{ display: "block" }}
                                    >
                                      {assignment.weight.toFixed(2)}%
                                    </small>
                                  </th>
                                ),
                              )}
                              <th>Final</th>
                            </tr>
                          </thead>

                          <tbody>
                            {cohort.learners.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={
                                    cohort.contributingAssignments.length +
                                    2
                                  }
                                >
                                  No learners with submission records.
                                </td>
                              </tr>
                            ) : (
                              cohort.learners.map((learner) => (
                                <tr key={learner.id}>
                                  <td>
                                    <strong>
                                      {learner.learner_id}
                                    </strong>
                                    <span
                                      className="table-subtext"
                                      style={{ display: "block" }}
                                    >
                                      {learner.name}
                                    </span>
                                  </td>

                                  {cohort.contributingAssignments.map(
                                    (assignment) => {
                                      const score =
                                        learner.assignmentScores.find(
                                          (item) =>
                                            item.assignmentId ===
                                            assignment.id,
                                        );

                                      return (
                                        <td key={assignment.id}>
                                          {(
                                            score?.percentage ?? 0
                                          ).toFixed(2)}%
                                        </td>
                                      );
                                    },
                                  )}

                                  <td>
                                    <strong>
                                      {learner.finalScore.toFixed(2)}%
                                    </strong>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  );
                })
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
