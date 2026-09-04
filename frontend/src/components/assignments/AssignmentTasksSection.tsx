import { X } from "lucide-react";

import type {
  AssignmentLevel,
} from "../../api/courses";

import type {
  Task,
} from "../../api/grading";

type AssignmentTasksSectionProps = {
  level: AssignmentLevel;
  levelReadOnly: boolean;

  levelTaskItems: Task[];

  taskFormLevelId: string;
  savingTaskLevelId: string;
  editingTaskId: string;
  isSavingTaskEdit: boolean;

  editTaskCode: string;
  editTaskTitle: string;
  editTaskEvidenceRequired: string;

  taskDraft: {
    task_code: string;
    title: string;
    evidence_required: string;
  };

  updateTaskDraft: (
    levelId: string,
    field: "task_code" | "title" | "evidence_required",
    value: string,
  ) => void;

  suggestedTaskCode: string;

  setTaskFormLevelId: (value: string) => void;

  setEditTaskCode: (value: string) => void;
  setEditTaskTitle: (value: string) => void;
  setEditTaskEvidenceRequired: (
    value: string,
  ) => void;

  saveNewTask: (
    event: React.FormEvent<HTMLFormElement>,
    level: AssignmentLevel,
  ) => void | Promise<void>;

  startEditingTask: (task: Task) => void;
  cancelTaskEdit: () => void;

  saveTaskEdit: (
    task: Task,
  ) => void | Promise<void>;

  removeTask: (
    task: Task,
  ) => void | Promise<void>;
};

export function AssignmentTasksSection({
  level,
  levelReadOnly,

  levelTaskItems,

  taskFormLevelId,
  savingTaskLevelId,
  editingTaskId,
  isSavingTaskEdit,

  editTaskCode,
  editTaskTitle,
  editTaskEvidenceRequired,

  taskDraft,
  suggestedTaskCode,

  setTaskFormLevelId,

  setEditTaskCode,
  setEditTaskTitle,
  setEditTaskEvidenceRequired,

  updateTaskDraft,
  saveNewTask,
  startEditingTask,
  cancelTaskEdit,
  saveTaskEdit,
  removeTask,
}: AssignmentTasksSectionProps) {
  return (
    <>
      <div className="section-header compact-section-header">
        <div>
          <h3>Assignment tasks</h3>
          <p className="section-description">
            Requirements the learner must complete for this submission level.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            setTaskFormLevelId(level.id)
          }
          disabled={levelReadOnly}
        >
          + Add Task
        </button>
      </div>

      {levelTaskItems.length === 0 ? (
        <div className="empty-state">
          No tasks added yet.
        </div>
      ) : (
        <div className="table-container rubric-table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Task</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {levelTaskItems.map((task) => {
                const isEditingTask =
                  editingTaskId === task.id;

                return (
                  <tr key={task.id}>
                    <td>
                      {isEditingTask ? (
                        <input
                          value={editTaskCode}
                          onChange={(event) =>
                            setEditTaskCode(
                              event.target.value,
                            )
                          }
                        />
                      ) : (
                        task.task_code
                      )}
                    </td>

                    <td>
                      {isEditingTask ? (
                        <div className="inline-edit-stack">
                          <input
                            value={editTaskTitle}
                            onChange={(event) =>
                              setEditTaskTitle(
                                event.target.value,
                              )
                            }
                          />

                          <textarea
                            value={
                              editTaskEvidenceRequired
                            }
                            onChange={(event) =>
                              setEditTaskEvidenceRequired(
                                event.target.value,
                              )
                            }
                            placeholder="Evidence required"
                          />
                        </div>
                      ) : (
                        <>
                          <strong>
                            {task.title}
                          </strong>

                          {task.evidence_required && (
                            <small className="table-subtext">
                              {
                                task.evidence_required
                              }
                            </small>
                          )}
                        </>
                      )}
                    </td>

                    <td className="table-actions">
                      {isEditingTask ? (
                        <>
                          <button
                            type="button"
                            className="btn-table"
                            disabled={
                              isSavingTaskEdit ||
                              !editTaskTitle.trim()
                            }
                            onClick={() =>
                              void saveTaskEdit(
                                task,
                              )
                            }
                          >
                            {isSavingTaskEdit
                              ? "Saving..."
                              : "Save"}
                          </button>

                          <button
                            type="button"
                            className="btn-table"
                            disabled={
                              isSavingTaskEdit
                            }
                            onClick={
                              cancelTaskEdit
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
                            disabled={
                              levelReadOnly
                            }
                            onClick={() =>
                              startEditingTask(
                                task,
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="btn-table btn-table-danger"
                            disabled={
                              levelReadOnly
                            }
                            onClick={() =>
                              void removeTask(
                                task,
                              )
                            }
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {taskFormLevelId === level.id && (
        <div className="config-modal-backdrop">
          <div className="config-modal">
            <div className="config-modal-header">
              <h3>Add Task</h3>

              <button
                type="button"
                className="config-modal-close"
                onClick={() =>
                  setTaskFormLevelId("")
                }
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="modern-form"
              onSubmit={(event) =>
                void saveNewTask(
                  event,
                  level,
                )
              }
            >
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label>
                    Task code
                  </label>

                  <input
                    value={
                      taskDraft.task_code
                    }
                    placeholder={
                      suggestedTaskCode
                    }
                    onChange={(event) =>
                      updateTaskDraft(
                        level.id,
                        "task_code",
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Task</label>

                  <input
                    value={
                      taskDraft.title
                    }
                    onChange={(event) =>
                      updateTaskDraft(
                        level.id,
                        "title",
                        event.target.value,
                      )
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  Evidence required
                </label>

                <textarea
                  value={taskDraft.evidence_required}
                  onChange={(event) =>
                    updateTaskDraft(
                      level.id,
                      "evidence_required",
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
                    setTaskFormLevelId("")
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    savingTaskLevelId ===
                    level.id
                  }
                >
                  {savingTaskLevelId ===
                    level.id
                    ? "Adding..."
                    : "Add Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}