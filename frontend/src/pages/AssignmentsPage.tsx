import "../css/AssessmentMappings.css";
import "../css/QualificationsPage.css";
import { Link } from "react-router";
import { GraduationCap, Package, ClipboardList, Search, X } from "lucide-react";
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
} from "../api/lms";

import {
  createTaskCriteriaMapping,
  deleteTaskCriteriaMapping,
  getTaskCriteriaMappings,
  updateTaskCriteriaMapping,
  type TaskCriteriaMapping,
} from "../api/taskCriteriaMappings";

import {
  getAssignmentDeleteImpact,
  type AssignmentDeleteImpact,
} from "../api/assignmentDelete";

type WorkspaceTab = "overview" | "configuration";

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
  const [taskCriteriaMappings, setTaskCriteriaMappings] = useState<TaskCriteriaMapping[]>([]);

  const [expandedLevelIds, setExpandedLevelIds] = useState<string[]>([]);
  const [taskDrafts, setTaskDrafts] = useState<
    Record<string, { task_code: string; title: string; instructions: string }>
  >({});
  const [savingTaskLevelId, setSavingTaskLevelId] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTab>("overview");

  // Create assignment form
  const [qualificationId, setQualificationId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [maximumScore, setMaximumScore] = useState("100");
  const [minimumPassScore, setMinimumPassScore] = useState("50");
  const [isSummative, setIsSummative] = useState(true);
  const [contributesToFinalMark, setContributesToFinalMark] = useState(true);
  const [finalMarkWeight, setFinalMarkWeight] = useState("100");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Assignment edit
  const [editingAssignmentId, setEditingAssignmentId] = useState("");
  const [deleteAssignmentId, setDeleteAssignmentId] = useState("");
  const [deleteImpact, setDeleteImpact] =
    useState<AssignmentDeleteImpact | null>(null);
  const [isCheckingDeleteImpact, setIsCheckingDeleteImpact] = useState(false);
  const [isDeletingAssignment, setIsDeletingAssignment] = useState(false);
  const [editAssignmentTitle, setEditAssignmentTitle] = useState("");
  const [editMaximumScore, setEditMaximumScore] = useState("");
  const [editMinimumPassScore, setEditMinimumPassScore] = useState("");

  // Level edit
  const [editingLevelId, setEditingLevelId] = useState("");
  const [levelTitle, setLevelTitle] = useState("");
  const [levelSkillStatementCode, setLevelSkillStatementCode] = useState("");
  const [levelSkillStatement, setLevelSkillStatement] = useState("");
  const [levelObjective, setLevelObjective] = useState("");
  const [levelInstructions, setLevelInstructions] = useState("");
  const [levelDeliverables, setLevelDeliverables] = useState("");
  const [levelExpectedOutcome, setLevelExpectedOutcome] = useState("");
  const [isSavingLevel, setIsSavingLevel] = useState(false);

  // Criterion create/edit
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

  const [taskFormLevelId, setTaskFormLevelId] = useState("");
  const [criterionFormLevelId, setCriterionFormLevelId] = useState("");
  const [bandFormLevelId, setBandFormLevelId] = useState("");
  const [mappingCriterionId, setMappingCriterionId] = useState("");
  const [selectedMappingTaskIds, setSelectedMappingTaskIds] = useState<string[]>([]);
  const [isSavingTaskMapping, setIsSavingTaskMapping] = useState(false);

  async function loadData() {
    const [
      assignmentData,
      moduleData,
      qualificationData,
      levelData,
      criteriaData,
      bandData,
      taskData,
      mappingData,
    ] = await Promise.all([
      getModuleAssignments(),
      getModules(),
      getQualifications(),
      getAssignmentLevels(),
      getRubricCriteria(),
      getRubricBands(),
      getTasks(),
      getTaskCriteriaMappings(),
    ]);

    setTasks(taskData);
    setTaskCriteriaMappings(mappingData);

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

  const filteredAssignments = assignments.filter((assignment) => {
    const term = searchTerm.toLowerCase();
    return (
      assignment.assignment_code.toLowerCase().includes(term) ||
      assignment.assignment_code.toLowerCase().includes(term) ||
      assignment.qualification_code.toLowerCase().includes(term) ||
      assignment.module_code.toLowerCase().includes(term)
    );
  });

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
        assignment_code: code,
        assignment_title: title,
        maximum_score: maximumScore,
        minimum_pass_score: minimumPassScore,
        is_summative: isSummative,
        contributes_to_final_mark: contributesToFinalMark,
        final_mark_weight: finalMarkWeight,
        is_active: isActive,
      });

      setCode("");
      setTitle("");
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
  }

  async function saveAssignmentEdit(assignment: ModuleAssignment) {
    setError("");
    try {
      await updateModuleAssignment(assignment.id, {
        assignment_title: editAssignmentTitle,
        maximum_score: editMaximumScore,
        minimum_pass_score: editMinimumPassScore,
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

  async function openAssignmentDelete(assignmentId: string) {
    setError("");
    setDeleteAssignmentId(assignmentId);
    setDeleteImpact(null);
    setIsCheckingDeleteImpact(true);

    try {
      setDeleteImpact(
        await getAssignmentDeleteImpact(assignmentId),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to check assignment dependencies.",
      );
      setDeleteAssignmentId("");
    } finally {
      setIsCheckingDeleteImpact(false);
    }
  }

  function closeAssignmentDelete() {
    if (isDeletingAssignment) return;

    setDeleteAssignmentId("");
    setDeleteImpact(null);
  }

  async function confirmAssignmentDelete() {
    if (!deleteAssignmentId || !deleteImpact?.can_delete) {
      return;
    }

    setError("");
    setIsDeletingAssignment(true);

    try {
      await deleteModuleAssignment(deleteAssignmentId);
      await loadData();

      if (selectedAssignmentId === deleteAssignmentId) {
        setSelectedAssignmentId("");
      }

      setDeleteAssignmentId("");
      setDeleteImpact(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete assignment.",
      );

      try {
        setDeleteImpact(
          await getAssignmentDeleteImpact(deleteAssignmentId),
        );
      } catch {
        // Keep original delete error visible.
      }
    } finally {
      setIsDeletingAssignment(false);
    }
  }

  function startEditingLevel(level: AssignmentLevel) {
    setEditingLevelId(level.id);
    setLevelTitle(level.title);
    setLevelSkillStatementCode(level.skill_statement_code);
    setLevelSkillStatement(level.skill_statement);
    setLevelObjective(level.objective);
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
        skill_statement_code: levelSkillStatementCode,
        skill_statement: levelSkillStatement,
        objective: levelObjective,
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

  async function refreshLevelTasks(levelId: string) {
    const levelTaskData = await getTasks(levelId);
    setTasks((current) => [
      ...current.filter((task) => task.assignment_level !== levelId),
      ...levelTaskData,
    ]);
  }

  async function toggleLevel(levelId: string) {
    const isOpen = expandedLevelIds.includes(levelId);

    setExpandedLevelIds(
      isOpen ? [] : [levelId],
    );

    if (!isOpen) {
      setBandCriterionId("");
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
      setTaskFormLevelId("");
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

  async function saveCriterion(
    event: FormEvent<HTMLFormElement>,
    assignmentLevelId: string,
  ) {
    event.preventDefault();
    setError("");
    setIsSavingCriterion(true);

    try {
      await createRubricCriterion({
        assignment_level: assignmentLevelId,
        criterion_code: criterionCode,
        title: criterionTitle,
        description: criterionDescription,
        maximum_score: criterionMaximumScore,
        sequence: Number(criterionSequence),
        ai_gradable: true,
        deterministic: false,
      });

      setCriterionCode("");
      setCriterionTitle("");
      setCriterionDescription("");
      setCriterionMaximumScore("10");
      setCriterionSequence("1");
      setCriteria(await getRubricCriteria());
      setBands(await getRubricBands());
      setCriterionFormLevelId("");
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
      setBandFormLevelId("");
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


  function openTaskMapping(
    criterion: RubricCriterion,
  ) {
    const existingTaskIds = taskCriteriaMappings
      .filter(
        (mapping) =>
          mapping.rubric_criterion === criterion.id,
      )
      .map((mapping) => mapping.task);

    setSelectedMappingTaskIds(
      Array.from(new Set(existingTaskIds)),
    );
    setMappingCriterionId(criterion.id);
  }

  function toggleTaskMappingSelection(taskId: string) {
    setSelectedMappingTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
    );
  }

  async function saveTaskMappings(
    criterion: RubricCriterion,
    level: AssignmentLevel,
  ) {
    setError("");
    setIsSavingTaskMapping(true);

    try {
      const currentMappings = taskCriteriaMappings.filter(
        (mapping) =>
          mapping.rubric_criterion === criterion.id,
      );

      const selectedTaskIds = Array.from(
        new Set(selectedMappingTaskIds),
      );

      const mappingsToDelete = currentMappings.filter(
        (mapping) =>
          !selectedTaskIds.includes(mapping.task),
      );

      await Promise.all(
        mappingsToDelete.map((mapping) =>
          deleteTaskCriteriaMapping(mapping.id),
        ),
      );

      if (selectedTaskIds.length > 0) {
        const baseWeight =
          Math.floor((100 / selectedTaskIds.length) * 100) / 100;

        const weights = selectedTaskIds.map((_, index) => {
          if (index === selectedTaskIds.length - 1) {
            const previousTotal =
              baseWeight * (selectedTaskIds.length - 1);

            return (100 - previousTotal).toFixed(2);
          }

          return baseWeight.toFixed(2);
        });

        for (let index = 0; index < selectedTaskIds.length; index += 1) {
          const taskId = selectedTaskIds[index];
          const weight = weights[index];

          const existing = currentMappings.find(
            (mapping) => mapping.task === taskId,
          );

          if (existing) {
            await updateTaskCriteriaMapping(existing.id, {
              assignment_level: level.id,
              task: taskId,
              rubric_criterion: criterion.id,
              inferred_weight: weight,
              ai_explanation: "Manual task-to-rubric mapping",
            });
          } else {
            await createTaskCriteriaMapping({
              assignment_level: level.id,
              task: taskId,
              rubric_criterion: criterion.id,
              inferred_weight: weight,
              ai_explanation: "Manual task-to-rubric mapping",
            });
          }
        }
      }

      setTaskCriteriaMappings(
        await getTaskCriteriaMappings(),
      );

      setMappingCriterionId("");
      setSelectedMappingTaskIds([]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save task-to-rubric mapping.",
      );
    } finally {
      setIsSavingTaskMapping(false);
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

          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
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
                onChange={(e) => setSearchTerm(e.target.value)}
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
              onClick={() => setShowCreateAssignment((current) => !current)}
            >
              {showCreateAssignment ? "Close" : "+ New Assignment"}
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

        {filteredAssignments.length === 0 ? (
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
                {filteredAssignments.map((assignment) => {
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
                            <button
                              type="button"
                              className="btn-table btn-table-danger"
                              onClick={() =>
                                void openAssignmentDelete(assignment.id)
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

        {selectedAssignment && (
          <>
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                zIndex: 9998,
              }}
              onClick={() => setSelectedAssignmentId("")}
            />
            <section
              className="assignment-workspace content-card assignment-workspace-modal"
            >
              <div className="section-header assignment-workspace-header" style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10, padding: '24px 24px 0', borderBottom: '1px solid var(--border)', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: '0 0 8px 0' }}>
                    {selectedAssignment.assignment_code} — {selectedAssignment.assignment_title}
                  </h2>
                  <p className="section-description" style={{ margin: 0, paddingBottom: '16px' }}>
                    {selectedAssignment.qualification_code} → {selectedAssignment.module_code}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAssignmentId("")}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  aria-label="Close panel"
                >
                  <X size={20} color="var(--text-muted)" />
                </button>
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
                    activeWorkspaceTab === "configuration"
                      ? "workspace-tab active"
                      : "workspace-tab"
                  }
                  onClick={() => setActiveWorkspaceTab("configuration")}
                >
                  Submission Configuration
                </button>
              </div>

              {activeWorkspaceTab === "overview" && (
                <div className="workspace-panel">
                  <div className="overview-grid">
                    <div>
                      <span className="detail-label">Qualification</span>
                      <strong>{selectedAssignment.qualification_code}</strong>
                    </div>

                    <div>
                      <span className="detail-label">Module</span>
                      <strong>{selectedAssignment.module_code}</strong>
                    </div>

                    <div>
                      <span className="detail-label">Assignment</span>
                      <strong>{selectedAssignment.assignment_code}</strong>
                    </div>

                    <div>
                      <span className="detail-label">Maximum score</span>
                      <strong>{selectedAssignment.maximum_score}</strong>
                    </div>
                  </div>

                  {selectedAssignmentLevels.map((level) => {
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
                              {level.level_code === "basic"
                                ? "Basic submission"
                                : "Advanced submission"}
                            </span>
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

                        <div className="overview-grid">
                          <div>
                            <span className="detail-label">Skill code</span>
                            <strong>{level.skill_statement_code || "—"}</strong>
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
                                      <strong>
                                        {criterion.criterion_code}
                                      </strong>

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
              )}

              {activeWorkspaceTab === "configuration" && (
                <div className="workspace-panel">
                  <div className="section-header compact-section-header">
                    <div>
                      <h3>Submission configuration</h3>
                      <p className="section-description">
                        Configure Basic and Advanced requirements, tasks and rubrics.
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
                      const levelCriteria = selectedAssignmentCriteria.filter(
                        (criterion) => criterion.assignment_level === level.id,

                      );
                      const hasUnmappedCriteria = levelCriteria.some(
                        (criterion) =>
                          !taskCriteriaMappings.some(
                            (mapping) =>
                              mapping.rubric_criterion === criterion.id,
                          ),
                      );

                      const levelCriterionIds = levelCriteria.map(
                        (criterion) => criterion.id,
                      );
                      const levelBands = selectedAssignmentBands.filter(
                        (band) => levelCriterionIds.includes(band.rubric_criterion),
                      );
                      const activeMappingCriterion = levelCriteria.find(
                        (criterion) => criterion.id === mappingCriterionId,
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
                        <div
                          key={level.id}
                          className={`level-config-item ${isExpanded ? "expanded" : ""}`}
                        >
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
                              <div className="level-editing-banner">
                                <div>
                                  <span className="level-editing-eyebrow">You are editing</span>
                                  <strong>
                                    {level.level_code === "basic"
                                      ? "Basic Submission"
                                      : "Advanced Submission"}
                                  </strong>
                                </div>
                                <span className="level-editing-track">
                                  {level.level_code === "basic"
                                    ? "Foundation + Proficient"
                                    : "Proficient + Expert"}
                                </span>
                              </div>

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
                                  <div className="form-grid form-grid-2">
                                    <div className="form-group">
                                      <label>Level title</label>
                                      <input
                                        value={levelTitle}
                                        onChange={(event) => setLevelTitle(event.target.value)}
                                      />
                                    </div>
                                    <div className="form-group">
                                      <label>Skill statement code</label>
                                      <input
                                        value={levelSkillStatementCode}
                                        onChange={(event) =>
                                          setLevelSkillStatementCode(event.target.value)
                                        }
                                      />
                                    </div>
                                  </div>
                                  <div className="form-group">
                                    <label>Skill statement</label>
                                    <textarea
                                      value={levelSkillStatement}
                                      onChange={(event) =>
                                        setLevelSkillStatement(event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="form-group">
                                    <label>Objective</label>
                                    <textarea
                                      value={levelObjective}
                                      onChange={(event) => setLevelObjective(event.target.value)}
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
                                      {isSavingLevel ? "Saving..." : "Save Requirements"}
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
                                  <div className="overview-grid level-requirement-summary">
                                    <div>
                                      <span className="detail-label">Skill statement code</span>
                                      <strong>{level.skill_statement_code || "—"}</strong>
                                    </div>
                                    <div>
                                      <span className="detail-label">Level title</span>
                                      <strong>{level.title || "—"}</strong>
                                    </div>
                                  </div>
                                  <div className="overview-stack">
                                    <div className="detail-block">
                                      <span className="detail-label">Skill statement</span>
                                      <p>{level.skill_statement || "—"}</p>
                                    </div>
                                    <div className="detail-block">
                                      <span className="detail-label">Objective</span>
                                      <p>{level.objective || "—"}</p>
                                    </div>
                                    <div className="detail-block">
                                      <span className="detail-label">Instructions</span>
                                      <p>{level.instructions || "—"}</p>
                                    </div>
                                    <div className="detail-block">
                                      <span className="detail-label">Expected outcome</span>
                                      <p>{level.expected_outcome || "—"}</p>
                                    </div>
                                  </div>
                                  <div className="section-actions compact-section-header">
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      onClick={() => startEditingLevel(level)}
                                    >
                                      Edit Requirements
                                    </button>
                                  </div>
                                </>
                              )}

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
                                  onClick={() => setTaskFormLevelId(level.id)}
                                >
                                  + Add Task
                                </button>
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

                              {taskFormLevelId === level.id && (
                                <div className="config-modal-backdrop">
                                  <div className="config-modal">
                                    <div className="config-modal-header">
                                      <h3>Add Task</h3>
                                      <button
                                        type="button"
                                        className="config-modal-close"
                                        onClick={() => setTaskFormLevelId("")}
                                      >
                                        <X size={20} />
                                      </button>
                                    </div>

                                    <form
                                      className="modern-form"
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
                                        />
                                      </div>

                                      <div className="form-actions">
                                        <button
                                          type="button"
                                          className="btn-secondary"
                                          onClick={() => setTaskFormLevelId("")}
                                        >
                                          Cancel
                                        </button>

                                        <button
                                          type="submit"
                                          className="btn-primary"
                                          disabled={savingTaskLevelId === level.id}
                                        >
                                          {savingTaskLevelId === level.id
                                            ? "Adding..."
                                            : "Add Task"}
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                </div>
                              )}
                              <section className="rubric-section level-rubric-section">
                                <div className="section-header compact-section-header">
                                  <div>
                                    <h3>{level.display_name} rubric criteria</h3>
                                    <p className="section-description">
                                      Criteria for this submission path.
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() => setCriterionFormLevelId(level.id)}
                                  >
                                    + Add Criterion
                                  </button>
                                </div>

                                {hasUnmappedCriteria && (
                                  <p className="error-message">
                                    Every rubric criterion must be assigned to at least one task before grading.
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
                                          onClick={() => setCriterionFormLevelId("")}
                                        >
                                          <X size={20} />
                                        </button>
                                      </div>

                                      <form
                                        className="modern-form"
                                        onSubmit={(event) => void saveCriterion(event, level.id)}
                                      >
                                        <div className="form-grid form-grid-2">
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

                                        <div className="form-actions">
                                          <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => setCriterionFormLevelId("")}
                                          >
                                            Cancel
                                          </button>

                                          <button
                                            type="submit"
                                            className="btn-primary"
                                            disabled={isSavingCriterion}
                                          >
                                            {isSavingCriterion ? "Adding..." : "Add Criterion"}
                                          </button>
                                        </div>
                                      </form>
                                    </div>
                                  </div>
                                )}

                                {levelCriteria.length === 0 ? (
                                  <div className="empty-state">No rubric criteria added yet.</div>
                                ) : (
                                  <div className="table-container rubric-table-container">
                                    <table className="modern-table">
                                      <thead>
                                        <tr>
                                          <th>Code</th>
                                          <th>Criterion</th>
                                          <th>Max</th>
                                          <th>Seq.</th>
                                          <th>Assigned tasks</th>
                                          <th>Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {levelCriteria.map((criterion) => {
                                          const isEditing =
                                            editingCriterionId === criterion.id;

                                          const criterionMappings =
                                            taskCriteriaMappings.filter(
                                              (mapping) =>
                                                mapping.rubric_criterion === criterion.id,
                                            );

                                          const assignedTasks = levelTaskItems.filter(
                                            (task) =>
                                              criterionMappings.some(
                                                (mapping) => mapping.task === task.id,
                                              ),
                                          );

                                          return (
                                            <tr key={criterion.id}>
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
                                                      setEditCriterionMaximumScore(
                                                        event.target.value,
                                                      )
                                                    }
                                                  />
                                                ) : (
                                                  criterion.maximum_score
                                                )}
                                              </td>
                                              <td>{criterion.sequence}</td>
                                              <td>
                                                {assignedTasks.length === 0 ? (
                                                  <span className="table-subtext">
                                                    None
                                                  </span>
                                                ) : (
                                                  <div className="criterion-task-tags">
                                                    {assignedTasks.map((task) => (
                                                      <span
                                                        key={task.id}
                                                        className="tag-pill"
                                                        title={task.title}
                                                      >
                                                        {task.task_code}
                                                      </span>
                                                    ))}
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
                                                        void saveCriterionEdit(criterion)
                                                      }
                                                    >
                                                      Save
                                                    </button>
                                                    <button
                                                      type="button"
                                                      className="btn-table"
                                                      onClick={() =>
                                                        setEditingCriterionId("")
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
                                                        openTaskMapping(criterion)
                                                      }
                                                    >
                                                      Assign Tasks
                                                    </button>
                                                    <button
                                                      type="button"
                                                      className="btn-table"
                                                      onClick={() =>
                                                        startEditingCriterion(criterion)
                                                      }
                                                    >
                                                      Edit
                                                    </button>
                                                    <button
                                                      type="button"
                                                      className="btn-table btn-table-danger"
                                                      onClick={() =>
                                                        void removeCriterion(criterion.id)
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

                                {activeMappingCriterion && (
                                  <div className="config-modal-backdrop">
                                    <div className="config-modal">
                                      <div className="config-modal-header">
                                        <div>
                                          <h3>Assign Tasks to Rubric Criterion</h3>
                                          <p className="section-description">
                                            {activeMappingCriterion.criterion_code} —{" "}
                                            {activeMappingCriterion.title}
                                          </p>
                                        </div>

                                        <button
                                          type="button"
                                          className="config-modal-close"
                                          onClick={() => {
                                            setMappingCriterionId("");
                                            setSelectedMappingTaskIds([]);
                                          }}
                                        >
                                          <X size={20} />
                                        </button>
                                      </div>

                                      {levelTaskItems.length === 0 ? (
                                        <div className="empty-state">
                                          No tasks exist for this submission level yet.
                                          Add tasks first, then assign them to the criterion.
                                        </div>
                                      ) : (
                                        <div className="task-mapping-list">
                                          {levelTaskItems.map((task) => {
                                            const checked =
                                              selectedMappingTaskIds.includes(task.id);

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
                                                    toggleTaskMappingSelection(task.id)
                                                  }
                                                />

                                                <div>
                                                  <strong>
                                                    {task.task_code} — {task.title}
                                                  </strong>

                                                  {task.instructions && (
                                                    <small className="table-subtext">
                                                      {task.instructions}
                                                    </small>
                                                  )}
                                                </div>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}

                                      <div className="form-actions">
                                        <button
                                          type="button"
                                          className="btn-secondary"
                                          disabled={isSavingTaskMapping}
                                          onClick={() => {
                                            setMappingCriterionId("");
                                            setSelectedMappingTaskIds([]);
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

                              <section className="rubric-section level-rubric-section">
                                <div className="section-header compact-section-header">
                                  <div>
                                    <h3>{level.display_name} rubric bands</h3>
                                    <p className="section-description">
                                      Performance bands for this submission path.
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() => {
                                      setBandCriterionId("");
                                      setBandFormLevelId(level.id);
                                    }}
                                  >
                                    + Add Band
                                  </button>
                                </div>

                                {bandFormLevelId === level.id && (
                                  <div className="config-modal-backdrop">
                                    <div className="config-modal">
                                      <div className="config-modal-header">
                                        <h3>Add Rubric Band</h3>

                                        <button
                                          type="button"
                                          className="config-modal-close"
                                          onClick={() => setBandFormLevelId("")}
                                        >
                                          <X size={20} />
                                        </button>
                                      </div>

                                      <form
                                        className="modern-form"
                                        onSubmit={saveBand}
                                      >
                                        <div className="form-grid form-grid-2">
                                          <div className="form-group">
                                            <label>Criterion</label>
                                            <select
                                              value={bandCriterionId}
                                              onChange={(event) => {
                                                const criterionId = event.target.value;
                                                setBandCriterionId(criterionId);
                                                setBandCode("failed");
                                                setBandDisplayName("Failed");

                                                const existingBands = bands.filter(
                                                  (band) => band.rubric_criterion === criterionId,
                                                );

                                                setBandSequence(String(existingBands.length + 1));
                                              }}
                                              required
                                            >
                                              <option value="">Select criterion</option>
                                              {levelCriteria.map((criterion) => (
                                                <option key={criterion.id} value={criterion.id}>
                                                  {criterion.criterion_code} - {criterion.title}
                                                </option>
                                              ))}
                                            </select>
                                          </div>

                                          <div className="form-group">
                                            <label>Band</label>
                                            <select
                                              value={bandCode}
                                              onChange={(event) => {
                                                const value =
                                                  event.target.value as RubricBand["band_code"];

                                                setBandCode(value);
                                                setBandDisplayName(
                                                  value.charAt(0).toUpperCase() + value.slice(1),
                                                );
                                              }}
                                            >
                                              {(level.level_code === "advanced"
                                                ? ["failed", "proficient", "expert"]
                                                : ["failed", "foundation", "proficient"]
                                              ).map((code) => (
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
                                              step="0.01"
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
                                              step="0.01"
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

                                        <div className="form-actions">
                                          <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => setBandFormLevelId("")}
                                          >
                                            Cancel
                                          </button>

                                          <button
                                            type="submit"
                                            className="btn-primary"
                                            disabled={isSavingBand || !bandCriterionId}
                                          >
                                            {isSavingBand ? "Adding..." : "Add Rubric Band"}
                                          </button>
                                        </div>
                                      </form>
                                    </div>
                                  </div>
                                )}

                                {levelBands.length === 0 ? (
                                  <div className="empty-state">No rubric bands added yet.</div>
                                ) : (
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
                                        {levelBands.map((band) => {
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
                                )}
                              </section>


                            </article>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </section>

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
                  )?.assignment_code}{" "}
                  —{" "}
                  {assignments.find(
                    (assignment) =>
                      assignment.id === deleteAssignmentId,
                  )?.assignment_title}
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
                  <strong>This assignment cannot be deleted.</strong>
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
                    <strong>{deleteImpact.affected.tasks}</strong>
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
                    onClick={() => void confirmAssignmentDelete()}
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

    </main>
  );
}
