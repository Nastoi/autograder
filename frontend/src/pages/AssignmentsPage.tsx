import "../css/AssessmentMappings.css";
import "../css/QualificationsPage.css";
import { Link } from "react-router";
import { GraduationCap, Package, ClipboardList } from "lucide-react";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  createModuleAssignment,
  createRubricBand,
  createRubricCriterion,
  createTask,
  deleteAssignmentLevel,
  deleteModuleAssignment,
  deleteRubricBand,
  deleteRubricCriterion,
  deleteTask,
  getAssignmentLevels,
  getModuleAssignments,
  getModules,
  getQualifications,
  getRubricBands,
  getRubricCriteria,
  getTasks,
  updateAssignmentLevel,
  updateModuleAssignment,
  updateRubricBand,
  updateRubricCriterion,
  type AssignmentLevel,
  type Module,
  type ModuleAssignment,
  type Qualification,
  type RubricBand,
  type RubricCriterion,
  type Task,
  generateTaskCriteriaMapping,
} from "../api/lms";

type WorkspaceTab = "overview" | "grading" | "rubric";

const levelOrder: Record<AssignmentLevel["level_code"], number> = {
  basic: 1,
  advanced: 2,
};

export function AssignmentsPage() {
  const [assignments, setAssignments] = useState<ModuleAssignment[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [levels, setLevels] = useState<AssignmentLevel[]>([]);
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [bands, setBands] = useState<RubricBand[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [expandedLevelIds, setExpandedLevelIds] = useState<string[]>([]);
  const [taskDrafts, setTaskDrafts] = useState<
    Record<string, { task_code: string; title: string; instructions: string }>
  >({});
  const [savingTaskLevelId, setSavingTaskLevelId] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTab>("overview");

  // Create assignment form
  const [qualificationId, setQualificationId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [assignmentNumber, setAssignmentNumber] = useState("1");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [skillStatementCode, setSkillStatementCode] = useState("");
  const [skillStatement, setSkillStatement] = useState("");
  const [objective, setObjective] = useState("");
  const [maximumScore, setMaximumScore] = useState("100");
  const [minimumPassScore, setMinimumPassScore] = useState("50");
  const [isSummative, setIsSummative] = useState(true);
  const [contributesToFinalMark, setContributesToFinalMark] = useState(true);
  const [finalMarkWeight, setFinalMarkWeight] = useState("100");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Assignment edit
  const [editingAssignmentId, setEditingAssignmentId] = useState("");
  const [editAssignmentTitle, setEditAssignmentTitle] = useState("");
  const [editMaximumScore, setEditMaximumScore] = useState("");
  const [editMinimumPassScore, setEditMinimumPassScore] = useState("");
  const [editObjective, setEditObjective] = useState("");

  // Level edit
  const [editingLevelId, setEditingLevelId] = useState("");
  const [levelTitle, setLevelTitle] = useState("");
  const [levelInstructions, setLevelInstructions] = useState("");
  const [levelDeliverables, setLevelDeliverables] = useState("");
  const [levelExpectedOutcome, setLevelExpectedOutcome] = useState("");
  const [isSavingLevel, setIsSavingLevel] = useState(false);

  // Criterion create/edit
  const [criterionLevelId, setCriterionLevelId] = useState("");
  const [criterionCode, setCriterionCode] = useState("");
  const [criterionTitle, setCriterionTitle] = useState("");
  const [criterionDescription, setCriterionDescription] = useState("");
  const [criterionMaximumScore, setCriterionMaximumScore] = useState("10");
  const [criterionSequence, setCriterionSequence] = useState("1");
  const [isSavingCriterion, setIsSavingCriterion] = useState(false);
  const [editingCriterionId, setEditingCriterionId] = useState("");
  const [editCriterionTitle, setEditCriterionTitle] = useState("");
  const [editCriterionDescription, setEditCriterionDescription] = useState("");
  const [editCriterionMaximumScore, setEditCriterionMaximumScore] = useState("");

  // Band create/edit
  const [bandCriterionId, setBandCriterionId] = useState("");
  const [bandCode, setBandCode] =
    useState<RubricBand["band_code"]>("foundation");
  const [bandDisplayName, setBandDisplayName] = useState("Foundation");
  const [bandMinimumPercentage, setBandMinimumPercentage] = useState("0");
  const [bandMaximumPercentage, setBandMaximumPercentage] = useState("100");
  const [bandDescriptor, setBandDescriptor] = useState("");
  const [bandSequence, setBandSequence] = useState("1");
  const [isSavingBand, setIsSavingBand] = useState(false);
  const [editingBandId, setEditingBandId] = useState("");
  const [editBandMinimum, setEditBandMinimum] = useState("");
  const [editBandMaximum, setEditBandMaximum] = useState("");
  const [editBandDescriptor, setEditBandDescriptor] = useState("");

  async function loadData() {
    const [
      assignmentData,
      moduleData,
      qualificationData,
      levelData,
      criteriaData,
      bandData,
    ] = await Promise.all([
      getModuleAssignments(),
      getModules(),
      getQualifications(),
      getAssignmentLevels(),
      getRubricCriteria(),
      getRubricBands(),
    ]);

    setAssignments(assignmentData);
    setModules(moduleData);
    setQualifications(qualificationData);
    setLevels(levelData);
    setCriteria(criteriaData);
    setBands(bandData);
  }

  useEffect(() => {
    async function initialise() {
      try {
        await loadData();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load assignments.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void initialise();
  }, []);

  const filteredModules = modules.filter(
    (module) =>
      !qualificationId || module.qualification === qualificationId,
  );

  const selectedAssignment = assignments.find(
    (assignment) => assignment.id === selectedAssignmentId,
  );

  const selectedAssignmentLevels = levels
    .filter((level) => level.assignment === selectedAssignmentId)
    .sort((a, b) => levelOrder[a.level_code] - levelOrder[b.level_code]);

  const selectedLevelIds = selectedAssignmentLevels.map((level) => level.id);

  const selectedAssignmentCriteria = criteria
    .filter((criterion) => selectedLevelIds.includes(criterion.assignment_level))
    .sort((a, b) => a.sequence - b.sequence);

  const selectedCriterionIds = selectedAssignmentCriteria.map(
    (criterion) => criterion.id,
  );

  const selectedAssignmentBands = bands
    .filter((band) => selectedCriterionIds.includes(band.rubric_criterion))
    .sort((a, b) => a.sequence - b.sequence);

  const selectedAssignmentTasks = tasks
    .filter((task) => selectedLevelIds.includes(task.assignment_level))
    .sort((a, b) => a.sequence - b.sequence);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const createdAssignment = await createModuleAssignment({
        module: moduleId,
        assignment_number: Number(assignmentNumber),
        assignment_code: code,
        assignment_title: title,
        skill_statement_code: skillStatementCode,
        skill_statement: skillStatement,
        objective,
        maximum_score: maximumScore,
        minimum_pass_score: minimumPassScore,
        is_summative: isSummative,
        contributes_to_final_mark: contributesToFinalMark,
        final_mark_weight: finalMarkWeight,
        is_active: isActive,
      });

      setAssignmentNumber("1");
      setCode("");
      setTitle("");
      setSkillStatementCode("");
      setSkillStatement("");
      setObjective("");
      setMaximumScore("100");
      setMinimumPassScore("50");
      setIsSummative(true);
      setContributesToFinalMark(true);
      setFinalMarkWeight("100");
      setIsActive(true);
      setShowCreateAssignment(false);

      await loadData();
      setSelectedAssignmentId(createdAssignment.id);
      setActiveWorkspaceTab("overview");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create assignment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditingAssignment(assignment: ModuleAssignment) {
    setEditingAssignmentId(assignment.id);
    setEditAssignmentTitle(assignment.assignment_title);
    setEditMaximumScore(assignment.maximum_score);
    setEditMinimumPassScore(assignment.minimum_pass_score);
    setEditObjective(assignment.objective);
  }

  async function saveAssignmentEdit(assignment: ModuleAssignment) {
    setError("");
    try {
      await updateModuleAssignment(assignment.id, {
        assignment_title: editAssignmentTitle,
        maximum_score: editMaximumScore,
        minimum_pass_score: editMinimumPassScore,
        objective: editObjective,
      });
      await loadData();
      setEditingAssignmentId("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update assignment.",
      );
    }
  }

  async function removeAssignment(assignmentId: string) {
    if (!window.confirm("Delete this assignment?")) return;

    setError("");
    try {
      await deleteModuleAssignment(assignmentId);
      await loadData();
      if (selectedAssignmentId === assignmentId) {
        setSelectedAssignmentId("");
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete assignment.",
      );
    }
  }

  function startEditingLevel(level: AssignmentLevel) {
    setEditingLevelId(level.id);
    setLevelTitle(level.title);
    setLevelInstructions(level.instructions);
    setLevelDeliverables(
      Array.isArray(level.deliverables) ? level.deliverables.join("\n") : "",
    );
    setLevelExpectedOutcome(level.expected_outcome);
  }

  async function saveLevel(level: AssignmentLevel) {
    setError("");
    setIsSavingLevel(true);

    try {
      await updateAssignmentLevel(level.id, {
        title: levelTitle,
        instructions: levelInstructions,
        deliverables: levelDeliverables
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        expected_outcome: levelExpectedOutcome,
        configuration_status: "ready",
      });

      setLevels(await getAssignmentLevels());
      setEditingLevelId("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update grading level.",
      );
    } finally {
      setIsSavingLevel(false);
    }
  }

  async function removeLevel(level: AssignmentLevel) {
    if (
      !window.confirm(
        `Delete grading level "${level.display_name}"? This permanently removes this level and is intended for unused/test levels.`,
      )
    ) {
      return;
    }

    setError("");

    try {
      await deleteAssignmentLevel(level.id);
      await loadData();

      if (editingLevelId === level.id) {
        setEditingLevelId("");
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete grading level.",
      );
    }
  }

  async function refreshLevelTasks(levelId: string) {
    const levelTaskData = await getTasks(levelId);
    setTasks((current) => [
      ...current.filter((task) => task.assignment_level !== levelId),
      ...levelTaskData,
    ]);
  }

  async function toggleLevel(levelId: string) {
    const isOpen = expandedLevelIds.includes(levelId);

    setExpandedLevelIds((current) =>
      isOpen
        ? current.filter((id) => id !== levelId)
        : [...current, levelId],
    );

    if (!isOpen) {
      try {
        await refreshLevelTasks(levelId);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load tasks.",
        );
      }
    }
  }

  function updateTaskDraft(
    levelId: string,
    field: "task_code" | "title" | "instructions",
    value: string,
  ) {
    setTaskDrafts((current) => ({
      ...current,
      [levelId]: {
        task_code: current[levelId]?.task_code ?? "",
        title: current[levelId]?.title ?? "",
        instructions: current[levelId]?.instructions ?? "",
        [field]: value,
      },
    }));
  }

  async function saveNewTask(
    event: FormEvent<HTMLFormElement>,
    level: AssignmentLevel,
  ) {
    event.preventDefault();
    const draft = taskDrafts[level.id] ?? {
      task_code: "",
      title: "",
      instructions: "",
    };

    if (!draft.title.trim()) return;

    const levelTasks = selectedAssignmentTasks.filter(
      (task) => task.assignment_level === level.id,
    );
    const nextSequence =
      levelTasks.reduce((max, task) => Math.max(max, task.sequence), 0) + 1;
    const generatedCode = `T${String(nextSequence).padStart(2, "0")}`;

    setError("");
    setSavingTaskLevelId(level.id);

    try {
      await createTask({
        assignment_level: level.id,
        task_code: draft.task_code.trim() || generatedCode,
        title: draft.title.trim(),
        instructions: draft.instructions.trim(),
        sequence: nextSequence,
      });

      await refreshLevelTasks(level.id);
      setTaskDrafts((current) => ({
        ...current,
        [level.id]: { task_code: "", title: "", instructions: "" },
      }));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create task.",
      );
    } finally {
      setSavingTaskLevelId("");
    }
  }

  async function removeTask(task: Task) {
    if (!window.confirm(`Delete task ${task.task_code}?`)) return;

    setError("");
    try {
      await deleteTask(task.id);
      await refreshLevelTasks(task.assignment_level);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete task.",
      );
    }
  }

  async function saveCriterion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSavingCriterion(true);

    try {
      await createRubricCriterion({
        assignment_level: criterionLevelId,
        criterion_code: criterionCode,
        title: criterionTitle,
        description: criterionDescription,
        maximum_score: criterionMaximumScore,
        sequence: Number(criterionSequence),
        ai_gradable: true,
        deterministic: false,
      });

      setCriterionLevelId("");
      setCriterionCode("");
      setCriterionTitle("");
      setCriterionDescription("");
      setCriterionMaximumScore("10");
      setCriterionSequence("1");
      setCriteria(await getRubricCriteria());
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create rubric criterion.",
      );
    } finally {
      setIsSavingCriterion(false);
    }
  }

  function startEditingCriterion(criterion: RubricCriterion) {
    setEditingCriterionId(criterion.id);
    setEditCriterionTitle(criterion.title);
    setEditCriterionDescription(criterion.description);
    setEditCriterionMaximumScore(criterion.maximum_score);
  }

  async function saveCriterionEdit(criterion: RubricCriterion) {
    setError("");
    try {
      await updateRubricCriterion(criterion.id, {
        title: editCriterionTitle,
        description: editCriterionDescription,
        maximum_score: editCriterionMaximumScore,
      });
      setCriteria(await getRubricCriteria());
      setEditingCriterionId("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update rubric criterion.",
      );
    }
  }

  async function removeCriterion(criterionId: string) {
    if (!window.confirm("Delete this rubric criterion?")) return;

    setError("");
    try {
      await deleteRubricCriterion(criterionId);
      setCriteria(await getRubricCriteria());
      setBands(await getRubricBands());
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete rubric criterion.",
      );
    }
  }

  async function saveBand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSavingBand(true);

    try {
      await createRubricBand({
        rubric_criterion: bandCriterionId,
        band_code: bandCode,
        display_name: bandDisplayName,
        minimum_percentage: bandMinimumPercentage,
        maximum_percentage: bandMaximumPercentage,
        descriptor: bandDescriptor,
        sequence: Number(bandSequence),
      });

      const updatedBands = await getRubricBands();
      setBands(updatedBands);

      const criterionBands = updatedBands.filter(
        (band) => band.rubric_criterion === bandCriterionId,
      );

      setBandCode("foundation");
      setBandDisplayName("Foundation");
      setBandMinimumPercentage("0");
      setBandMaximumPercentage("100");
      setBandDescriptor("");
      setBandSequence(String(criterionBands.length + 1));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create rubric band.",
      );
    } finally {
      setIsSavingBand(false);
    }
  }

  function startEditingBand(band: RubricBand) {
    setEditingBandId(band.id);
    setEditBandMinimum(band.minimum_percentage);
    setEditBandMaximum(band.maximum_percentage);
    setEditBandDescriptor(band.descriptor);
  }

  async function saveBandEdit(band: RubricBand) {
    setError("");
    try {
      await updateRubricBand(band.id, {
        minimum_percentage: editBandMinimum,
        maximum_percentage: editBandMaximum,
        descriptor: editBandDescriptor,
      });
      setBands(await getRubricBands());
      setEditingBandId("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update rubric band.",
      );
    }
  }

  async function removeBand(bandId: string) {
    if (!window.confirm("Delete this rubric band?")) return;

    setError("");
    try {
      await deleteRubricBand(bandId);
      setBands(await getRubricBands());
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete rubric band.",
      );
    }
  }

  if (isLoading) {
    return <main className="admin-container">Loading assignments...</main>;
  }

  const selectedBandCriterion = selectedAssignmentCriteria.find(
    (criterion) => criterion.id === bandCriterionId,
  );

  const availableBandCodes: RubricBand["band_code"][] =
    selectedBandCriterion?.level_code === "advanced"
      ? ["failed", "proficient", "expert"]
      : ["failed", "foundation", "proficient"];

  async function handleGenerateTaskCriteriaMapping(
    assignmentLevelId: string,
  ) {
    try {
      setError("");

      const result =
        await generateTaskCriteriaMapping(
          assignmentLevelId,
        );

      alert(
        `AI mapping completed. ${result.tasks_mapped} tasks mapped.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to generate task criteria mapping.",
      );
    }
  }

  return (
    <main className="admin-container">
      <div className="admin-header">
        <div>
          <h1>Assignments</h1>
          <p className="section-description">
            Create assignments and manage grading levels and rubrics in one place.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      <section style={{ marginBottom: '40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <Link to="/admin/qualifications" className="metric-card-modern">
            <div className="metric-icon-wrapper purple">
              <GraduationCap size={24} />
            </div>
            <div className="metric-content">
              <span className="metric-label" style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>Qualifications</span>
              <span className="metric-value" style={{ marginTop: '4px' }}>{qualifications.length}</span>
            </div>
          </Link>

          <Link to="/admin/modules" className="metric-card-modern">
            <div className="metric-icon-wrapper blue">
              <Package size={24} />
            </div>
            <div className="metric-content">
              <span className="metric-label" style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>Modules</span>
              <span className="metric-value" style={{ marginTop: '4px' }}>{modules.length}</span>
            </div>
          </Link>

          <Link to="/admin/assignments" className="metric-card-modern">
            <div className="metric-icon-wrapper orange">
              <ClipboardList size={24} />
            </div>
            <div className="metric-content">
              <span className="metric-label" style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>Assignments</span>
              <span className="metric-value" style={{ marginTop: '4px' }}>{assignments.length}</span>
            </div>
          </Link>
        </div>
      </section>

      <section className="page-section">
        <div className="section-header">
          <div>
            <h2>Assignment list</h2>
            <p className="section-description">
              Select an assignment to open its workspace.
            </p>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowCreateAssignment((current) => !current)}
          >
            {showCreateAssignment ? "Close" : "+ New Assignment"}
          </button>
        </div>

        {showCreateAssignment && (
          <form
            onSubmit={handleSubmit}
            className="modern-form assignment-create-form"
          >
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label htmlFor="assignment-qualification">Qualification</label>
                <select
                  id="assignment-qualification"
                  value={qualificationId}
                  onChange={(event) => {
                    setQualificationId(event.target.value);
                    setModuleId("");
                  }}
                  required
                >
                  <option value="">Select qualification</option>
                  {qualifications.map((qualification) => (
                    <option key={qualification.id} value={qualification.id}>
                      {qualification.qualification_code} - {qualification.qualification_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="assignment-module">Module</label>
                <select
                  id="assignment-module"
                  value={moduleId}
                  onChange={(event) => setModuleId(event.target.value)}
                  disabled={!qualificationId}
                  required
                >
                  <option value="">Select module</option>
                  {filteredModules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.module_code} - {module.module_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="assignment-number">Assignment number</label>
                <input
                  id="assignment-number"
                  type="number"
                  min="1"
                  value={assignmentNumber}
                  onChange={(event) => setAssignmentNumber(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="assignment-code">Code</label>
                <input
                  id="assignment-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="assignment-title">Title</label>
                <input
                  id="assignment-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="skill-statement-code">Skill statement code</label>
                <input
                  id="skill-statement-code"
                  value={skillStatementCode}
                  onChange={(event) => setSkillStatementCode(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="maximum-score">Maximum score</label>
                <input
                  id="maximum-score"
                  type="number"
                  min="0"
                  step="0.01"
                  value={maximumScore}
                  onChange={(event) => setMaximumScore(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="minimum-pass-score">Minimum pass score</label>
                <input
                  id="minimum-pass-score"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minimumPassScore}
                  onChange={(event) => setMinimumPassScore(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="final-mark-weight">Final mark weight</label>
                <input
                  id="final-mark-weight"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={finalMarkWeight}
                  onChange={(event) => setFinalMarkWeight(event.target.value)}
                  disabled={!contributesToFinalMark}
                  required={contributesToFinalMark}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="skill-statement">Skill statement</label>
              <textarea
                id="skill-statement"
                value={skillStatement}
                onChange={(event) => setSkillStatement(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="assignment-objective">Objective</label>
              <textarea
                id="assignment-objective"
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
              />
            </div>

            <div className="checkbox-row">
              <label className="checkbox-group">
                <input
                  type="checkbox"
                  checked={isSummative}
                  onChange={(event) => setIsSummative(event.target.checked)}
                />
                Summative
              </label>

              <label className="checkbox-group">
                <input
                  type="checkbox"
                  checked={contributesToFinalMark}
                  onChange={(event) =>
                    setContributesToFinalMark(event.target.checked)
                  }
                />
                Contributes to final mark
              </label>

              <label className="checkbox-group">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
                Active
              </label>
            </div>

            <div className="form-actions form-actions-compact">
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting || !qualificationId || !moduleId}
              >
                {isSubmitting ? "Creating..." : "Create Assignment"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={isSubmitting}
                onClick={() => setShowCreateAssignment(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {assignments.length === 0 ? (
          <div className="empty-state">No assignments found.</div>
        ) : (
          <div className="table-container assignment-table-container">
            <table className="modern-table assignment-table">
              <thead>
                <tr>
                  <th>Qualification</th>
                  <th>Module</th>
                  <th>No.</th>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Max</th>
                  <th>Pass</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => {
                  const isEditing = editingAssignmentId === assignment.id;
                  const isSelected = selectedAssignmentId === assignment.id;

                  return (
                    <tr
                      key={assignment.id}
                      className={isSelected ? "selected-row" : undefined}
                      onClick={() => {
                        setSelectedAssignmentId(assignment.id);
                        setActiveWorkspaceTab("overview");
                      }}
                    >
                      <td>{assignment.qualification_code}</td>
                      <td>{assignment.module_code}</td>
                      <td>-</td>
                      <td>{assignment.assignment_code}</td>
                      <td>
                        {isEditing ? (
                          <input
                            value={editAssignmentTitle}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              setEditAssignmentTitle(event.target.value)
                            }
                          />
                        ) : (
                          assignment.assignment_title
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            className="table-number-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editMaximumScore}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              setEditMaximumScore(event.target.value)
                            }
                          />
                        ) : (
                          assignment.maximum_score
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            className="table-number-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editMinimumPassScore}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              setEditMinimumPassScore(event.target.value)
                            }
                          />
                        ) : (
                          assignment.minimum_pass_score
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${assignment.is_active ? "status-active" : "status-inactive"
                            }`}
                        >
                          {assignment.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td
                        className="table-actions"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="btn-table"
                              onClick={() => void saveAssignmentEdit(assignment)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn-table"
                              onClick={() => setEditingAssignmentId("")}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn-table"
                              onClick={() => startEditingAssignment(assignment)}
                            >
                              Edit
                            </button>
                            {assignment.can_delete && (
                              <button
                                type="button"
                                className="btn-table btn-table-danger"
                                onClick={() => void removeAssignment(assignment.id)}
                              >
                                Delete
                              </button>
                            )}
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

        {selectedAssignment && (
          <section className="assignment-workspace">
            <div className="section-header assignment-workspace-header">
              <div>
                <h2>
                  {selectedAssignment.assignment_code} — {selectedAssignment.assignment_title}
                </h2>
                <p className="section-description">
                  {selectedAssignment.qualification_code} → {selectedAssignment.module_code}
                </p>
              </div>
            </div>

            <div className="workspace-tabs">
              <button
                type="button"
                className={
                  activeWorkspaceTab === "overview"
                    ? "workspace-tab active"
                    : "workspace-tab"
                }
                onClick={() => setActiveWorkspaceTab("overview")}
              >
                Overview
              </button>
              <button
                type="button"
                className={
                  activeWorkspaceTab === "grading"
                    ? "workspace-tab active"
                    : "workspace-tab"
                }
                onClick={() => setActiveWorkspaceTab("grading")}
              >
                Grading Levels
              </button>
              <button
                type="button"
                className={
                  activeWorkspaceTab === "rubric"
                    ? "workspace-tab active"
                    : "workspace-tab"
                }
                onClick={() => setActiveWorkspaceTab("rubric")}
              >
                Rubric
              </button>
            </div>

            {activeWorkspaceTab === "overview" && (
              <div className="workspace-panel">
                <div className="overview-grid">
                  <div>
                    <span className="detail-label">Assignment code</span>
                    <strong>{selectedAssignment.assignment_code}</strong>
                  </div>

                  <div>
                    <span className="detail-label">Assignment number</span>
                    <strong>-</strong>
                  </div>

                  <div>
                    <span className="detail-label">Qualification</span>
                    <strong>
                      {selectedAssignment.qualification_code} —{" "}
                      {selectedAssignment.qualification_name}
                    </strong>
                  </div>

                  <div>
                    <span className="detail-label">Module</span>
                    <strong>
                      {selectedAssignment.module_code} —{" "}
                      {selectedAssignment.module_name}
                    </strong>
                  </div>

                  <div>
                    <span className="detail-label">Maximum score</span>
                    <strong>{selectedAssignment.maximum_score}</strong>
                  </div>

                  <div>
                    <span className="detail-label">Minimum pass score</span>
                    <strong>{selectedAssignment.minimum_pass_score}</strong>
                  </div>

                  <div>
                    <span className="detail-label">Summative</span>
                    <strong>
                      {selectedAssignment.is_summative ? "Yes" : "No"}
                    </strong>
                  </div>

                  <div>
                    <span className="detail-label">
                      Contributes to final mark
                    </span>
                    <strong>
                      {selectedAssignment.contributes_to_final_mark
                        ? "Yes"
                        : "No"}
                    </strong>
                  </div>

                  <div>
                    <span className="detail-label">Final mark weight</span>
                    <strong>
                      {selectedAssignment.contributes_to_final_mark
                        ? `${selectedAssignment.final_mark_weight}%`
                        : "Not applicable"}
                    </strong>
                  </div>

                  <div>
                    <span className="detail-label">Status</span>
                    <strong>
                      {selectedAssignment.is_active ? "Active" : "Inactive"}
                    </strong>
                  </div>
                </div>

                <div className="overview-stack">
                  <div className="detail-block">
                    <span className="detail-label">
                      Skill statement code
                    </span>
                    <p>
                      {selectedAssignment.skill_statement_code || "—"}
                    </p>
                  </div>

                  <div className="detail-block">
                    <span className="detail-label">Skill statement</span>
                    <p>{selectedAssignment.skill_statement || "—"}</p>
                  </div>

                  <div className="detail-block">
                    <span className="detail-label">Objective</span>
                    <p>{selectedAssignment.objective || "—"}</p>
                  </div>
                </div>
              </div>
            )}

            {activeWorkspaceTab === "grading" && (
              <div className="workspace-panel">
                <div className="section-header compact-section-header">
                  <div>
                    <h3>Grading levels</h3>
                    <p className="section-description">
                      Basic and Advanced submission levels are created automatically.
                      Open either level to configure its requirements and tasks.
                    </p>
                  </div>
                </div>

                <div className="level-grid">
                  {(["basic", "advanced"] as const).map((levelCode) => {
                    const level = selectedAssignmentLevels.find(
                      (item) => item.level_code === levelCode,
                    );

                    if (!level) {
                      return (
                        <div key={levelCode}>
                          <div className="submission-path-card">
                            <span className="path-label">
                              {levelCode === "basic"
                                ? "Basic submission"
                                : "Advanced submission"}
                            </span>
                            <strong>
                              {levelCode === "basic"
                                ? "Foundation + Proficient"
                                : "Proficient + Expert"}
                            </strong>
                            <small className="table-subtext">
                              Grading level data is not available yet.
                            </small>
                          </div>
                        </div>
                      );
                    }

                    const isExpanded = expandedLevelIds.includes(level.id);
                    const levelTaskItems = selectedAssignmentTasks.filter(
                      (task) => task.assignment_level === level.id,
                    );
                    const taskDraft = taskDrafts[level.id] ?? {
                      task_code: "",
                      title: "",
                      instructions: "",
                    };
                    const nextTaskNumber =
                      levelTaskItems.reduce(
                        (max, task) => Math.max(max, task.sequence),
                        0,
                      ) + 1;
                    const suggestedTaskCode = `T${String(nextTaskNumber).padStart(2, "0")}`;

                    return (
                      <div key={level.id}>
                        <div
                          className="submission-path-card"
                          role="button"
                          tabIndex={0}
                          onClick={() => void toggleLevel(level.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              void toggleLevel(level.id);
                            }
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <span className="path-label">
                            {level.level_code === "basic"
                              ? "Basic submission"
                              : "Advanced submission"}
                          </span>
                          <strong>
                            {level.level_code === "basic"
                              ? "Foundation + Proficient"
                              : "Proficient + Expert"}
                          </strong>
                          <small className="table-subtext">
                            {isExpanded ? "Click to collapse" : "Click to configure"}
                          </small>
                        </div>

                        {isExpanded && (
                          <article className="level-card" style={{ marginTop: "16px" }}>
                            <div className="level-card-header">
                              <div>
                                <span className="path-label">{level.level_code}</span>
                                <h3>{level.display_name}</h3>
                              </div>
                              <span
                                className={`status-badge ${level.configuration_status === "ready"
                                  ? "status-active"
                                  : "status-inactive"
                                  }`}
                              >
                                {level.configuration_status}
                              </span>
                            </div>

                            {editingLevelId === level.id ? (
                              <div className="level-edit-form">
                                <div className="form-group">
                                  <label>Title</label>
                                  <input
                                    value={levelTitle}
                                    onChange={(event) => setLevelTitle(event.target.value)}
                                  />
                                </div>
                                <div className="form-group">
                                  <label>Instructions</label>
                                  <textarea
                                    value={levelInstructions}
                                    onChange={(event) =>
                                      setLevelInstructions(event.target.value)
                                    }
                                  />
                                </div>
                                <div className="form-group">
                                  <label>Deliverables</label>
                                  <textarea
                                    value={levelDeliverables}
                                    onChange={(event) =>
                                      setLevelDeliverables(event.target.value)
                                    }
                                    placeholder="One deliverable per line"
                                  />
                                </div>
                                <div className="form-group">
                                  <label>Expected outcome</label>
                                  <textarea
                                    value={levelExpectedOutcome}
                                    onChange={(event) =>
                                      setLevelExpectedOutcome(event.target.value)
                                    }
                                  />
                                </div>
                                <div className="form-actions form-actions-compact">
                                  <button
                                    type="button"
                                    className="btn-primary"
                                    disabled={isSavingLevel}
                                    onClick={() => void saveLevel(level)}
                                  >
                                    {isSavingLevel ? "Saving..." : "Save Level"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    disabled={isSavingLevel}
                                    onClick={() => setEditingLevelId("")}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="level-title">
                                  {level.title || "No title set"}
                                </p>
                                <div className="section-actions">
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => startEditingLevel(level)}
                                  >
                                    Edit Level Details
                                  </button>
                                  {level.can_delete && (
                                    <button
                                      type="button"
                                      className="btn-danger"
                                      onClick={() => void removeLevel(level)}
                                    >
                                      Delete Level
                                    </button>
                                  )}
                                </div>
                              </>
                            )}

                            <div className="section-header compact-section-header">
                              <div>
                                <h3>Assignment tasks</h3>
                                <p className="section-description">
                                  Add each requirement the learner must complete for this submission level.
                                </p>
                              </div>
                            </div>

                            {levelTaskItems.length === 0 ? (
                              <div className="empty-state">No tasks added yet.</div>
                            ) : (
                              <div className="table-container rubric-table-container">
                                <table className="modern-table">
                                  <thead>
                                    <tr>
                                      <th>Code</th>
                                      <th>Task</th>
                                      <th>Seq.</th>
                                      <th>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {levelTaskItems.map((task) => (
                                      <tr key={task.id}>
                                        <td>{task.task_code}</td>
                                        <td>
                                          <strong>{task.title}</strong>
                                          {task.instructions && (
                                            <small className="table-subtext">
                                              {task.instructions}
                                            </small>
                                          )}
                                        </td>
                                        <td>{task.sequence}</td>
                                        <td className="table-actions">
                                          <button
                                            type="button"
                                            className="btn-table btn-table-danger"
                                            onClick={() => void removeTask(task)}
                                          >
                                            Delete
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            <form
                              className="modern-form embedded-form"
                              onSubmit={(event) => void saveNewTask(event, level)}
                            >
                              <div className="form-grid form-grid-2">
                                <div className="form-group">
                                  <label>Task code</label>
                                  <input
                                    value={taskDraft.task_code}
                                    placeholder={suggestedTaskCode}
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
                                    value={taskDraft.title}
                                    onChange={(event) =>
                                      updateTaskDraft(
                                        level.id,
                                        "title",
                                        event.target.value,
                                      )
                                    }
                                    placeholder="e.g. Remove duplicate transaction records"
                                    required
                                  />
                                </div>
                              </div>
                              <div className="form-group">
                                <label>Instructions / notes</label>
                                <textarea
                                  value={taskDraft.instructions}
                                  onChange={(event) =>
                                    updateTaskDraft(
                                      level.id,
                                      "instructions",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Optional extra instructions for the learner or grader"
                                />
                              </div>
                              <div className="form-actions form-actions-compact">
                                <button
                                  type="submit"
                                  className="btn-primary"
                                  disabled={savingTaskLevelId === level.id}
                                >
                                  {savingTaskLevelId === level.id
                                    ? "Adding..."
                                    : "+ Add Task"}
                                </button>
                              </div>
                            </form>
                            <div className="section-actions">
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() =>
                                  void handleGenerateTaskCriteriaMapping(level.id)
                                }
                              >
                                Generate AI Task Mapping
                              </button>
                            </div>
                          </article>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeWorkspaceTab === "rubric" && (
              <div className="workspace-panel">
                <div className="rubric-layout">
                  <section className="rubric-section">
                    <div className="section-header compact-section-header">
                      <div>
                        <h3>Rubric criteria</h3>
                        <p className="section-description">
                          Create criteria for a specific grading level.
                        </p>
                      </div>
                    </div>

                    <form
                      onSubmit={saveCriterion}
                      className="modern-form embedded-form"
                    >
                      <div className="form-grid form-grid-2">
                        <div className="form-group">
                          <label>Grading level</label>
                          <select
                            value={criterionLevelId}
                            onChange={(event) => setCriterionLevelId(event.target.value)}
                            required
                          >
                            <option value="">Select level</option>
                            {selectedAssignmentLevels.map((level) => (
                              <option key={level.id} value={level.id}>
                                {level.display_name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Criterion code</label>
                          <input
                            value={criterionCode}
                            onChange={(event) => setCriterionCode(event.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Title</label>
                          <input
                            value={criterionTitle}
                            onChange={(event) => setCriterionTitle(event.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Maximum score</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={criterionMaximumScore}
                            onChange={(event) =>
                              setCriterionMaximumScore(event.target.value)
                            }
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Sequence</label>
                          <input
                            type="number"
                            min="1"
                            value={criterionSequence}
                            onChange={(event) => setCriterionSequence(event.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <textarea
                          value={criterionDescription}
                          onChange={(event) =>
                            setCriterionDescription(event.target.value)
                          }
                        />
                      </div>
                      <div className="form-actions form-actions-compact">
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={isSavingCriterion || !criterionLevelId}
                        >
                          {isSavingCriterion ? "Adding..." : "Add Criterion"}
                        </button>
                      </div>
                    </form>

                    <div className="table-container rubric-table-container">
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>Level</th>
                            <th>Code</th>
                            <th>Criterion</th>
                            <th>Max</th>
                            <th>Seq.</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAssignmentCriteria.map((criterion) => {
                            const isEditing = editingCriterionId === criterion.id;
                            return (
                              <tr key={criterion.id}>
                                <td>{criterion.level_display_name}</td>
                                <td>{criterion.criterion_code}</td>
                                <td>
                                  {isEditing ? (
                                    <div className="inline-edit-stack">
                                      <input
                                        value={editCriterionTitle}
                                        onChange={(event) =>
                                          setEditCriterionTitle(event.target.value)
                                        }
                                      />
                                      <textarea
                                        value={editCriterionDescription}
                                        onChange={(event) =>
                                          setEditCriterionDescription(event.target.value)
                                        }
                                      />
                                    </div>
                                  ) : (
                                    <div>
                                      <strong>{criterion.title}</strong>
                                      {criterion.description && (
                                        <small className="table-subtext">
                                          {criterion.description}
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
                                      value={editCriterionMaximumScore}
                                      onChange={(event) =>
                                        setEditCriterionMaximumScore(event.target.value)
                                      }
                                    />
                                  ) : (
                                    criterion.maximum_score
                                  )}
                                </td>
                                <td>{criterion.sequence}</td>
                                <td className="table-actions">
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        className="btn-table"
                                        onClick={() => void saveCriterionEdit(criterion)}
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-table"
                                        onClick={() => setEditingCriterionId("")}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="btn-table"
                                        onClick={() => startEditingCriterion(criterion)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-table btn-table-danger"
                                        onClick={() => void removeCriterion(criterion.id)}
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
                  </section>

                  <section className="rubric-section">
                    <div className="section-header compact-section-header">
                      <div>
                        <h3>Rubric bands</h3>
                        <p className="section-description">
                          Add performance descriptors to rubric criteria.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={saveBand} className="modern-form embedded-form">
                      <div className="form-grid form-grid-2">
                        <div className="form-group">
                          <label>Criterion</label>
                          <select
                            value={bandCriterionId}
                            onChange={(event) => {
                              const criterionId = event.target.value;
                              setBandCriterionId(criterionId);

                              const criterion = selectedAssignmentCriteria.find(
                                (item) => item.id === criterionId,
                              );

                              setBandCode("failed");
                              setBandDisplayName("Failed");

                              const existingBands = bands.filter(
                                (band) => band.rubric_criterion === criterionId,
                              );

                              setBandSequence(String(existingBands.length + 1));
                            }}
                          >
                            <option value="">Select criterion</option>
                            {selectedAssignmentCriteria.map((criterion) => (
                              <option key={criterion.id} value={criterion.id}>
                                {criterion.level_display_name} - {criterion.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Band</label>
                          <select
                            value={bandCode}
                            onChange={(event) => {
                              const value = event.target.value as RubricBand["band_code"];
                              setBandCode(value);
                              setBandDisplayName(
                                value.charAt(0).toUpperCase() + value.slice(1),
                              );
                            }}
                          >
                            {availableBandCodes.map((code) => (
                              <option key={code} value={code}>
                                {code.charAt(0).toUpperCase() + code.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Minimum percentage</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={bandMinimumPercentage}
                            onChange={(event) =>
                              setBandMinimumPercentage(event.target.value)
                            }
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Maximum percentage</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={bandMaximumPercentage}
                            onChange={(event) =>
                              setBandMaximumPercentage(event.target.value)
                            }
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Sequence</label>
                          <input
                            type="number"
                            min="1"
                            value={bandSequence}
                            onChange={(event) => setBandSequence(event.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Descriptor</label>
                        <textarea
                          value={bandDescriptor}
                          onChange={(event) => setBandDescriptor(event.target.value)}
                          required
                        />
                      </div>
                      <div className="form-actions form-actions-compact">
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={isSavingBand || !bandCriterionId}
                        >
                          {isSavingBand ? "Adding..." : "Add Rubric Band"}
                        </button>
                      </div>
                    </form>

                    <div className="table-container rubric-table-container">
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>Criterion</th>
                            <th>Band</th>
                            <th>Range</th>
                            <th>Descriptor</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAssignmentBands.map((band) => {
                            const isEditing = editingBandId === band.id;
                            return (
                              <tr key={band.id}>
                                <td>{band.criterion_title}</td>
                                <td>{band.display_name}</td>
                                <td>
                                  {isEditing ? (
                                    <div className="range-edit">
                                      <input
                                        className="table-number-input"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={editBandMinimum}
                                        onChange={(event) =>
                                          setEditBandMinimum(event.target.value)
                                        }
                                      />
                                      <span>–</span>
                                      <input
                                        className="table-number-input"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={editBandMaximum}
                                        onChange={(event) =>
                                          setEditBandMaximum(event.target.value)
                                        }
                                      />
                                    </div>
                                  ) : (
                                    `${band.minimum_percentage}% – ${band.maximum_percentage}%`
                                  )}
                                </td>
                                <td>
                                  {isEditing ? (
                                    <textarea
                                      value={editBandDescriptor}
                                      onChange={(event) =>
                                        setEditBandDescriptor(event.target.value)
                                      }
                                    />
                                  ) : (
                                    band.descriptor
                                  )}
                                </td>
                                <td className="table-actions">
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        className="btn-table"
                                        onClick={() => void saveBandEdit(band)}
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-table"
                                        onClick={() => setEditingBandId("")}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="btn-table"
                                        onClick={() => startEditingBand(band)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-table btn-table-danger"
                                        onClick={() => void removeBand(band.id)}
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
                  </section>
                </div>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
