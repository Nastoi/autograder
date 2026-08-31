import { X } from "lucide-react";

import type { AssignmentLevel } from "../../api/courses";

import type {
  RubricCriterion,
  Task,
} from "../../api/grading";

import type {
  TaskCriteriaMapping,
} from "../../api/taskCriteriaMappings";

type AssignmentCriteriaSectionProps = {
  level: AssignmentLevel;
  levelReadOnly: boolean;

  levelCriteria: RubricCriterion[];
  levelTaskItems: Task[];
  taskCriteriaMappings: TaskCriteriaMapping[];

  hasUnmappedCriteria: boolean;

  criterionFormLevelId: string;
  criterionCode: string;
  criterionTitle: string;
  criterionDescription: string;
  criterionMaximumScore: string;
  isSavingCriterion: boolean;

  editingCriterionId: string;
  editCriterionTitle: string;
  editCriterionDescription: string;
  editCriterionMaximumScore: string;

  suggestedCriterionCode: string;

  activeMappingCriterion:
    | RubricCriterion
    | undefined;

  selectedMappingTaskIds: string[];
  isSavingTaskMapping: boolean;

  setCriterionFormLevelId: (
    value: string,
  ) => void;

  setCriterionCode: (
    value: string,
  ) => void;

  setCriterionTitle: (
    value: string,
  ) => void;

  setCriterionDescription: (
    value: string,
  ) => void;

  setCriterionMaximumScore: (
    value: string,
  ) => void;

  setEditingCriterionId: (
    value: string,
  ) => void;

  setEditCriterionTitle: (
    value: string,
  ) => void;

  setEditCriterionDescription: (
    value: string,
  ) => void;

  setEditCriterionMaximumScore: (
    value: string,
  ) => void;

  setMappingCriterionId: (
    value: string,
  ) => void;

  setSelectedMappingTaskIds: (
    value: string[],
  ) => void;

  saveCriterion: (
    event: React.FormEvent<HTMLFormElement>,
    assignmentLevelId: string,
  ) => void | Promise<void>;

  openTaskMapping: (
    criterion: RubricCriterion,
  ) => void;

  startEditingCriterion: (
    criterion: RubricCriterion,
  ) => void;

  saveCriterionEdit: (
    criterion: RubricCriterion,
  ) => void | Promise<void>;

  removeCriterion: (
    criterionId: string,
  ) => void | Promise<void>;

  toggleTaskMappingSelection: (
    taskId: string,
  ) => void;

  saveTaskMappings: (
    criterion: RubricCriterion,
    level: AssignmentLevel,
  ) => void | Promise<void>;
};

export function AssignmentCriteriaSection({
  level,
  levelReadOnly,

  levelCriteria,
  levelTaskItems,
  taskCriteriaMappings,

  hasUnmappedCriteria,

  criterionFormLevelId,
  criterionCode,
  criterionTitle,
  criterionDescription,
  criterionMaximumScore,
  isSavingCriterion,

  editingCriterionId,
  editCriterionTitle,
  editCriterionDescription,
  editCriterionMaximumScore,

  suggestedCriterionCode,

  activeMappingCriterion,

  selectedMappingTaskIds,
  isSavingTaskMapping,

  setCriterionFormLevelId,
  setCriterionCode,
  setCriterionTitle,
  setCriterionDescription,
  setCriterionMaximumScore,

  setEditingCriterionId,
  setEditCriterionTitle,
  setEditCriterionDescription,
  setEditCriterionMaximumScore,

  setMappingCriterionId,
  setSelectedMappingTaskIds,

  saveCriterion,

  openTaskMapping,
  startEditingCriterion,
  saveCriterionEdit,
  removeCriterion,

  toggleTaskMappingSelection,
  saveTaskMappings,
}: AssignmentCriteriaSectionProps) {
  return (
    <section className="rubric-section level-rubric-section">
      <div className="section-header compact-section-header">
        <div>
          <h3>
            {level.display_name} rubric criteria
          </h3>

          <p className="section-description">
            Criteria for this submission path.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            setCriterionFormLevelId(level.id)
          }
          disabled={levelReadOnly}
        >
          + Add Criterion
        </button>
      </div>

      {hasUnmappedCriteria && (
        <p className="error-message">
          Every rubric criterion must be assigned
          to at least one task before grading.
        </p>
      )}

      {criterionFormLevelId === level.id && (
        <div className="config-modal-backdrop">
          <div className="config-modal">
            <div className="config-modal-header">
              <h3>Add Rubric Criterion</h3>

              <button
                type="button"
                className="config-modal-close"
                onClick={() =>
                  setCriterionFormLevelId("")
                }
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="modern-form"
              onSubmit={(event) =>
                void saveCriterion(
                  event,
                  level.id,
                )
              }
            >
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label>
                    Criterion code
                  </label>

                  <input
                    value={criterionCode}
                    placeholder={
                      suggestedCriterionCode
                    }
                    onChange={(event) =>
                      setCriterionCode(
                        event.target.value,
                      )
                    }
                  />

                  <small className="table-subtext">
                    Leave blank to use{" "}
                    {suggestedCriterionCode}.
                  </small>
                </div>

                <div className="form-group">
                  <label>Title</label>

                  <input
                    value={criterionTitle}
                    onChange={(event) =>
                      setCriterionTitle(
                        event.target.value,
                      )
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    Maximum score
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      criterionMaximumScore
                    }
                    onChange={(event) =>
                      setCriterionMaximumScore(
                        event.target.value,
                      )
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>

                <textarea
                  value={
                    criterionDescription
                  }
                  onChange={(event) =>
                    setCriterionDescription(
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setCriterionFormLevelId("")
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    isSavingCriterion
                  }
                >
                  {isSavingCriterion
                    ? "Adding..."
                    : "Add Criterion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {levelCriteria.length === 0 ? (
        <div className="empty-state">
          No rubric criteria added yet.
        </div>
      ) : (
        <div className="table-container rubric-table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Criterion</th>
                <th>Max</th>
                <th>Assigned tasks</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {levelCriteria.map(
                (criterion) => {
                  const isEditing =
                    editingCriterionId ===
                    criterion.id;

                  const criterionMappings =
                    taskCriteriaMappings.filter(
                      (mapping) =>
                        mapping.rubric_criterion ===
                        criterion.id,
                    );

                  const assignedTasks =
                    levelTaskItems.filter(
                      (task) =>
                        criterionMappings.some(
                          (mapping) =>
                            mapping.task ===
                            task.id,
                        ),
                    );

                  return (
                    <tr key={criterion.id}>
                      <td>
                        {
                          criterion.criterion_code
                        }
                      </td>

                      <td>
                        {isEditing ? (
                          <div className="inline-edit-stack">
                            <input
                              value={
                                editCriterionTitle
                              }
                              onChange={(
                                event,
                              ) =>
                                setEditCriterionTitle(
                                  event.target
                                    .value,
                                )
                              }
                            />

                            <textarea
                              value={
                                editCriterionDescription
                              }
                              onChange={(
                                event,
                              ) =>
                                setEditCriterionDescription(
                                  event.target
                                    .value,
                                )
                              }
                            />
                          </div>
                        ) : (
                          <div>
                            <strong>
                              {
                                criterion.title
                              }
                            </strong>

                            {criterion.description && (
                              <small className="table-subtext">
                                {
                                  criterion.description
                                }
                              </small>
                            )}
                          </div>
                        )}
                      </td>

                      <td>
                        {isEditing ? (
                          <input
                            className="table-number-input"
                            type="number"
                            step="0.01"
                            value={
                              editCriterionMaximumScore
                            }
                            onChange={(
                              event,
                            ) =>
                              setEditCriterionMaximumScore(
                                event.target
                                  .value,
                              )
                            }
                          />
                        ) : (
                          criterion.maximum_score
                        )}
                      </td>

                      <td>
                        {assignedTasks.length ===
                        0 ? (
                          <span className="table-subtext">
                            None
                          </span>
                        ) : (
                          <div className="criterion-task-tags">
                            {assignedTasks.map(
                              (task) => (
                                <span
                                  key={task.id}
                                  className="tag-pill"
                                  title={
                                    task.title
                                  }
                                >
                                  {
                                    task.task_code
                                  }
                                </span>
                              ),
                            )}
                          </div>
                        )}
                      </td>

                      <td className="table-actions">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="btn-table"
                              onClick={() =>
                                void saveCriterionEdit(
                                  criterion,
                                )
                              }
                            >
                              Save
                            </button>

                            <button
                              type="button"
                              className="btn-table"
                              onClick={() =>
                                setEditingCriterionId(
                                  "",
                                )
                              }
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn-table"
                              onClick={() =>
                                openTaskMapping(
                                  criterion,
                                )
                              }
                              disabled={
                                levelReadOnly
                              }
                            >
                              Assign Tasks
                            </button>

                            <button
                              type="button"
                              className="btn-table"
                              onClick={() =>
                                startEditingCriterion(
                                  criterion,
                                )
                              }
                              disabled={
                                levelReadOnly
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="btn-table btn-table-danger"
                              onClick={() =>
                                void removeCriterion(
                                  criterion.id,
                                )
                              }
                              disabled={
                                levelReadOnly
                              }
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeMappingCriterion && (
        <div className="config-modal-backdrop">
          <div
            className="config-modal"
            style={{
              width: "min(900px, 92vw)",
              maxWidth: "900px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="config-modal-header">
              <div>
                <h3>
                  Assign Tasks to Rubric
                  Criterion
                </h3>

                <p className="section-description">
                  {
                    activeMappingCriterion.criterion_code
                  }{" "}
                  —{" "}
                  {
                    activeMappingCriterion.title
                  }
                </p>
              </div>

              <button
                type="button"
                className="config-modal-close"
                onClick={() => {
                  setMappingCriterionId("");
                  setSelectedMappingTaskIds(
                    [],
                  );
                }}
              >
                <X size={20} />
              </button>
            </div>

            {levelTaskItems.length === 0 ? (
              <div className="empty-state">
                No tasks exist for this submission
                level yet. Add tasks first, then
                assign them to the criterion.
              </div>
            ) : (
              <div
                className="task-mapping-list"
                style={{
                  maxHeight: "55vh",
                  overflowY: "auto",
                  paddingRight: "4px",
                }}
              >
                {levelTaskItems.map(
                  (task) => {
                    const checked =
                      selectedMappingTaskIds.includes(
                        task.id,
                      );

                    return (
                      <label
                        key={task.id}
                        className={
                          checked
                            ? "task-mapping-option selected"
                            : "task-mapping-option"
                        }
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            toggleTaskMappingSelection(
                              task.id,
                            )
                          }
                        />

                        <div>
                          <strong>
                            {task.task_code} —{" "}
                            {task.title}
                          </strong>

                          {task.instructions && (
                            <small className="table-subtext">
                              {
                                task.instructions
                              }
                            </small>
                          )}
                        </div>
                      </label>
                    );
                  },
                )}
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={
                  isSavingTaskMapping
                }
                onClick={() => {
                  setMappingCriterionId("");
                  setSelectedMappingTaskIds(
                    [],
                  );
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-primary"
                disabled={
                  isSavingTaskMapping ||
                  levelTaskItems.length === 0
                }
                onClick={() =>
                  void saveTaskMappings(
                    activeMappingCriterion,
                    level,
                  )
                }
              >
                {isSavingTaskMapping
                  ? "Saving..."
                  : "Save Task Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}