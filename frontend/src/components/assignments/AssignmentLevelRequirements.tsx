import type { AssignmentLevel } from "../../api/courses";

type AssignmentLevelRequirementsProps = {
  level: AssignmentLevel;
  levelReadOnly: boolean;
  lockedBy: string | null | undefined;
  importingLevelId: string;

  editingLevelId: string;

  levelTitle: string;
  levelSkillStatementCode: string;
  levelSkillStatement: string;
  levelObjective: string;
  levelScenario: string;
  levelInstructions: string;
  levelDeliverables: string;
  levelExpectedOutcome: string;

  isSavingLevel: boolean;

  setLevelTitle: (value: string) => void;
  setLevelSkillStatementCode: (value: string) => void;
  setLevelSkillStatement: (value: string) => void;
  setLevelObjective: (value: string) => void;
  setLevelScenario: (value: string) => void;
  setLevelInstructions: (value: string) => void;
  setLevelDeliverables: (value: string) => void;
  setLevelExpectedOutcome: (value: string) => void;
  setEditingLevelId: (value: string) => void;

  downloadConfigurationCsvTemplate: (
    level: AssignmentLevel,
  ) => void;

  importConfigurationCsv: (
    level: AssignmentLevel,
    file: File,
  ) => void | Promise<void>;

  startEditingLevel: (
    level: AssignmentLevel,
  ) => void;

  saveLevel: (
    level: AssignmentLevel,
  ) => void | Promise<void>;
};

export function AssignmentLevelRequirements({
  level,
  levelReadOnly,
  lockedBy,
  importingLevelId,

  editingLevelId,

  levelTitle,
  levelSkillStatementCode,
  levelSkillStatement,
  levelObjective,
  levelScenario,
  levelInstructions,
  levelDeliverables,
  levelExpectedOutcome,

  isSavingLevel,

  setLevelTitle,
  setLevelSkillStatementCode,
  setLevelSkillStatement,
  setLevelObjective,
  setLevelScenario,
  setLevelInstructions,
  setLevelDeliverables,
  setLevelExpectedOutcome,
  setEditingLevelId,

  downloadConfigurationCsvTemplate,
  importConfigurationCsv,
  startEditingLevel,
  saveLevel,
}: AssignmentLevelRequirementsProps) {
  return (
    <>
      <div className="level-editing-banner">
        <div>
          <span className="level-editing-eyebrow">
            You are editing
          </span>

          <strong>
            {level.display_name} Submission
          </strong>
        </div>

        <span className="level-editing-track">
          {level.band_definitions
            .filter((band) => band.band_code !== "failed")
            .map((band) => band.display_name)
            .join(" + ")}
        </span>
      </div>

      <div
        className="section-actions"
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            downloadConfigurationCsvTemplate(level)
          }
        >
          Download CSV Template
        </button>

        <label
          className="btn-primary"
          style={{
            cursor:
              importingLevelId === level.id
                ? "not-allowed"
                : "pointer",
            opacity:
              importingLevelId === level.id
                ? 0.65
                : 1,
          }}
        >
          {importingLevelId === level.id
            ? "Importing..."
            : "Import Configuration CSV"}

          <input
            type="file"
            accept=".csv,text/csv"
            disabled={
              importingLevelId === level.id 
            }
            style={{ display: "none" }}
            onChange={(event) => {
              const file =
                event.target.files?.[0];

              if (file) {
                console.log("CSV selected:", file.name);

                void importConfigurationCsv(
                  level,
                  file,
                );
              }

              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      {levelReadOnly && (
        <p
          className="error-message"
          style={{ marginBottom: "16px" }}
        >
          {lockedBy ||
            "Another administrator"}{" "}
          is currently editing this configuration.
          You can view it, but editing is temporarily
          disabled.
        </p>
      )}

      <div className="level-card-header">
        <div>
          <span className="path-label">
            {level.level_code}
          </span>
          <h3>{level.display_name}</h3>
        </div>

        <span
          className={`status-badge ${
            level.configuration_status ===
            "ready"
              ? "status-active"
              : "status-inactive"
          }`}
        >
          {level.configuration_status}
        </span>
      </div>

      {editingLevelId === level.id ? (
        <div className="level-edit-form">
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label>Title</label>
              <input
                value={levelTitle}
                onChange={(event) =>
                  setLevelTitle(
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>
                Skill statement code
              </label>
              <input
                value={
                  levelSkillStatementCode
                }
                onChange={(event) =>
                  setLevelSkillStatementCode(
                    event.target.value,
                  )
                }
              />
            </div>
          </div>

          <div className="form-group">
            <label>Skill statement</label>
            <textarea
              value={levelSkillStatement}
              onChange={(event) =>
                setLevelSkillStatement(
                  event.target.value,
                )
              }
            />
          </div>

          <div className="form-group">
            <label>Objective</label>
            <textarea
              value={levelObjective}
              onChange={(event) =>
                setLevelObjective(
                  event.target.value,
                )
              }
            />
          </div>

          <div className="form-group">
            <label>Scenario</label>
            <textarea
              value={levelScenario}
              onChange={(event) =>
                setLevelScenario(
                  event.target.value,
                )
              }
            />
          </div>

          <div className="form-group">
            <label>Instructions</label>
            <textarea
              value={levelInstructions}
              onChange={(event) =>
                setLevelInstructions(
                  event.target.value,
                )
              }
            />
          </div>

          <div className="form-group">
            <label>Deliverables</label>
            <textarea
              value={levelDeliverables}
              onChange={(event) =>
                setLevelDeliverables(
                  event.target.value,
                )
              }
              placeholder="One deliverable per line"
            />
          </div>

          <div className="form-group">
            <label>Expected outcome</label>
            <textarea
              value={levelExpectedOutcome}
              onChange={(event) =>
                setLevelExpectedOutcome(
                  event.target.value,
                )
              }
            />
          </div>

          <div className="form-actions form-actions-compact">
            <button
              type="button"
              className="btn-primary"
              disabled={isSavingLevel}
              onClick={() =>
                void saveLevel(level)
              }
            >
              {isSavingLevel
                ? "Saving..."
                : "Save Requirements"}
            </button>

            <button
              type="button"
              className="btn-secondary"
              disabled={isSavingLevel}
              onClick={() =>
                setEditingLevelId("")
              }
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="overview-grid level-requirement-summary">
            <div>
              <span className="detail-label">
                Skill statement code
              </span>

              <strong>
                {level.skill_statement_code ||
                  "—"}
              </strong>
            </div>

            <div>
              <span className="detail-label">
                Title
              </span>

              <strong>
                {level.title || "—"}
              </strong>
            </div>
          </div>

          <div className="overview-stack">
            <div className="detail-block">
              <span className="detail-label">
                Skill statement
              </span>
              <p>
                {level.skill_statement || "—"}
              </p>
            </div>

            <div className="detail-block">
              <span className="detail-label">
                Objective
              </span>
              <p>{level.objective || "—"}</p>
            </div>

            <div className="detail-block">
              <span className="detail-label">
                Scenario
              </span>
              <p>{level.scenario || "—"}</p>
            </div>

            <div className="detail-block">
              <span className="detail-label">
                Instructions
              </span>
              <p>
                {level.instructions || "—"}
              </p>
            </div>

            <div className="detail-block">
              <span className="detail-label">
                Expected outcome
              </span>
              <p>
                {level.expected_outcome || "—"}
              </p>
            </div>
          </div>

          <div className="section-actions compact-section-header">
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                startEditingLevel(level)
              }
              disabled={levelReadOnly}
            >
              Edit Requirements
            </button>
          </div>
        </>
      )}
    </>
  );
}