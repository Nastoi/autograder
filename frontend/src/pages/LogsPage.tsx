import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Pause, Play, Search } from "lucide-react";

import { getPortalLogs, type LogSource } from "../api/logs";
import { useAuth } from "../auth/AuthContext";
import "../css/LogsPage.css";

const SOURCE_LABELS: Record<LogSource, string> = {
  backend: "Backend",
  celery: "Celery",
  errors: "Errors",
};

export function LogsPage() {
  const { user } = useAuth();
  const [source, setSource] = useState<LogSource>("backend");
  const [lineCount, setLineCount] = useState(200);
  const [lines, setLines] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const logBoxRef = useRef<HTMLPreElement | null>(null);

  async function loadLogs(showSpinner = false) {
    if (showSpinner) setLoading(true);
    try {
      const data = await getPortalLogs(source, lineCount);
      setLines(data.lines ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load logs.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs(true);
  }, [source, lineCount]);

  useEffect(() => {
    if (!live) return;
    const interval = window.setInterval(() => {
      void loadLogs(false);
    }, 2000);
    return () => window.clearInterval(interval);
  }, [live, source, lineCount]);

  const visibleLines = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return lines;
    return lines.filter((line) => line.toLowerCase().includes(query));
  }, [lines, search]);

  useEffect(() => {
    if (!live || !logBoxRef.current) return;
    logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [visibleLines, live]);

  if (!user || !(user.is_superuser || user.can_view_logs)) {
    return (
      <div className="logs-page">
        <div className="logs-error">You do not have permission to view logs.</div>
      </div>
    );
  }

  return (
    <div className="logs-page">
      <div className="logs-page-header">
        <div>
          <h1>Logs</h1>
          <p>Read-only application logs for troubleshooting.</p>
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

      <div className="logs-panel">
        <div className="logs-panel-title">
          {SOURCE_LABELS[source]} log
          <span>{visibleLines.length} lines shown</span>
        </div>
        <pre ref={logBoxRef} className="logs-output">
          {loading && lines.length === 0
            ? "Loading logs..."
            : visibleLines.length > 0
              ? visibleLines.join("\n")
              : "No matching log entries."}
        </pre>
      </div>
    </div>
  );
}
