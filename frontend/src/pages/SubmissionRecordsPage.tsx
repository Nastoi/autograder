import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import "../css/AssessmentMappings.css";
import "../css/SubmissionRecordsPage.css";

import {
  getAdminSubmissionRecords,
  type AdminSubmissionCohort,
  type AdminSubmissionRecordsResponse,
} from "../api/adminSubmissionRecords";

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
  if (score === null) return "Pending";

  if (maximumScore === null) return score;

  return `${score} / ${maximumScore}`;
}

export function SubmissionRecordsPage() {
  const [data, setData] =
    useState<AdminSubmissionRecordsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
        const response = await getAdminSubmissionRecords();

        setData(response);
        setExpandedCohorts(
          response.cohorts.map((cohort) => cohort.id),
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

  function toggleItem(
    id: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
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
            Review learner submission attempts and grading results by
            cohort and assignment.
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

          <section className="submission-record-filters content-card">
            <div className="submission-record-search">
              <Search size={16} />
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search learner, cohort or assignment..."
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
          </section>

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
                        {cohort.assignments.length === 1 ? "" : "s"}
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
        {attempt.status_display}
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
        {attempt.achieved_band || "—"}
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
)
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
        </>
      )}
    </main>
  );
}
