import "../css/AssessmentMappings.css";
import "./TaskCriteriaMappingsPage.css";
import { useEffect, useState } from "react";
import {
  getAssignmentLevels,
  getTasks,
  getRubricCriteria,
  getTaskCriteriaMappings,
  generateTaskCriteriaMappings,
  deleteTaskCriteriaMapping,
  type AssignmentLevel,
  type Task,
  type RubricCriterion,
  type TaskCriteriaMapping,
  type AIMappingResult,
} from "../api/lms";

// ─── Weight badge colour ─────────────────────────────────────────────────────
function weightColour(w: number): string {
  if (w >= 0.7) return "#059669"; // green
  if (w >= 0.4) return "#d97706"; // amber
  return "#2563eb";               // blue
}

// ─── Tiny progress bar ───────────────────────────────────────────────────────
function WeightBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="weight-bar-wrap">
      <div
        className="weight-bar-fill"
        style={{
          width: `${pct}%`,
          background: weightColour(value),
        }}
      />
      <span className="weight-bar-label" style={{ color: weightColour(value) }}>
        {pct}%
      </span>
    </div>
  );
}

// ─── Criterion chip ──────────────────────────────────────────────────────────
function CriterionChip({ code, weight }: { code: string; weight: number }) {
  return (
    <span className="criterion-chip" style={{ borderColor: weightColour(weight) }}>
      <span className="chip-code">{code}</span>
      <span className="chip-weight" style={{ background: weightColour(weight) }}>
        {Math.round(weight * 100)}%
      </span>
    </span>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export function TaskCriteriaMappingsPage() {
  // ── data ──
  const [levels, setLevels] = useState<AssignmentLevel[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [mappings, setMappings] = useState<TaskCriteriaMapping[]>([]);

  // ── selection ──
  const [selectedLevelId, setSelectedLevelId] = useState("");

  // ── AI result panel ──
  const [aiResult, setAiResult] = useState<AIMappingResult | null>(null);

  // ── ui state ──
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ── view toggle ──
  const [viewMode, setViewMode] = useState<"matrix" | "list">("matrix");

  // ── load levels on mount ──
  useEffect(() => {
    async function load() {
      try {
        const lvls = await getAssignmentLevels();
        setLevels(lvls);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load data.");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  // ── load tasks / criteria / mappings when level changes ──
  useEffect(() => {
    if (!selectedLevelId) {
      setTasks([]);
      setCriteria([]);
      setMappings([]);
      setAiResult(null);
      return;
    }

    setError("");
    setSuccessMsg("");
    setAiResult(null);

    async function loadLevelData() {
      try {
        const [t, c, m] = await Promise.all([
          getTasks(selectedLevelId),
          getRubricCriteria(selectedLevelId),
          getTaskCriteriaMappings(selectedLevelId),
        ]);
        setTasks(t);
        setCriteria(c);
        setMappings(m);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load level data.");
      }
    }

    void loadLevelData();
  }, [selectedLevelId]);

  // ── AI generate ──
  async function handleGenerate() {
    setError("");
    setSuccessMsg("");
    setIsGenerating(true);
    setAiResult(null);

    try {
      const result = await generateTaskCriteriaMappings(selectedLevelId);
      setAiResult(result);

      // Refresh DB-persisted mappings
      const fresh = await getTaskCriteriaMappings(selectedLevelId);
      setMappings(fresh);

      setSuccessMsg(
        `AI mapping complete — ${result.created} created, ${result.updated} updated.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  // ── delete a single mapping ──
  async function handleDelete(id: string) {
    setIsDeletingId(id);
    setError("");
    try {
      await deleteTaskCriteriaMapping(id);
      setMappings((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete mapping.");
    } finally {
      setIsDeletingId(null);
    }
  }

  // ── derived: build matrix lookup ──
  // matrix[task_code][criterion_code] = inferred_weight (as number) or null
  const matrix: Record<string, Record<string, number | null>> = {};
  tasks.forEach((t) => {
    matrix[t.task_code] = {};
    criteria.forEach((c) => {
      matrix[t.task_code][c.criterion_code] = null;
    });
  });
  mappings.forEach((m) => {
    if (matrix[m.task_code]) {
      matrix[m.task_code][m.criterion_code] = parseFloat(m.inferred_weight);
    }
  });

  const selectedLevel = levels.find((l) => l.id === selectedLevelId);

  // ── criteria weight totals per criterion ──
  const criterionTotals: Record<string, number> = {};
  criteria.forEach((c) => {
    criterionTotals[c.criterion_code] = 0;
  });
  mappings.forEach((m) => {
    if (criterionTotals[m.criterion_code] !== undefined) {
      criterionTotals[m.criterion_code] += parseFloat(m.inferred_weight);
    }
  });

  if (isLoading) {
    return (
      <main className="admin-container">
        <div className="tcm-loading">
          <div className="tcm-spinner" />
          <span>Loading assignment levels…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-container">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="admin-header">
        <div>
          <h1 className="tcm-page-title">
            <span className="tcm-ai-badge">🤖 AI</span>
            Task → Criteria Mappings
          </h1>
          <p className="tcm-subtitle">
            Select an Assignment Level then let OpenAI intelligently map each
            task to its rubric criteria with inferred weightings.
          </p>
        </div>
        {selectedLevelId && mappings.length > 0 && (
          <div className="tcm-view-toggle">
            <button
              id="view-matrix-btn"
              className={`tcm-toggle-btn ${viewMode === "matrix" ? "active" : ""}`}
              onClick={() => setViewMode("matrix")}
            >
              ⊞ Matrix
            </button>
            <button
              id="view-list-btn"
              className={`tcm-toggle-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
            >
              ☰ List
            </button>
          </div>
        )}
      </div>

      {/* ── Alerts ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="tcm-alert tcm-alert-error" role="alert">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="tcm-alert tcm-alert-success" role="status">
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div className="tcm-controls">
        <div className="tcm-selector-wrap">
          <label htmlFor="level-select" className="tcm-select-label">
            Assignment Level
          </label>
          <select
            id="level-select"
            value={selectedLevelId}
            onChange={(e) => setSelectedLevelId(e.target.value)}
            className="tcm-select"
          >
            <option value="">— Select a level —</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.assignment_code} — {l.assignment_title} — {l.display_name}
              </option>
            ))}
          </select>
        </div>

        {selectedLevelId && (
          <button
            id="generate-mapping-btn"
            onClick={handleGenerate}
            disabled={isGenerating || tasks.length === 0 || criteria.length === 0}
            className="tcm-generate-btn"
          >
            {isGenerating ? (
              <>
                <span className="tcm-btn-spinner" />
                Generating…
              </>
            ) : (
              <>✨ Generate with OpenAI</>
            )}
          </button>
        )}
      </div>

      {/* ── Level stats ─────────────────────────────────────────────────── */}
      {selectedLevelId && (
        <div className="tcm-stats-row">
          <div className="tcm-stat-card" data-color="blue">
            <span className="tcm-stat-icon">📋</span>
            <div>
              <div className="tcm-stat-value">{tasks.length}</div>
              <div className="tcm-stat-label">Tasks</div>
            </div>
          </div>
          <div className="tcm-stat-card" data-color="purple">
            <span className="tcm-stat-icon">🎯</span>
            <div>
              <div className="tcm-stat-value">{criteria.length}</div>
              <div className="tcm-stat-label">Criteria</div>
            </div>
          </div>
          <div className="tcm-stat-card" data-color="green">
            <span className="tcm-stat-icon">🔗</span>
            <div>
              <div className="tcm-stat-value">{mappings.length}</div>
              <div className="tcm-stat-label">Mappings</div>
            </div>
          </div>
          {selectedLevel && (
            <div className="tcm-stat-card" data-color="amber">
              <span className="tcm-stat-icon">📊</span>
              <div>
                <div className="tcm-stat-value">{selectedLevel.display_name}</div>
                <div className="tcm-stat-label">Level</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AI Rationale banner ──────────────────────────────────────────── */}
      {aiResult && aiResult.mapping_rationale && (
        <div className="tcm-rationale">
          <div className="tcm-rationale-header">
            <span>🧠</span>
            <strong>AI Mapping Rationale</strong>
            {aiResult.validation_warnings.length > 0 && (
              <span className="tcm-warning-badge">
                ⚠ {aiResult.validation_warnings.length} warning
                {aiResult.validation_warnings.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="tcm-rationale-text">{aiResult.mapping_rationale}</p>
          {aiResult.validation_warnings.length > 0 && (
            <ul className="tcm-warnings-list">
              {aiResult.validation_warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!selectedLevelId && (
        <div className="tcm-empty-state">
          <div className="tcm-empty-icon">🗺️</div>
          <h3>Select an Assignment Level</h3>
          <p>
            Choose a level above to view or generate AI-powered task ↔ criteria
            mappings. The AI will analyse each task's instructions against your
            rubric criteria and assign evidence weights.
          </p>
        </div>
      )}

      {selectedLevelId && tasks.length === 0 && (
        <div className="tcm-empty-state">
          <div className="tcm-empty-icon">📋</div>
          <h3>No Tasks Found</h3>
          <p>This assignment level has no tasks yet. Add tasks first.</p>
        </div>
      )}

      {selectedLevelId && criteria.length === 0 && tasks.length > 0 && (
        <div className="tcm-empty-state">
          <div className="tcm-empty-icon">🎯</div>
          <h3>No Rubric Criteria Found</h3>
          <p>
            This assignment level has no rubric criteria yet. Add criteria
            before generating mappings.
          </p>
        </div>
      )}

      {/* ── MATRIX VIEW ─────────────────────────────────────────────────── */}
      {selectedLevelId &&
        tasks.length > 0 &&
        criteria.length > 0 &&
        viewMode === "matrix" && (
          <div className="tcm-matrix-wrap">
            <div className="table-container" style={{ overflowX: "auto" }}>
              <table className="tcm-matrix-table">
                <thead>
                  <tr>
                    <th className="tcm-matrix-corner">
                      Task ↓ / Criterion →
                    </th>
                    {criteria.map((c) => (
                      <th key={c.id} className="tcm-matrix-criterion-head">
                        <div className="tcm-crit-head-inner">
                          <span className="tcm-code-badge">{c.criterion_code}</span>
                          <span className="tcm-crit-title">{c.title}</span>
                          <span className="tcm-max-score">
                            Max: {c.maximum_score}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="tcm-matrix-row">
                      <td className="tcm-matrix-task-cell">
                        <div className="tcm-task-cell-inner">
                          <span className="tcm-code-badge tcm-task-badge">
                            {t.task_code}
                          </span>
                          <span className="tcm-task-title">{t.title}</span>
                          <span className="tcm-task-seq">#{t.sequence}</span>
                        </div>
                      </td>
                      {criteria.map((c) => {
                        const w = matrix[t.task_code]?.[c.criterion_code];
                        return (
                          <td
                            key={c.id}
                            className={`tcm-matrix-cell ${w !== null ? "tcm-cell-mapped" : "tcm-cell-empty"}`}
                          >
                            {w !== null ? (
                              <WeightBar value={w} />
                            ) : (
                              <span className="tcm-cell-dash">–</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Weight totals row */}
                  <tr className="tcm-totals-row">
                    <td className="tcm-totals-label">Σ Weight per criterion</td>
                    {criteria.map((c) => {
                      const total = criterionTotals[c.criterion_code] ?? 0;
                      const isOk = Math.abs(total - 1.0) <= 0.02;
                      return (
                        <td key={c.id} className="tcm-totals-cell">
                          <span
                            className={`tcm-total-badge ${isOk ? "ok" : "warn"}`}
                          >
                            {Math.round(total * 100)}%
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* ── LIST VIEW ───────────────────────────────────────────────────── */}
      {selectedLevelId &&
        tasks.length > 0 &&
        criteria.length > 0 &&
        viewMode === "list" && (
          <div className="tcm-list-view">
            {tasks.map((t) => {
              const taskMappings = mappings.filter(
                (m) => m.task_code === t.task_code,
              );

              return (
                <div key={t.id} className="tcm-task-card">
                  <div className="tcm-task-card-header">
                    <div className="tcm-task-card-title">
                      <span className="tcm-code-badge tcm-task-badge">
                        {t.task_code}
                      </span>
                      <span className="tcm-task-card-name">{t.title}</span>
                    </div>
                    <div className="tcm-task-card-meta">
                      <span className="tcm-chip-row">
                        {taskMappings.map((m) => (
                          <CriterionChip
                            key={m.id}
                            code={m.criterion_code}
                            weight={parseFloat(m.inferred_weight)}
                          />
                        ))}
                        {taskMappings.length === 0 && (
                          <span className="tcm-no-map">No mappings yet</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {t.instructions && (
                    <p className="tcm-task-instructions">{t.instructions}</p>
                  )}

                  {taskMappings.length > 0 && (
                    <div className="tcm-mapping-rows">
                      {taskMappings.map((m) => {
                        const w = parseFloat(m.inferred_weight);
                        const crit = criteria.find(
                          (c) => c.criterion_code === m.criterion_code,
                        );
                        return (
                          <div key={m.id} className="tcm-mapping-row">
                            <div className="tcm-mapping-left">
                              <span
                                className="tcm-code-badge"
                                style={{ borderColor: weightColour(w) }}
                              >
                                {m.criterion_code}
                              </span>
                              <span className="tcm-crit-name">
                                {crit?.title ?? m.criterion_code}
                              </span>
                            </div>
                            <div className="tcm-mapping-middle">
                              <WeightBar value={w} />
                            </div>
                            <div className="tcm-mapping-explanation">
                              {m.ai_explanation}
                            </div>
                            <button
                              id={`delete-mapping-${m.id}`}
                              className="tcm-delete-btn"
                              disabled={isDeletingId === m.id}
                              onClick={() => void handleDelete(m.id)}
                              title="Remove this mapping"
                            >
                              {isDeletingId === m.id ? "…" : "✕"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {/* ── AI result summary cards (shown right after generation) ───────── */}
      {aiResult && (
        <div className="tcm-ai-summary">
          <h3 className="tcm-ai-summary-title">AI Generation Summary</h3>
          <div className="tcm-ai-summary-grid">
            {aiResult.mappings.map((m) => (
              <div key={m.task_code} className="tcm-ai-card">
                <div className="tcm-ai-card-head">
                  <span className="tcm-code-badge tcm-task-badge">{m.task_code}</span>
                  <span className="tcm-ai-card-count">
                    {m.criteria.length} criteria mapped
                  </span>
                </div>
                <div className="tcm-ai-criteria-list">
                  {m.criteria.map((cm) => (
                    <div key={cm.criterion_code} className="tcm-ai-crit-row">
                      <span
                        className="tcm-code-badge"
                        style={{ borderColor: weightColour(cm.inferred_weight) }}
                      >
                        {cm.criterion_code}
                      </span>
                      <WeightBar value={cm.inferred_weight} />
                      <span className="tcm-ai-explanation">{cm.explanation}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
