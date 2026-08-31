import { X } from "lucide-react";
import type { FormEvent } from "react";

import type { ModuleAssignment } from "../../api/courses";
import type { AssignmentDeleteImpact } from "../../api/assignmentDelete";

type AssignmentManagementModalsProps = {
  assignments: ModuleAssignment[];

  editingAssignmentId: string;
  deleteAssignmentId: string;

  editCode: string;
  editMaximumScore: string;
  editMinimumPassScore: string;
  editIsSummative: boolean;
  editContributesToFinalMark: boolean;
  editFinalMarkWeight: string;
  editIsActive: boolean;

  isSavingAssignmentEdit: boolean;

  deleteImpact: AssignmentDeleteImpact | null;
  isCheckingDeleteImpact: boolean;
  isDeletingAssignment: boolean;

  setEditCode: (value: string) => void;
  setEditMaximumScore: (value: string) => void;
  setEditMinimumPassScore: (value: string) => void;
  setEditIsSummative: (value: boolean) => void;
  setEditContributesToFinalMark: (value: boolean) => void;
  setEditFinalMarkWeight: (value: string) => void;
  setEditIsActive: (value: boolean) => void;

  closeAssignmentEdit: () => void;
  closeAssignmentDelete: () => void;

  saveAssignmentEdit: (
    event: FormEvent<HTMLFormElement>,
    assignment: ModuleAssignment,
  ) => void | Promise<void>;

  confirmAssignmentDelete: () => void | Promise<void>;
};

export function AssignmentManagementModals({
  assignments,
  editingAssignmentId,
  deleteAssignmentId,

  editCode,
  editMaximumScore,
  editMinimumPassScore,
  editIsSummative,
  editContributesToFinalMark,
  editFinalMarkWeight,
  editIsActive,

  isSavingAssignmentEdit,

  deleteImpact,
  isCheckingDeleteImpact,
  isDeletingAssignment,

  setEditCode,
  setEditMaximumScore,
  setEditMinimumPassScore,
  setEditIsSummative,
  setEditContributesToFinalMark,
  setEditFinalMarkWeight,
  setEditIsActive,

  closeAssignmentEdit,
  closeAssignmentDelete,
  saveAssignmentEdit,
  confirmAssignmentDelete,
}: AssignmentManagementModalsProps) {
  return (
    <>
      {editingAssignmentId && (() => {
        const assignment = assignments.find(
          (item) => item.id === editingAssignmentId,
        );

        if (!assignment) return null;

        return (
          <div className="config-modal-backdrop">
            <div className="config-modal">
              <div className="config-modal-header">
                <div>
                  <h3>Edit Assignment</h3>
                  <p className="section-description">
                    {assignment.qualification_code} → {assignment.module_code}
                  </p>
                </div>

                <button
                  type="button"
                  className="config-modal-close"
                  onClick={closeAssignmentEdit}
                  disabled={isSavingAssignmentEdit}
                >
                  <X size={20} />
                </button>
              </div>

              <form
                className="modern-form"
                onSubmit={(event) =>
                  void saveAssignmentEdit(event, assignment)
                }
              >
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label>Qualification</label>
                    <input
                      value={assignment.qualification_code}
                      disabled
                    />
                  </div>

                  <div className="form-group">
                    <label>Module</label>
                    <input
                      value={assignment.module_code}
                      disabled
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-assignment-code">
                      Code
                    </label>
                    <input
                      id="edit-assignment-code"
                      value={editCode}
                      onChange={(event) =>
                        setEditCode(event.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-maximum-score">
                      Maximum score
                    </label>
                    <input
                      id="edit-maximum-score"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editMaximumScore}
                      onChange={(event) =>
                        setEditMaximumScore(event.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-minimum-pass-score">
                      Minimum pass score
                    </label>
                    <input
                      id="edit-minimum-pass-score"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editMinimumPassScore}
                      onChange={(event) =>
                        setEditMinimumPassScore(event.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-final-mark-weight">
                      Final mark weight
                    </label>
                    <input
                      id="edit-final-mark-weight"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={editFinalMarkWeight}
                      onChange={(event) =>
                        setEditFinalMarkWeight(event.target.value)
                      }
                      disabled={!editContributesToFinalMark}
                      required={editContributesToFinalMark}
                    />
                  </div>
                </div>

                <div className="checkbox-row">
                  <label className="checkbox-group">
                    <input
                      type="checkbox"
                      checked={editIsSummative}
                      onChange={(event) =>
                        setEditIsSummative(event.target.checked)
                      }
                    />
                    Summative
                  </label>

                  <label className="checkbox-group">
                    <input
                      type="checkbox"
                      checked={editContributesToFinalMark}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setEditContributesToFinalMark(checked);

                        if (!checked) {
                          setEditFinalMarkWeight("0");
                        } else if (Number(editFinalMarkWeight) <= 0) {
                          setEditFinalMarkWeight(
                            assignment.final_mark_weight || "100",
                          );
                        }
                      }}
                    />
                    Contributes to final mark
                  </label>

                  <label className="checkbox-group">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(event) =>
                        setEditIsActive(event.target.checked)
                      }
                    />
                    Active
                  </label>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeAssignmentEdit}
                    disabled={isSavingAssignmentEdit}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={
                      isSavingAssignmentEdit ||
                      !editCode.trim()
                    }
                  >
                    {isSavingAssignmentEdit
                      ? "Saving..."
                      : "Save Assignment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {deleteAssignmentId && (
        <div className="config-modal-backdrop">
          <div className="config-modal assignment-delete-modal">
            <div className="config-modal-header">
              <div>
                <h3>Delete Assignment?</h3>
                <p className="section-description">
                  {assignments.find(
                    (assignment) =>
                      assignment.id === deleteAssignmentId,
                  )?.assignment_code}
                </p>
              </div>

              <button
                type="button"
                className="config-modal-close"
                onClick={closeAssignmentDelete}
                disabled={isDeletingAssignment}
              >
                <X size={20} />
              </button>
            </div>

            {isCheckingDeleteImpact || !deleteImpact ? (
              <p>Checking assignment dependencies...</p>
            ) : !deleteImpact.can_delete ? (
              <>
                <div className="delete-warning-block">
                  <strong>
                    This assignment cannot be deleted.
                  </strong>
                  <p>
                    It is currently tied to LMS or learner submission
                    records. Remove those dependencies first.
                  </p>
                </div>

                <div className="delete-impact-list">
                  {deleteImpact.blockers.assessment_mappings.length > 0 && (
                    <div>
                      <strong>
                        LMS assessment mappings (
                        {deleteImpact.blockers.assessment_mappings.length})
                      </strong>

                      <ul>
                        {deleteImpact.blockers.assessment_mappings.map(
                          (mapping) => (
                            <li key={mapping.id}>
                              {mapping.name} — {mapping.cohort}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}

                  {deleteImpact.blockers.submissions > 0 && (
                    <div>
                      <strong>
                        Learner submissions:{" "}
                        {deleteImpact.blockers.submissions}
                      </strong>
                      <p className="table-subtext">
                        Submission history is protected and will never
                        be silently deleted.
                      </p>
                    </div>
                  )}
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeAssignmentDelete}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="delete-warning-block">
                  <strong>This action is permanent.</strong>
                  <p>
                    The assignment has no LMS mapping or learner
                    submission blockers. Its unused configuration
                    records below will also be removed.
                  </p>
                </div>

                <div className="delete-impact-grid">
                  <div>
                    <span>Submission levels</span>
                    <strong>
                      {deleteImpact.affected.assignment_levels}
                    </strong>
                  </div>

                  <div>
                    <span>Tasks</span>
                    <strong>
                      {deleteImpact.affected.tasks}
                    </strong>
                  </div>

                  <div>
                    <span>Rubric criteria</span>
                    <strong>
                      {deleteImpact.affected.rubric_criteria}
                    </strong>
                  </div>

                  <div>
                    <span>Rubric bands</span>
                    <strong>
                      {deleteImpact.affected.rubric_bands}
                    </strong>
                  </div>

                  <div>
                    <span>Task mappings</span>
                    <strong>
                      {deleteImpact.affected.task_criteria_mappings}
                    </strong>
                  </div>

                  <div>
                    <span>Empty submission contexts</span>
                    <strong>
                      {deleteImpact.affected.submission_contexts}
                    </strong>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeAssignmentDelete}
                    disabled={isDeletingAssignment}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn-table btn-table-danger"
                    onClick={() =>
                      void confirmAssignmentDelete()
                    }
                    disabled={isDeletingAssignment}
                  >
                    {isDeletingAssignment
                      ? "Deleting..."
                      : "Delete Assignment"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}