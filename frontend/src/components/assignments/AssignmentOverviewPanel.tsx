import type {
  AssignmentLevel,
  ModuleAssignment,
} from "../../api/courses";

import type {
  RubricBand,
  RubricCriterion,
  Task,
} from "../../api/grading";

import type {
  TaskCriteriaMapping,
} from "../../api/taskCriteriaMappings";

type AssignmentOverviewPanelProps = {
  assignment: ModuleAssignment;
  levels: AssignmentLevel[];
  tasks: Task[];
  criteria: RubricCriterion[];
  bands: RubricBand[];
  taskCriteriaMappings: TaskCriteriaMapping[];
};

export function AssignmentOverviewPanel({
  assignment,
  levels,
  tasks,
  criteria,
  bands,
  taskCriteriaMappings,
}: AssignmentOverviewPanelProps) {
  return (
    <div className="workspace-panel">
      <div className="overview-grid">
        <div>
          <span className="detail-label">Qualification</span>
          <strong>{assignment.qualification_code}</strong>
        </div>

        <div>
          <span className="detail-label">Module</span>
          <strong>{assignment.module_code}</strong>
        </div>

        <div>
          <span className="detail-label">Assignment</span>
          <strong>{assignment.assignment_code}</strong>
        </div>

        <div>
          <span className="detail-label">Maximum score</span>
          <strong>{assignment.maximum_score}</strong>
        </div>
      </div>

      {levels.map((level) => {
        const levelTasks = tasks.filter(
          (task) => task.assignment_level === level.id,
        );

        const levelCriteria = criteria.filter(
          (criterion) => criterion.assignment_level === level.id,
        );

        const criterionIds = levelCriteria.map(
          (criterion) => criterion.id,
        );

        const levelBands = bands.filter(
          (band) => criterionIds.includes(band.rubric_criterion),
        );

        return (
          <div
            key={level.id}
            className="level-overview-card"
          >
            <div className="level-card-header">
              <div>
                <span className="path-label">
                  {level.display_name}
                </span>

                <h3>{level.display_name}</h3>
              </div>

              <span
                className={`status-badge ${
                  level.configuration_status === "ready"
                    ? "status-active"
                    : "status-inactive"
                }`}
              >
                {level.configuration_status}
              </span>
            </div>

            <div className="overview-grid">
              <div>
                <span className="detail-label">Skill code</span>
                <strong>
                  {level.skill_statement_code || "—"}
                </strong>
              </div>

              <div>
                <span className="detail-label">Tasks</span>
                <strong>{levelTasks.length}</strong>
              </div>

              <div>
                <span className="detail-label">Criteria</span>
                <strong>{levelCriteria.length}</strong>
              </div>

              <div>
                <span className="detail-label">Bands</span>
                <strong>{levelBands.length}</strong>
              </div>
            </div>

            <div className="detail-block">
              <span className="detail-label">Objective</span>
              <p>{level.objective || "—"}</p>
            </div>

            <div className="detail-block">
              <span className="detail-label">Skill statement</span>
              <p>{level.skill_statement || "—"}</p>
            </div>

            <div className="overview-subsection">
              <span className="detail-label">
                Task → Rubric mapping
              </span>

              {levelCriteria.length === 0 ? (
                <p>—</p>
              ) : (
                <div className="overview-mapping-list">
                  {levelCriteria.map((criterion) => {
                    const criterionMappings =
                      taskCriteriaMappings.filter(
                        (mapping) =>
                          mapping.rubric_criterion === criterion.id,
                      );

                    const mappedTasks = levelTasks.filter(
                      (task) =>
                        criterionMappings.some(
                          (mapping) => mapping.task === task.id,
                        ),
                    );

                    return (
                      <div
                        key={criterion.id}
                        className="overview-mapping-row"
                      >
                        <div className="overview-mapping-criterion">
                          <strong>{criterion.criterion_code}</strong>
                          <span>{criterion.title}</span>
                          <small>
                            {criterion.maximum_score} marks
                          </small>
                        </div>

                        <div className="overview-mapping-arrow">
                          →
                        </div>

                        <div className="overview-mapping-tasks">
                          {mappedTasks.length === 0 ? (
                            <span className="table-subtext">
                              No tasks assigned
                            </span>
                          ) : (
                            mappedTasks.map((task) => (
                              <span
                                key={task.id}
                                className="tag-pill"
                                title={task.title}
                              >
                                {task.task_code}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {levelTasks.some(
                (task) =>
                  !taskCriteriaMappings.some(
                    (mapping) =>
                      mapping.task === task.id &&
                      levelCriteria.some(
                        (criterion) =>
                          criterion.id ===
                          mapping.rubric_criterion,
                      ),
                  ),
              ) && (
                <div className="overview-unmapped-tasks">
                  <span className="detail-label">
                    Unassigned tasks
                  </span>

                  <div className="overview-mapping-tasks">
                    {levelTasks
                      .filter(
                        (task) =>
                          !taskCriteriaMappings.some(
                            (mapping) =>
                              mapping.task === task.id &&
                              levelCriteria.some(
                                (criterion) =>
                                  criterion.id ===
                                  mapping.rubric_criterion,
                              ),
                          ),
                      )
                      .map((task) => (
                        <span
                          key={task.id}
                          className="tag-pill"
                          title={task.title}
                        >
                          {task.task_code}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}