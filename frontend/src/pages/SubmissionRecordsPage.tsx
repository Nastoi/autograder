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


function getLatestResultCounts(assignment: {
  learners: Array<{
    attempts: Array<{
      attempt_number: number;
      submitted_at: string;
      achieved_band: string;
      level_code: string;
    }>;
  }>;
}) {
  const counts = {
    failed: 0,
    foundation: 0,
    proficient_basic: 0,
    proficient_advanced: 0,
    expert: 0,
  };

  assignment.learners.forEach((learner) => {
    if (!learner.attempts.length) {
      return;
    }

    const latestAttempt = learner.attempts
      .slice()
      .sort((a, b) => {
        if (a.attempt_number !== b.attempt_number) {
          return b.attempt_number - a.attempt_number;
        }

        return (
          new Date(b.submitted_at).getTime() -
          new Date(a.submitted_at).getTime()
        );
      })[0];

    if (!latestAttempt) {
      return;
    }

    const band = (
      latestAttempt.achieved_band || ""
    ).trim().toLowerCase();

    const level = (
      latestAttempt.level_code || ""
    ).trim().toLowerCase();

    if (band === "failed") {
      counts.failed += 1;
    } else if (band === "foundation") {
      counts.foundation += 1;
    } else if (band === "proficient") {
      if (level === "basic") {
        counts.proficient_basic += 1;
      } else if (level === "advanced") {
        counts.proficient_advanced += 1;
      }
    } else if (band === "expert") {
      counts.expert += 1;
    }
  });

  return counts;
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

function formatTokenCount(
  value: number | null | undefined,
) {
  return new Intl.NumberFormat().format(Number(value ?? 0));
}


function getEstimatedApiCost(
  model: string,
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number,
) {
  const normalizedModel = model.trim().toLowerCase();

  const pricing: Record<
    string,
    {
      input: number;
      cachedInput: number;
      output: number;
    }
  > = {
    "gpt-4o-mini": {
      input: 0.15,
      cachedInput: 0.075,
      output: 0.60,
    },
    "gpt-4o-mini-2024-07-18": {
      input: 0.15,
      cachedInput: 0.075,
      output: 0.60,
    },
    "gpt-4o": {
      input: 2.50,
      cachedInput: 1.25,
      output: 10.00,
    },
    "gpt-4o-2024-08-06": {
      input: 2.50,
      cachedInput: 1.25,
      output: 10.00,
    },
    "gpt-4o-2024-11-20": {
      input: 2.50,
      cachedInput: 1.25,
      output: 10.00,
    },
  };

  const modelPricing = pricing[normalizedModel];

  if (!modelPricing) {
    return null;
  }

  const safeInputTokens = Math.max(inputTokens || 0, 0);
  const safeCachedInputTokens = Math.min(
    Math.max(cachedInputTokens || 0, 0),
    safeInputTokens,
  );
  const safeOutputTokens = Math.max(outputTokens || 0, 0);

  const uncachedInputTokens =
    safeInputTokens - safeCachedInputTokens;

  return (
    (uncachedInputTokens / 1_000_000) * modelPricing.input +
    (safeCachedInputTokens / 1_000_000) *
      modelPricing.cachedInput +
    (safeOutputTokens / 1_000_000) *
      modelPricing.output
  );
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
  const [expandedGradebookCohorts, setExpandedGradebookCohorts] =
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

    const cohortMap = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        mappedAssignments: Array<{
          id: string;
          mappingId: string;
          code: string;
          title: string;
          isSummative: boolean;
          contributesToFinalMark: boolean;
          weight: number;
        }>;
      }
    >();

    // Build the gradebook columns from AssessmentMappings, not from
    // submissions. This keeps every mapped assessment visible even when
    // nobody has submitted it yet.
    mappings.forEach((mapping) => {
      const cohortId = mapping.cohort.toString();

      if (cohortFilter && cohortId !== cohortFilter) {
        return;
      }

      if (!cohortMap.has(cohortId)) {
        cohortMap.set(cohortId, {
          id: cohortId,
          code: mapping.cohort_code,
          name: mapping.cohort_name,
          mappedAssignments: [],
        });
      }

      cohortMap.get(cohortId)!.mappedAssignments.push({
        id: mapping.assignment,
        mappingId: mapping.id,
        code: mapping.assignment_code,
        title: mapping.assignment_title,
        isSummative: mapping.assignment_is_summative,
        contributesToFinalMark:
          mapping.assignment_contributes_to_final_mark,
        weight: Number(mapping.final_mark_weight || 0),
      });
    });

    return Array.from(cohortMap.values())
      .map((cohort) => {
        const submissionCohort = data.cohorts.find(
          (item) => item.id === cohort.id,
        );
        const gradebookCohort = data.gradebook_cohorts.find(
          (item) => item.id === cohort.id,
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

        gradebookCohort?.learners.forEach((learner) => {
          learnerMap.set(learner.id, {
            id: learner.id,
            learner_id: learner.learner_id,
            name: learner.name,
            email: learner.email,
          });
        });

        // Submission learners are retained as a fallback for older data
        // where a submission exists but its active context is unavailable.
        submissionCohort?.assignments.forEach((assignment) => {
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

        const learners = Array.from(learnerMap.values())
          .map((learner) => {
            const assignmentScores = cohort.mappedAssignments.map(
              (mappedAssignment) => {
                const submissionAssignment =
                  submissionCohort?.assignments.find(
                    (item) => item.id === mappedAssignment.id,
                  );
                const assignmentLearner =
                  submissionAssignment?.learners.find(
                    (item) => item.id === learner.id,
                  );

                const latestAttempt = assignmentLearner?.attempts
                  .slice()
                  .sort((a, b) => {
                    if (a.attempt_number !== b.attempt_number) {
                      return b.attempt_number - a.attempt_number;
                    }

                    return (
                      new Date(b.submitted_at).getTime() -
                      new Date(a.submitted_at).getTime()
                    );
                  })[0];

                const percentage = latestAttempt
                  ? percentageFromAttempt(latestAttempt) ?? 0
                  : 0;

                const weightedContribution =
                  mappedAssignment.contributesToFinalMark &&
                    mappedAssignment.weight > 0
                    ? percentage * (mappedAssignment.weight / 100)
                    : 0;

                return {
                  assignmentId: mappedAssignment.id,
                  percentage,
                  weightedContribution,
                };
              },
            );

            return {
              ...learner,
              assignmentScores,
              finalScore: assignmentScores.reduce(
                (total, item) => total + item.weightedContribution,
                0,
              ),
            };
          })
          .filter((learner) => {
            if (!query) return true;

            const cohortOrAssignmentMatch = [
              cohort.code,
              cohort.name,
              ...cohort.mappedAssignments.flatMap((assignment) => [
                assignment.code,
                assignment.title,
              ]),
            ]
              .join(" ")
              .toLowerCase()
              .includes(query);

            if (cohortOrAssignmentMatch) return true;

            return [
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
          mappedAssignments: [...cohort.mappedAssignments].sort((a, b) =>
            a.code.localeCompare(b.code),
          ),
          learners,
        };
      })
      .filter((cohort) => {
        if (!query) return true;

        const cohortOrAssignmentMatch = [
          cohort.code,
          cohort.name,
          ...cohort.mappedAssignments.flatMap((assignment) => [
            assignment.code,
            assignment.title,
          ]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

        return cohortOrAssignmentMatch || cohort.learners.length > 0;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
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
                            const latestResultCounts =
                              getLatestResultCounts(assignment);

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

                                  <span className="submission-assignment-summary">
                                    <span className="submission-assignment-stats">
                                      <span>
                                        <strong>{assignment.unique_learners}</strong>
                                        learners
                                      </span>
                                      <span>
                                        <strong>{assignment.total_attempts}</strong>
                                        attempts
                                      </span>
                                    </span>

                                    <span className="submission-latest-band-counts">
                                      <span className="latest-band-pill">
                                        Failed{" "}
                                        <strong>
                                          {latestResultCounts.failed}
                                        </strong>
                                      </span>

                                      <span className="latest-band-pill">
                                        Foundation{" "}
                                        <strong>
                                          {latestResultCounts.foundation}
                                        </strong>
                                      </span>

                                      <span className="latest-band-pill">
                                        Proficient · Basic{" "}
                                        <strong>
                                          {latestResultCounts.proficient_basic}
                                        </strong>
                                      </span>

                                      <span className="latest-band-pill">
                                        Proficient · Advanced{" "}
                                        <strong>
                                          {latestResultCounts.proficient_advanced}
                                        </strong>
                                      </span>

                                      <span className="latest-band-pill">
                                        Expert{" "}
                                        <strong>
                                          {latestResultCounts.expert}
                                        </strong>
                                      </span>
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

                                        const latestLearnerAttempt =
                                          learner.attempts
                                            .slice()
                                            .sort((a, b) => {
                                              if (a.attempt_number !== b.attempt_number) {
                                                return b.attempt_number - a.attempt_number;
                                              }
                                              return (
                                                new Date(b.submitted_at).getTime() -
                                                new Date(a.submitted_at).getTime()
                                              );
                                            })[0];

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
                                                              {attempt.is_manual_review && (
                                                                <span className="manual-review-pill">
                                                                  Manual Review
                                                                  {attempt.manual_reviewer
                                                                    ? ` by ${attempt.manual_reviewer}`
                                                                    : ""}
                                                                </span>
                                                              )}
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

                                                                {(attempt.criterion_results?.length ?? 0) > 0 && (
                                                                  <details className="submission-detail-section">
                                                                    <summary>Criterion Results</summary>
                                                                    <div className="submission-criterion-results">
                                                                      {(attempt.criterion_results ?? []).map(
                                                                        (criterion) => (
                                                                          <div
                                                                            key={criterion.id}
                                                                            className="submission-criterion-result"
                                                                          >
                                                                            <div className="submission-criterion-result-header">
                                                                              <strong>
                                                                                {criterion.criterion_code
                                                                                  ? `${criterion.criterion_code} — `
                                                                                  : ""}
                                                                                {criterion.criterion_title || "Criterion"}
                                                                              </strong>
                                                                              <span>
                                                                                {criterion.awarded_marks} / {criterion.maximum_score}
                                                                              </span>
                                                                            </div>
                                                                            <div className="submission-criterion-meta">
                                                                              Band: <strong>{criterion.achievement_band || "—"}</strong>
                                                                            </div>
                                                                            <p>
                                                                              {criterion.feedback || "No criterion feedback available."}
                                                                            </p>
                                                                          </div>
                                                                        ),
                                                                      )}
                                                                    </div>
                                                                  </details>
                                                                )}

                                                                {attempt.grading_audit && !attempt.is_manual_review && (
                                                                  <details>
                                                                    <summary>AI Grading Details</summary>
                                                                    <div style={{ marginTop: "12px" }}>
                                                                      <p>
                                                                        <strong>Status:</strong>{" "}
                                                                        {attempt.grading_audit.status}
                                                                      </p>
                                                                      <p>
                                                                        <strong>Model:</strong>{" "}
                                                                        {attempt.grading_audit.model_name || "—"}
                                                                      </p>

                                                                      {attempt.grading_audit.error_message && (
                                                                        <p className="error-message">
                                                                          {attempt.grading_audit.error_code
                                                                            ? `${attempt.grading_audit.error_code}: `
                                                                            : ""}
                                                                          {attempt.grading_audit.error_message}
                                                                        </p>
                                                                      )}

                                                                      {attempt.grading_audit.criterion_evaluations.map(
                                                                        (evaluation) => (
                                                                          <div
                                                                            key={`${evaluation.task_code}:${evaluation.rubric_criterion_id}`}
                                                                            style={{ marginBottom: "16px" }}
                                                                          >
                                                                            <strong>
                                                                              {evaluation.task_code}
                                                                            </strong>
                                                                            <div>
                                                                              AI evaluation:{" "}
                                                                              {Number(
                                                                                evaluation.score_percentage,
                                                                              ).toFixed(2)}%
                                                                            </div>
                                                                            <div>
                                                                              Weight:{" "}
                                                                              {Number(
                                                                                evaluation.inferred_weight,
                                                                              ).toFixed(2)}%
                                                                            </div>
                                                                            <div>
                                                                              Earned contribution:{" "}
                                                                              {Number(
                                                                                evaluation.earned_points,
                                                                              ).toFixed(2)}
                                                                            </div>
                                                                            <div>
                                                                              Evidence pages:{" "}
                                                                              {evaluation.mapped_page_numbers.length
                                                                                ? evaluation.mapped_page_numbers.join(
                                                                                  ", ",
                                                                                )
                                                                                : "No mapped pages"}
                                                                            </div>
                                                                            {evaluation.mapping_justification && (
                                                                              <p>
                                                                                <strong>
                                                                                  Evidence mapping:
                                                                                </strong>{" "}
                                                                                {evaluation.mapping_justification}
                                                                              </p>
                                                                            )}
                                                                            <p>{evaluation.feedback}</p>
                                                                          </div>
                                                                        ),
                                                                      )}

                                                                      <p>
                                                                        <strong>Calculated total:</strong>{" "}
                                                                        {attempt.grading_audit.scoring_snapshot
                                                                          .total_earned_points ?? "—"}{" "}
                                                                        /{" "}
                                                                        {attempt.grading_audit.scoring_snapshot
                                                                          .total_max_possible_points ?? "—"}
                                                                        {" "}
                                                                        {attempt.grading_audit.scoring_snapshot
                                                                          .overall_percentage !== undefined
                                                                          ? `(${Number(
                                                                            attempt.grading_audit.scoring_snapshot
                                                                              .overall_percentage,
                                                                          ).toFixed(2)}%)`
                                                                          : ""}
                                                                      </p>
                                                                    </div>
                                                                  </details>
                                                                )}

                                                                {attempt.id === latestLearnerAttempt?.id &&
                                                                  attempt.grading_audit &&
                                                                  !attempt.is_manual_review &&
                                                                  attempt.grading_audit.scoring_snapshot.token_usage?.total && (
                                                                  <details className="submission-detail-section">
                                                                    <summary>AI Token Usage</summary>
                                                                    <div className="submission-token-usage">
                                                                      <div className="submission-token-usage-summary">
                                                                        <div>
                                                                          <span>Model</span>
                                                                          <strong>
                                                                            {attempt.grading_audit.model_name || "—"}
                                                                          </strong>
                                                                        </div>
                                                                        <div>
                                                                          <span>Input tokens</span>
                                                                          <strong>
                                                                            {formatTokenCount(
                                                                              attempt.grading_audit.scoring_snapshot.token_usage?.total?.input_tokens,
                                                                            )}
                                                                          </strong>
                                                                        </div>
                                                                        <div>
                                                                          <span>Cached input</span>
                                                                          <strong>
                                                                            {formatTokenCount(
                                                                              attempt.grading_audit.scoring_snapshot.token_usage?.total?.cached_input_tokens,
                                                                            )}
                                                                          </strong>
                                                                        </div>
                                                                        <div>
                                                                          <span>Output tokens</span>
                                                                          <strong>
                                                                            {formatTokenCount(
                                                                              attempt.grading_audit.scoring_snapshot.token_usage?.total?.output_tokens,
                                                                            )}
                                                                          </strong>
                                                                        </div>
                                                                        <div>
                                                                          <span>Reasoning tokens</span>
                                                                          <strong>
                                                                            {formatTokenCount(
                                                                              attempt.grading_audit.scoring_snapshot.token_usage?.total?.reasoning_tokens,
                                                                            )}
                                                                          </strong>
                                                                        </div>
                                                                        <div>
                                                                          <span>Total tokens</span>
                                                                          <strong>
                                                                            {formatTokenCount(
                                                                              attempt.grading_audit.scoring_snapshot.token_usage?.total?.total_tokens,
                                                                            )}
                                                                          </strong>
                                                                        </div>
                                                                        <div>
                                                                          <span>Estimated API Cost</span>
                                                                          <strong>
                                                                            {(() => {
                                                                              const usage =
                                                                                attempt.grading_audit
                                                                                  .scoring_snapshot
                                                                                  .token_usage
                                                                                  ?.total;

                                                                              if (!usage) {
                                                                                return "—";
                                                                              }

                                                                              const estimatedCost =
                                                                                getEstimatedApiCost(
                                                                                  attempt.grading_audit.model_name,
                                                                                  usage.input_tokens,
                                                                                  usage.cached_input_tokens,
                                                                                  usage.output_tokens,
                                                                                );

                                                                              return estimatedCost !== null
                                                                                ? `$${estimatedCost.toFixed(4)} USD`
                                                                                : "Pricing unavailable";
                                                                            })()}
                                                                          </strong>
                                                                        </div>
                                                                      </div>

                                                                      <details>
                                                                        <summary>Call breakdown</summary>
                                                                        <div className="submission-token-call-list">
                                                                          {attempt.grading_audit.scoring_snapshot.token_usage?.task_mapping && (
                                                                            <div className="submission-token-call">
                                                                              <strong>Task Mapping</strong>
                                                                              <span>
                                                                                Input {formatTokenCount(attempt.grading_audit.scoring_snapshot.token_usage.task_mapping.input_tokens)}
                                                                                {" · "}Cached {formatTokenCount(attempt.grading_audit.scoring_snapshot.token_usage.task_mapping.cached_input_tokens)}
                                                                                {" · "}Output {formatTokenCount(attempt.grading_audit.scoring_snapshot.token_usage.task_mapping.output_tokens)}
                                                                                {" · "}Total {formatTokenCount(attempt.grading_audit.scoring_snapshot.token_usage.task_mapping.total_tokens)}
                                                                              </span>
                                                                            </div>
                                                                          )}

                                                                          {(attempt.grading_audit.scoring_snapshot.token_usage?.grading?.calls ?? []).map(
                                                                            (call, index) => (
                                                                              <div
                                                                                key={`${call.stage}:${index}`}
                                                                                className="submission-token-call"
                                                                              >
                                                                                <strong>
                                                                                  {call.stage === "criterion_grading"
                                                                                    ? "Criterion Grading"
                                                                                    : call.stage === "criterion_grading_retry"
                                                                                      ? "Criterion Grading Retry"
                                                                                      : call.stage === "criterion_grading_recovery"
                                                                                        ? "Criterion Grading Recovery"
                                                                                        : call.stage}
                                                                                </strong>
                                                                                <span>
                                                                                  Input {formatTokenCount(call.input_tokens)}
                                                                                  {" · "}Cached {formatTokenCount(call.cached_input_tokens)}
                                                                                  {" · "}Output {formatTokenCount(call.output_tokens)}
                                                                                  {" · "}Total {formatTokenCount(call.total_tokens)}
                                                                                </span>
                                                                              </div>
                                                                            ),
                                                                          )}
                                                                        </div>
                                                                      </details>
                                                                    </div>
                                                                  </details>
                                                                )}

                                                                {(attempt.process_logs?.length ?? 0) > 0 && (
                                                                  <details>
                                                                    <summary>Processing Log</summary>
                                                                    <div style={{ marginTop: "12px" }}>
                                                                      {(attempt.process_logs ?? []).map(
                                                                        (entry) => (
                                                                          <div
                                                                            key={entry.id}
                                                                            style={{ marginBottom: "10px" }}
                                                                          >
                                                                            <strong>
                                                                              {entry.stage} · {entry.status}
                                                                            </strong>
                                                                            <div>
                                                                              {formatDate(entry.created_at)}
                                                                            </div>
                                                                            {entry.event_code && (
                                                                              <div>{entry.event_code}</div>
                                                                            )}
                                                                            {entry.message && (
                                                                              <div>{entry.message}</div>
                                                                            )}
                                                                          </div>
                                                                        ),
                                                                      )}
                                                                    </div>
                                                                  </details>
                                                                )}
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
                  No assessment mappings are configured for the selected
                  cohort.
                </div>
              ) : (
                gradebookCohorts.map((cohort) => {
                  const isExpanded =
                    expandedGradebookCohorts.includes(cohort.id);
                  const allocation = cohort.mappedAssignments.reduce(
                    (total, assignment) =>
                      assignment.contributesToFinalMark
                        ? total + assignment.weight
                        : total,
                    0,
                  );

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
                            setExpandedGradebookCohorts,
                          )
                        }
                        aria-expanded={isExpanded}
                      >
                        <span className="submission-heading-icon">
                          {isExpanded ? (
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
                          {cohort.mappedAssignments.length} mapped assessment
                          {cohort.mappedAssignments.length === 1 ? "" : "s"}
                          {" · "}
                          {cohort.learners.length} learner
                          {cohort.learners.length === 1 ? "" : "s"}
                          {" · "}
                          Final allocation: {allocation.toFixed(2)}%
                        </span>
                      </button>

                      {isExpanded && (
                        <div
                          className="table-container"
                          style={{ overflowX: "auto" }}
                        >
                          <table className="modern-table">
                            <thead>
                              <tr>
                                <th>Learner</th>
                                {cohort.mappedAssignments.map(
                                  (assignment) => (
                                    <th key={assignment.mappingId}>
                                      <strong>{assignment.code}</strong>
                                      <small
                                        className="table-subtext"
                                        style={{ display: "block" }}
                                      >
                                        {assignment.title}
                                      </small>
                                      {assignment.isSummative && (
                                        <small
                                          className="table-subtext"
                                          style={{
                                            display: "block",
                                            fontWeight: 700,
                                          }}
                                        >
                                          Summative
                                        </small>
                                      )}
                                      {assignment.contributesToFinalMark &&
                                        assignment.weight > 0 && (
                                          <small
                                            className="table-subtext"
                                            style={{ display: "block" }}
                                          >
                                            Weight: {assignment.weight.toFixed(2)}%
                                          </small>
                                        )}
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
                                      cohort.mappedAssignments.length + 2
                                    }
                                  >
                                    No learners have launched an assessment for
                                    this cohort yet.
                                  </td>
                                </tr>
                              ) : (
                                cohort.learners.map((learner) => (
                                  <tr key={learner.id}>
                                    <td>
                                      <strong>{learner.name}</strong>
                                      <span
                                        className="table-subtext"
                                        style={{ display: "block" }}
                                      >
                                        {learner.learner_id}
                                      </span>
                                      {learner.email && (
                                        <span
                                          className="table-subtext"
                                          style={{ display: "block" }}
                                        >
                                          {learner.email}
                                        </span>
                                      )}
                                    </td>

                                    {cohort.mappedAssignments.map(
                                      (assignment) => {
                                        const score =
                                          learner.assignmentScores.find(
                                            (item) =>
                                              item.assignmentId === assignment.id,
                                          );

                                        return (
                                          <td key={assignment.mappingId}>
                                            {(score?.percentage ?? 0).toFixed(2)}
                                          </td>
                                        );
                                      },
                                    )}

                                    <td>
                                      <strong>
                                        {learner.finalScore.toFixed(2)}
                                      </strong>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
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
