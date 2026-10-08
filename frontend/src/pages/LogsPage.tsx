import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Pause, Play, Search } from "lucide-react";

import {
  getPortalLogs,
  processSubmissionAction,
  type GradingLogFilterOptions,
  type LogSource,
  type ProcessingSubmissionAction,
} from "../api/logs";
import { useAuth } from "../auth/AuthContext";
import "../css/LogsPage.css";

const SOURCE_LABELS: Record<LogSource, string> = {
  backend: "Backend",
  celery: "Celery",
  errors: "Errors",
  grading: "Grading Attempts",
  queue: "Queue / Processing",
};

export function LogsPage() {
  const { user } = useAuth();
  const [source, setSource] = useState<LogSource>("backend");
  const [lineCount, setLineCount] = useState(200);
  const [lines, setLines] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [learnerFilter, setLearnerFilter] = useState("");
  const [attemptFilter, setAttemptFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [gradingFilterOptions, setGradingFilterOptions] =
    useState<GradingLogFilterOptions>({
      cohorts: [],
      assignments: [],
      learners: [],
      attempts: [],
      stages: [],
      statuses: [],
    });
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const logBoxRef = useRef<HTMLPreElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const [queueSummary, setQueueSummary] = useState({
    queued: 0,
    processing: 0,
    total: 0,
  });
  const [processingSubmissionId, setProcessingSubmissionId] =
    useState("");

  const [processingActionLoading, setProcessingActionLoading] =
    useState(false);

  const [processingActionMessage, setProcessingActionMessage] =
    useState("");

  async function loadLogs(showSpinner = false) {
    if (showSpinner) setLoading(true);
    try {
      const data = await getPortalLogs(
        source,
        lineCount,
        source === "grading"
          ? {
            cohort: cohortFilter,
            assignment: assignmentFilter,
            learner: learnerFilter,
            attempt: attemptFilter,
            stage: stageFilter,
            status: statusFilter,
          }
          : {},
      );
      setLines(data.lines ?? []);
      if (data.grading_filters) {
        setGradingFilterOptions(data.grading_filters);
      }
      if (data.queue_summary) {
        setQueueSummary(data.queue_summary);
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load logs.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }


  async function handleProcessingAction(
    action: ProcessingSubmissionAction,
  ) {
    const submissionId =
      processingSubmissionId.trim();

    if (!submissionId) {
      setError("Please enter a submission ID.");
      return;
    }

    const confirmMessage =
      action === "terminate"
        ? "Terminate this processing submission?"
        : "Terminate this processing submission and requeue it?";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setProcessingActionLoading(true);
    setProcessingActionMessage("");
    setError("");

    try {
      const result = await processSubmissionAction(
        submissionId,
        action,
      );

      setProcessingActionMessage(result.detail);

      await loadLogs(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to process submission action.",
      );
    } finally {
      setProcessingActionLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs(true);
  }, [source, lineCount, cohortFilter, assignmentFilter, learnerFilter, attemptFilter, stageFilter, statusFilter]);

  useEffect(() => {
    if (!live) return;
    const interval = window.setInterval(() => {
      void loadLogs(false);
    }, 2000);
    return () => window.clearInterval(interval);
  }, [live, source, lineCount, cohortFilter, assignmentFilter, learnerFilter, attemptFilter, stageFilter, statusFilter]);

  const visibleLines = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return lines;
    return lines.filter((line) => line.toLowerCase().includes(query));
  }, [lines, search]);

  useEffect(() => {
    if (
      !live ||
      !logBoxRef.current ||
      !shouldAutoScrollRef.current
    ) {
      return;
    }

    logBoxRef.current.scrollTop =
      logBoxRef.current.scrollHeight;
  }, [visibleLines, live]);

  if (!user || !(user.is_superuser || user.can_view_logs)) {
    return (
      <div className="logs-page">
        <div className="logs-error">You do not have permission to view logs.</div>
      </div>
    );
  }


  function handleLogScroll() {
    const element = logBoxRef.current;

    if (!element) return;

    const distanceFromBottom =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    shouldAutoScrollRef.current =
      distanceFromBottom <= 40;
  }


  return (
    <div className="logs-page">
      <div className="logs-page-header">
        <div>
          <h1>Logs</h1>
          <p>Read-only application and grading-attempt logs for troubleshooting.</p>
        </div>
        <div className={`logs-live-state ${live ? "active" : ""}`}>
          <span className="logs-live-dot" />
          {live ? "Live" : "Paused"}
        </div>
      </div>

      <div className="logs-toolbar">
        <label>
          Source
          <select value={source} onChange={(e) => setSource(e.target.value as LogSource)}>
            {(Object.keys(SOURCE_LABELS) as LogSource[]).map((key) => (
              <option value={key} key={key}>{SOURCE_LABELS[key]}</option>
            ))}
          </select>
        </label>

        <label>
          Lines
          <select value={lineCount} onChange={(e) => setLineCount(Number(e.target.value))}>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </label>

        {source === "grading" && (
          <>
            <label>
              Cohort
              <select value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)}>
                <option value="">All cohorts</option>
                {gradingFilterOptions.cohorts.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label>
              Assignment
              <select value={assignmentFilter} onChange={(e) => setAssignmentFilter(e.target.value)}>
                <option value="">All assignments</option>
                {gradingFilterOptions.assignments.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label>
              Learner
              <select value={learnerFilter} onChange={(e) => setLearnerFilter(e.target.value)}>
                <option value="">All learners</option>
                {gradingFilterOptions.learners.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label>
              Attempt
              <select value={attemptFilter} onChange={(e) => setAttemptFilter(e.target.value)}>
                <option value="">All attempts</option>
                {gradingFilterOptions.attempts.map((value) => (
                  <option key={value} value={String(value)}>#{value}</option>
                ))}
              </select>
            </label>

            <label>
              Stage
              <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                <option value="">All stages</option>
                {gradingFilterOptions.stages.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                {gradingFilterOptions.statuses.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </>
        )}

        <label className="logs-search">
          Search
          <span>
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Error, submission ID, learner..."
            />
          </span>
        </label>

        <button type="button" onClick={() => void loadLogs(true)} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </button>

        <button type="button" onClick={() => setLive((value) => !value)}>
          {live ? <Pause size={16} /> : <Play size={16} />}
          {live ? "Pause" : "Resume"}
        </button>
      </div>

      {error && <div className="logs-error">{error}</div>}

      {source === "queue" && (
        <div className="logs-queue-summary">
          <strong>Queued: {queueSummary.queued}</strong>
          <strong>Processing: {queueSummary.processing}</strong>
          <strong>Total active: {queueSummary.total}</strong>
        </div>
      )}

      {source === "queue" && (
        <div className="logs-processing-card">
          <div className="logs-processing-card-header">
            <div>
              <strong>Processing recovery</strong>
              <p>
                Terminate a stuck processing submission or terminate it and requeue the same attempt.
              </p>
            </div>
          </div>

          <div className="logs-processing-actions">
            <label className="logs-processing-field">
              <span>Submission ID</span>

              <input
                type="text"
                value={processingSubmissionId}
                onChange={(e) =>
                  setProcessingSubmissionId(e.target.value)
                }
                placeholder="e.g. 21df817b-f474-4467-9034-48e84cd5bfbd"
                disabled={processingActionLoading}
              />
            </label>

            <div className="logs-processing-buttons">
              <button
                type="button"
                className="btn-action"
                onClick={() =>
                  void handleProcessingAction("terminate")
                }
                disabled={
                  processingActionLoading ||
                  !processingSubmissionId.trim()
                }
              >
                {processingActionLoading
                  ? "Working..."
                  : "Terminate"}
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  void handleProcessingAction(
                    "terminate_requeue",
                  )
                }
                disabled={
                  processingActionLoading ||
                  !processingSubmissionId.trim()
                }
              >
                {processingActionLoading
                  ? "Working..."
                  : "Terminate & Requeue"}
              </button>
            </div>
          </div>

          {processingActionMessage && (
            <div className="logs-processing-success">
              {processingActionMessage}
            </div>
          )}
        </div>
      )}

      <div className="logs-panel">
        <div className="logs-panel-title">
          {SOURCE_LABELS[source]} log
          <span>{visibleLines.length} lines shown</span>
        </div>
        <pre
          ref={logBoxRef}
          className="logs-output"
          onScroll={handleLogScroll}
        >
          {loading && lines.length === 0
            ? "Loading logs..."
            : visibleLines.length > 0
              ? visibleLines.map((line, index) => {
                const isDanger =
                  source === "queue" &&
                  line.includes("age_state=danger");

                const isWarning =
                  source === "queue" &&
                  line.includes("age_state=warning");

                return (
                  <span
                    key={`${index}-${line}`}
                    className={
                      isDanger
                        ? "logs-line-danger"
                        : isWarning
                          ? "logs-line-warning"
                          : undefined
                    }
                  >
                    {line}
                    {"\n"}
                  </span>
                );
              })
              : "No matching log entries."}
        </pre>
      </div>
    </div>
  );
}
