import { Search } from "lucide-react";
import type { FormEvent } from "react";

import type {
  Module,
  ModuleAssignment,
  Qualification,
} from "../../api/courses";

import { AuditTrailButton } from "../AuditTrailButton";

type AssignmentListContentProps = {
  filteredAssignments: ModuleAssignment[];
  qualifications: Qualification[];
  filteredModules: Module[];

  selectedAssignmentId: string;
  searchTerm: string;
  showCreateAssignment: boolean;

  qualificationId: string;
  moduleId: string;
  code: string;
  maximumScore: string;
  minimumPassScore: string;
  finalMarkWeight: string;

  isSummative: boolean;
  contributesToFinalMark: boolean;
  isActive: boolean;
  isSubmitting: boolean;

  setSearchTerm: (value: string) => void;
  setShowCreateAssignment: (
    value: boolean | ((current: boolean) => boolean),
  ) => void;

  setQualificationId: (value: string) => void;
  setModuleId: (value: string) => void;
  setCode: (value: string) => void;
  setMaximumScore: (value: string) => void;
  setMinimumPassScore: (value: string) => void;
  setFinalMarkWeight: (value: string) => void;

  setIsSummative: (value: boolean) => void;
  setContributesToFinalMark: (value: boolean) => void;
  setIsActive: (value: boolean) => void;

  handleSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void | Promise<void>;

  setSelectedAssignmentId: (value: string) => void;
  setActiveWorkspaceTab: (
    value: "overview" | "configuration",
  ) => void;

  startEditingAssignment: (
    assignment: ModuleAssignment,
  ) => void;

  openAssignmentDelete: (
    assignmentId: string,
  ) => void | Promise<void>;
};

export function AssignmentListContent({
  filteredAssignments,
  qualifications,
  filteredModules,
  selectedAssignmentId,
  searchTerm,
  showCreateAssignment,
  qualificationId,
  moduleId,
  code,
  maximumScore,
  minimumPassScore,
  finalMarkWeight,
  isSummative,
  contributesToFinalMark,
  isActive,
  isSubmitting,
  setSearchTerm,
  setShowCreateAssignment,
  setQualificationId,
  setModuleId,
  setCode,
  setMaximumScore,
  setMinimumPassScore,
  setFinalMarkWeight,
  setIsSummative,
  setContributesToFinalMark,
  setIsActive,
  handleSubmit,
  setSelectedAssignmentId,
  setActiveWorkspaceTab,
  startEditingAssignment,
  openAssignmentDelete,
}: AssignmentListContentProps) {
  return (
    <>
      <div className="section-header">
        <div>
          <h2>Assignment list</h2>
          <p className="section-description">
            Select an assignment to open its workspace.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />

            <input
              type="text"
              placeholder="Search assignments..."
              value={searchTerm}
              onChange={(e) =>
                setSearchTerm(e.target.value)
              }
              style={{
                paddingLeft: "32px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                width: "250px",
                fontSize: "14px",
              }}
            />
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              setShowCreateAssignment(
                (current) => !current,
              )
            }
          >
            {showCreateAssignment
              ? "Close"
              : "+ New Assignment"}
          </button>
        </div>
      </div>

      {showCreateAssignment && (
        <form
          onSubmit={handleSubmit}
          className="modern-form assignment-create-form"
        >
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label htmlFor="assignment-qualification">
                Qualification
              </label>

              <select
                id="assignment-qualification"
                value={qualificationId}
                onChange={(event) => {
                  setQualificationId(
                    event.target.value,
                  );
                  setModuleId("");
                }}
                required
              >
                <option value="">
                  Select qualification
                </option>

                {qualifications.map(
                  (qualification) => (
                    <option
                      key={qualification.id}
                      value={qualification.id}
                    >
                      {
                        qualification.qualification_code
                      }{" "}
                      -{" "}
                      {
                        qualification.qualification_name
                      }
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="assignment-module">
                Module
              </label>

              <select
                id="assignment-module"
                value={moduleId}
                onChange={(event) =>
                  setModuleId(event.target.value)
                }
                disabled={!qualificationId}
                required
              >
                <option value="">
                  Select module
                </option>

                {filteredModules.map((module) => (
                  <option
                    key={module.id}
                    value={module.id}
                  >
                    {module.module_code} -{" "}
                    {module.module_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="assignment-code">
                Code
              </label>

              <input
                id="assignment-code"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value)
                }
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="maximum-score">
                Maximum score
              </label>

              <input
                id="maximum-score"
                type="number"
                min="0"
                step="0.01"
                value={maximumScore}
                onChange={(event) =>
                  setMaximumScore(
                    event.target.value,
                  )
                }
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="minimum-pass-score">
                Minimum pass score
              </label>

              <input
                id="minimum-pass-score"
                type="number"
                min="0"
                step="0.01"
                value={minimumPassScore}
                onChange={(event) =>
                  setMinimumPassScore(
                    event.target.value,
                  )
                }
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="final-mark-weight">
                Final mark weight
              </label>

              <input
                id="final-mark-weight"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={finalMarkWeight}
                onChange={(event) =>
                  setFinalMarkWeight(
                    event.target.value,
                  )
                }
                disabled={!contributesToFinalMark}
                required={contributesToFinalMark}
              />
            </div>
          </div>

          <div className="checkbox-row">
            <label className="checkbox-group">
              <input
                type="checkbox"
                checked={isSummative}
                onChange={(event) =>
                  setIsSummative(
                    event.target.checked,
                  )
                }
              />
              Summative
            </label>

            <label className="checkbox-group">
              <input
                type="checkbox"
                checked={contributesToFinalMark}
                onChange={(event) =>
                  setContributesToFinalMark(
                    event.target.checked,
                  )
                }
              />
              Contributes to final mark
            </label>

            <label className="checkbox-group">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) =>
                  setIsActive(event.target.checked)
                }
              />
              Active
            </label>
          </div>

          <div className="form-actions form-actions-compact">
            <button
              type="submit"
              className="btn-primary"
              disabled={
                isSubmitting ||
                !qualificationId ||
                !moduleId
              }
            >
              {isSubmitting
                ? "Creating..."
                : "Create Assignment"}
            </button>

            <button
              type="button"
              className="btn-secondary"
              disabled={isSubmitting}
              onClick={() =>
                setShowCreateAssignment(false)
              }
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {filteredAssignments.length === 0 ? (
        <div className="empty-state">
          No assignments found.
        </div>
      ) : (
        <div className="table-container assignment-table-container">
          <table className="modern-table assignment-table">
            <thead>
              <tr>
                <th>Qualification</th>
                <th>Module</th>
                <th>No.</th>
                <th>Code</th>
                <th>Max</th>
                <th>Pass</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredAssignments.map(
                (assignment) => {
                  const isSelected =
                    selectedAssignmentId ===
                    assignment.id;

                  return (
                    <tr
                      key={assignment.id}
                      className={
                        isSelected
                          ? "selected-row"
                          : undefined
                      }
                      onClick={() => {
                        setSelectedAssignmentId(
                          assignment.id,
                        );
                        setActiveWorkspaceTab(
                          "overview",
                        );
                      }}
                    >
                      <td>
                        {
                          assignment.qualification_code
                        }
                      </td>

                      <td>
                        {assignment.module_code}
                      </td>

                      <td>-</td>

                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span>
                            {
                              assignment.assignment_code
                            }
                          </span>

                          {assignment.is_summative && (
                            <span
                              className="status-badge"
                              style={{
                                fontSize: "11px",
                                padding: "2px 7px",
                              }}
                            >
                              Summative
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        {assignment.maximum_score}
                      </td>

                      <td>
                        {
                          assignment.minimum_pass_score
                        }
                      </td>

                      <td>
                        <span
                          className={`status-badge ${
                            assignment.is_active
                              ? "status-active"
                              : "status-inactive"
                          }`}
                        >
                          {assignment.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td
                        className="table-actions"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <AuditTrailButton
                            objectType="assignment"
                            objectId={
                              assignment.id
                            }
                            label={
                              assignment.assignment_code
                            }
                          />

                          <button
                            type="button"
                            className="btn-table"
                            onClick={() =>
                              startEditingAssignment(
                                assignment,
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="btn-table btn-table-danger"
                            onClick={() =>
                              void openAssignmentDelete(
                                assignment.id,
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}