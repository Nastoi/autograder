import "../css/AssessmentMappings.css";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";


import {
  createAssignmentLevel,
  getAssignmentLevels,
  getGradingConfigurations,
  getModuleAssignments,
  getModules,
  getQualifications,
  type AssignmentLevel,
  type GradingConfiguration,
  type Module,
  type ModuleAssignment,
  type Qualification,
} from "../api/lms";

export function AssignmentLevelsPage() {
  const [levels, setLevels] = useState<AssignmentLevel[]>([]);
  const [assignments, setAssignments] = useState<
    ModuleAssignment[]
  >([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [qualifications, setQualifications] = useState<
    Qualification[]
  >([]);
  const [gradingConfigurations, setGradingConfigurations] =
    useState<GradingConfiguration[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [qualificationId, setQualificationId] =
  useState("");

const [moduleId, setModuleId] = useState("");
const [assignmentId, setAssignmentId] = useState("");
const [gradingConfigurationId, setGradingConfigurationId] =
  useState("");

const [levelCode, setLevelCode] =
  useState<AssignmentLevel["level_code"]>(
    "foundation",
  );

const [displayName, setDisplayName] =
  useState("Foundation");

const [title, setTitle] = useState("");
const [instructions, setInstructions] = useState("");
const [tasksText, setTasksText] = useState("");
const [deliverablesText, setDeliverablesText] =
  useState("");
const [expectedOutcome, setExpectedOutcome] =
  useState("");

const [version, setVersion] = useState("1");

const [configurationStatus, setConfigurationStatus] =
  useState<
    AssignmentLevel["configuration_status"]
  >("draft");

const [isActive, setIsActive] = useState(true);
const [isSubmitting, setIsSubmitting] =
  useState(false);

  const filteredModules = modules.filter(
  (module) =>
    !qualificationId ||
    module.qualification === qualificationId,
);

const filteredAssignments = assignments.filter(
  (assignment) =>
    !moduleId ||
    assignment.module === moduleId,
);

const activeGradingConfigurations =
  gradingConfigurations.filter(
    (configuration) => configuration.is_active,
  );

  useEffect(() => {
    async function loadData() {
      try {
        const [
          levelData,
          assignmentData,
          moduleData,
          qualificationData,
          gradingConfigurationData,
        ] = await Promise.all([
          getAssignmentLevels(),
          getModuleAssignments(),
          getModules(),
          getQualifications(),
          getGradingConfigurations(),
        ]);

        setLevels(levelData);
        setAssignments(assignmentData);
        setModules(moduleData);
        setQualifications(qualificationData);
        setGradingConfigurations(
          gradingConfigurationData,
        );
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load assignment levels.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, []);


  async function handleSubmit(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  setError("");
  setIsSubmitting(true);

  try {
    const tasks = tasksText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const deliverables = deliverablesText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    await createAssignmentLevel({
      assignment: assignmentId,
      grading_configuration:
        gradingConfigurationId,
      level_code: levelCode,
      display_name: displayName,
      title,
      instructions,
      tasks,
      deliverables,
      expected_outcome: expectedOutcome,
      source_filename: null,
      version: Number(version),
      configuration_status:
        configurationStatus,
      is_active: isActive,
    });

    setAssignmentId("");
    setGradingConfigurationId("");
    setLevelCode("foundation");
    setDisplayName("Foundation");
    setTitle("");
    setInstructions("");
    setTasksText("");
    setDeliverablesText("");
    setExpectedOutcome("");
    setVersion("1");
    setConfigurationStatus("draft");
    setIsActive(true);

    const data = await getAssignmentLevels();
    setLevels(data);
  } catch (caughtError) {
    setError(
      caughtError instanceof Error
        ? caughtError.message
        : "Unable to create assignment level.",
    );
  } finally {
    setIsSubmitting(false);
  }
}


  if (isLoading) {
    return <main className="admin-container">Loading assignment levels...</main>;
  }

  return (
    <main className="admin-container">
      <div className="admin-header">
                <h1>Assignment levels</h1>
            </div>

      {error && <p role="alert" className="error-message">{error}</p>}

      <section>
        <h2>Setup status</h2>

        <div className="status-grid">
          <div className="status-card">
              <span className="status-label">Qualifications</span>
              <span className="status-value">{qualifications.length}</span>
            </div>
          <div className="status-card">
              <span className="status-label">Modules</span>
              <span className="status-value">{modules.length}</span>
            </div>
          <div className="status-card">
              <span className="status-label">Assignments</span>
              <span className="status-value">{assignments.length}</span>
            </div>
          <div className="status-card">
              <span className="status-label">Grading configurations</span>
              <span className="status-value">{" "}
          {gradingConfigurations.length}</span>
            </div>
          <div className="status-card">
              <span className="status-label">Assignment levels</span>
              <span className="status-value">{levels.length}</span>
            </div>
        </div>
      </section>


        <section>
  <h2 style={{ marginBottom: "16px", color: "white" }}>Add assignment level</h2>

  <form onSubmit={handleSubmit} className="modern-form">
    <div className="form-group">
      <label htmlFor="level-qualification">
        Qualification
      </label>

      <select
        id="level-qualification"
        value={qualificationId}
        onChange={(event) => {
          setQualificationId(event.target.value);
          setModuleId("");
          setAssignmentId("");
        }}
        required
      >
        <option value="">
          Select qualification
        </option>

        {qualifications.map((qualification) => (
          <option
            key={qualification.id}
            value={qualification.id}
          >
            {qualification.code} - {qualification.name}
          </option>
        ))}
      </select>
    </div>

    <div className="form-group">
      <label htmlFor="level-module">Module</label>

      <select
        id="level-module"
        value={moduleId}
        onChange={(event) => {
          setModuleId(event.target.value);
          setAssignmentId("");
        }}
        disabled={!qualificationId}
        required
      >
        <option value="">Select module</option>

        {filteredModules.map((module) => (
          <option key={module.id} value={module.id}>
            {module.code} - {module.name}
          </option>
        ))}
      </select>
    </div>

    <div className="form-group">
      <label htmlFor="level-assignment">
        Assignment
      </label>

      <select
        id="level-assignment"
        value={assignmentId}
        onChange={(event) =>
          setAssignmentId(event.target.value)
        }
        disabled={!moduleId}
        required
      >
        <option value="">
          Select assignment
        </option>

        {filteredAssignments.map((assignment) => (
          <option
            key={assignment.id}
            value={assignment.id}
          >
            {assignment.code} - {assignment.title}
          </option>
        ))}
      </select>
    </div>

    <div className="form-group">
      <label htmlFor="level-grading-configuration">
        Grading configuration
      </label>

      <select
        id="level-grading-configuration"
        value={gradingConfigurationId}
        onChange={(event) =>
          setGradingConfigurationId(
            event.target.value,
          )
        }
        required
      >
        <option value="">
          Select grading configuration
        </option>

        {activeGradingConfigurations.map(
          (configuration) => (
            <option
              key={configuration.id}
              value={configuration.id}
            >
              {configuration.code} -{" "}
              {configuration.name}
            </option>
          ),
        )}
      </select>
    </div>

    <div className="form-group">
      <label htmlFor="level-code">Level</label>

      <select
        id="level-code"
        value={levelCode}
        onChange={(event) => {
          const value =
            event.target
              .value as AssignmentLevel["level_code"];

          setLevelCode(value);

          setDisplayName(
            value.charAt(0).toUpperCase() +
              value.slice(1),
          );
        }}
      >
        <option value="foundation">
          Foundation
        </option>
        <option value="proficient">
          Proficient
        </option>
        <option value="expert">Expert</option>
      </select>
    </div>

    <div className="form-group">
      <label htmlFor="level-display-name">
        Display name
      </label>

      <input
        id="level-display-name"
        value={displayName}
        onChange={(event) =>
          setDisplayName(event.target.value)
        }
        required
      />
    </div>

    <div className="form-group">
      <label htmlFor="level-title">Title</label>

      <input
        id="level-title"
        value={title}
        onChange={(event) =>
          setTitle(event.target.value)
        }
        required
      />
    </div>

    <div className="form-group">
      <label htmlFor="level-instructions">
        Instructions
      </label>

      <textarea
        id="level-instructions"
        value={instructions}
        onChange={(event) =>
          setInstructions(event.target.value)
        }
      />
    </div>

    <div className="form-group">
      <label htmlFor="level-tasks">
        Tasks
      </label>

      <textarea
        id="level-tasks"
        value={tasksText}
        onChange={(event) =>
          setTasksText(event.target.value)
        }
        placeholder="Enter one task per line"
      />
    </div>

    <div className="form-group">
      <label htmlFor="level-deliverables">
        Deliverables
      </label>

      <textarea
        id="level-deliverables"
        value={deliverablesText}
        onChange={(event) =>
          setDeliverablesText(event.target.value)
        }
        placeholder="Enter one deliverable per line"
      />
    </div>

    <div className="form-group">
      <label htmlFor="level-expected-outcome">
        Expected outcome
      </label>

      <textarea
        id="level-expected-outcome"
        value={expectedOutcome}
        onChange={(event) =>
          setExpectedOutcome(event.target.value)
        }
      />
    </div>

    <div className="form-group">
      <label htmlFor="level-version">
        Version
      </label>

      <input
        id="level-version"
        type="number"
        min="1"
        value={version}
        onChange={(event) =>
          setVersion(event.target.value)
        }
        required
      />
    </div>

    <div className="form-group">
      <label htmlFor="level-status">
        Configuration status
      </label>

      <select
        id="level-status"
        value={configurationStatus}
        onChange={(event) =>
          setConfigurationStatus(
            event.target
              .value as AssignmentLevel["configuration_status"],
          )
        }
      >
        <option value="draft">Draft</option>
        <option value="ready">Ready</option>
        <option value="retired">Retired</option>
      </select>
    </div>

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

    {error && <p role="alert" className="error-message">{error}</p>}

    <div className="form-actions">
                        <button
                              type="submit"
                              disabled={
                                isSubmitting ||
                                !qualificationId ||
                                !moduleId ||
                                !assignmentId ||
                                !gradingConfigurationId
                              }
                             className="btn-primary">
                              {isSubmitting
                                ? "Creating..."
                                : "Add assignment level"}
                            </button>
                    </div>
  </form>
</section>


      <section>
        <h2 style={{ marginBottom: "16px", color: "white" }}>Existing assignment levels</h2>

        {levels.length === 0 ? (
          <p>
            No assignment levels found. Create one under an
            assignment after a grading configuration exists.
          </p>
        ) : (
          <div className="table-container">
                        <table className="modern-table">
                                    <thead>
                                      <tr>
                                        <th>Qualification</th>
                                        <th>Module</th>
                                        <th>Assignment</th>
                                        <th>Level</th>
                                        <th>Display name</th>
                                        <th>Grading configuration</th>
                                        <th>Version</th>
                                        <th>Configuration status</th>
                                        <th>Status</th>
                                      </tr>
                                    </thead>
                        
                                    <tbody>
                                      {levels.map((level) => (
                                        <tr key={level.id}>
                                          <td>{level.qualification_code}</td>
                                          <td>{level.module_code}</td>
                                          <td>
                                            {level.assignment_code} —{" "}
                                            {level.assignment_title}
                                          </td>
                                          <td>{level.level_code}</td>
                                          <td>{level.display_name}</td>
                                          <td>
                                            {level.grading_configuration_code} —{" "}
                                            {level.grading_configuration_name}
                                          </td>
                                          <td>{level.version}</td>
                                          <td>{level.configuration_status}</td>
                                          <td>
                                            {level.is_active
                                              ? "Active"
                                              : "Inactive"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                    </div>
        )}
      </section>
    </main>
  );
}