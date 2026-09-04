import "../css/AssessmentMappings.css";
import "../css/QualificationsPage.css";
import "../css/AssignmentsPage.css";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  createModuleAssignment,
  deleteModuleAssignment,
  createAssignmentLevel,
  deleteAssignmentLevel,
  getAssignmentLevels,
  getModuleAssignments,
  getModules,
  getQualifications,
  updateAssignmentConfigurationLock,
  updateAssignmentLevel,
  updateModuleAssignment,
  type AssignmentLevel,
  type Module,
  type ModuleAssignment,
  type Qualification,
} from "../api/courses";

import {
  createRubricBand,
  createRubricCriterion,
  createTask,
  deleteRubricBand,
  deleteRubricCriterion,
  deleteTask,
  getRubricBands,
  getRubricCriteria,
  getTasks,
  importAssignmentConfigurationCsv,
  updateRubricBand,
  updateRubricCriterion,
  updateTask,
  type RubricBand,
  type RubricCriterion,
  type Task,
} from "../api/grading";

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

import { RecentDeletedAuditButton } from "../components/RecentDeletedAuditButton";
import { AssignmentSummaryCards } from "../components/assignments/AssignmentSummaryCards";
import { AssignmentListContent } from "../components/assignments/AssignmentListContent";
import { AssignmentWorkspaceShell } from "../components/assignments/AssignmentWorkspaceShell";
import { AssignmentManagementModals } from "../components/assignments/AssignmentManagementModals";
import { AssignmentOverviewPanel } from "../components/assignments/AssignmentOverviewPanel";
import { AssignmentLevelRequirements } from "../components/assignments/AssignmentLevelRequirements";
import { AssignmentTasksSection } from "../components/assignments/AssignmentTasksSection";
import { AssignmentCriteriaSection } from "../components/assignments/AssignmentCriteriaSection";
import { AssignmentBandsSection } from "../components/assignments/AssignmentBandsSection";


type WorkspaceTab = "overview" | "configuration";


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
    Record<
      string,
      {
        task_code: string;
        title: string;
        evidence_required: string;
      }
    >
  >({});
  const [savingTaskLevelId, setSavingTaskLevelId] = useState("");
  const [editingTaskId, setEditingTaskId] = useState("");
  const [editTaskCode, setEditTaskCode] = useState("");
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskEvidenceRequired, setEditTaskEvidenceRequired] = useState("");
  const [isSavingTaskEdit, setIsSavingTaskEdit] = useState(false);

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
  const [editCode, setEditCode] = useState("");
  const [editMaximumScore, setEditMaximumScore] = useState("");
  const [editMinimumPassScore, setEditMinimumPassScore] = useState("");
  const [editIsSummative, setEditIsSummative] = useState(true);
  const [editContributesToFinalMark, setEditContributesToFinalMark] =
    useState(true);
  const [editFinalMarkWeight, setEditFinalMarkWeight] = useState("100");
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSavingAssignmentEdit, setIsSavingAssignmentEdit] = useState(false);

  // Level edit
  const [editingLevelId, setEditingLevelId] = useState("");
  const [levelTitle, setLevelTitle] = useState("");
  const [levelSkillStatementCode, setLevelSkillStatementCode] = useState("");
  const [levelSkillStatement, setLevelSkillStatement] = useState("");
  const [levelObjective, setLevelObjective] = useState("");
  const [levelScenario, setLevelScenario] = useState("");
  const [levelInstructions, setLevelInstructions] = useState("");
  const [levelDeliverables, setLevelDeliverables] = useState("");
  const [levelExpectedOutcome, setLevelExpectedOutcome] = useState("");
  const [isSavingLevel, setIsSavingLevel] = useState(false);

  // Criterion create/edit
  const [criterionCode, setCriterionCode] = useState("");
  const [criterionTitle, setCriterionTitle] = useState("");
  const [criterionDescription, setCriterionDescription] = useState("");
  const [criterionMaximumScore, setCriterionMaximumScore] = useState("10");
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
  const [importingLevelId, setImportingLevelId] = useState("");
  const [levelLocks, setLevelLocks] = useState<
    Record<
      string,
      {
        locked: boolean;
        locked_by: string | null;
        owned_by_me: boolean;
      }
    >
  >({});

  async function refreshLevels() {
    setLevels(await getAssignmentLevels());
  }

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

  useEffect(() => {
    const levelId = expandedLevelIds[0];

    if (
      !levelId ||
      !levelLocks[levelId]?.owned_by_me
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void updateAssignmentConfigurationLock(
        levelId,
        "heartbeat",
      ).then((lock) => {
        setLevelLocks((current) => ({
          ...current,
          [levelId]: lock,
        }));
      });
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [expandedLevelIds, levelLocks]);


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
    .filter(
      (level) =>
        level.assignment === selectedAssignmentId &&
        level.configuration_status !== "retired",
    )
    .sort((a, b) => a.sequence - b.sequence);

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

  const [showCreateTrack, setShowCreateTrack] = useState(false);
  const [newTrackName, setNewTrackName] = useState("");
  const [newTrackCode, setNewTrackCode] = useState("");
  const [newTrackBand1, setNewTrackBand1] = useState("");
  const [newTrackBand2, setNewTrackBand2] = useState("");
  const [isCreatingTrack, setIsCreatingTrack] = useState(false);

  const [editingTrackId, setEditingTrackId] = useState("");
  const [editTrackName, setEditTrackName] = useState("");
  const [editTrackCode, setEditTrackCode] = useState("");
  const [isSavingTrackEdit, setIsSavingTrackEdit] = useState(false);
  const [togglingTrackId, setTogglingTrackId] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const createdAssignment = await createModuleAssignment({
        module: moduleId,
        assignment_code: code,
        assignment_title: code,
        maximum_score: maximumScore,
        minimum_pass_score: minimumPassScore,
        is_summative: isSummative,
        contributes_to_final_mark: contributesToFinalMark,
        final_mark_weight: finalMarkWeight,
        is_active: isActive,
      });

      setCode("");
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
    setEditCode(assignment.assignment_code);
    setEditMaximumScore(assignment.maximum_score);
    setEditMinimumPassScore(assignment.minimum_pass_score);
    setEditIsSummative(assignment.is_summative);
    setEditContributesToFinalMark(
      assignment.contributes_to_final_mark,
    );
    setEditFinalMarkWeight(
      assignment.contributes_to_final_mark
        ? assignment.final_mark_weight
        : "0",
    );
    setEditIsActive(assignment.is_active);
  }

  function closeAssignmentEdit() {
    if (isSavingAssignmentEdit) return;
    setEditingAssignmentId("");
  }

  async function saveAssignmentEdit(
    event: FormEvent<HTMLFormElement>,
    assignment: ModuleAssignment,
  ) {
    event.preventDefault();
    setError("");

    if (
      editContributesToFinalMark &&
      (
        Number(editFinalMarkWeight) < 0 ||
        Number(editFinalMarkWeight) > 100
      )
    ) {
      setError("Final mark weight must be between 0 and 100.");
      return;
    }

    if (
      Number(editMinimumPassScore) >
      Number(editMaximumScore)
    ) {
      setError(
        "Minimum pass score cannot be greater than maximum score.",
      );
      return;
    }

    setIsSavingAssignmentEdit(true);

    try {
      await updateModuleAssignment(assignment.id, {
        assignment_code: editCode.trim(),
        assignment_title: editCode.trim(),
        maximum_score: editMaximumScore,
        minimum_pass_score: editMinimumPassScore,
        is_summative: editIsSummative,
        contributes_to_final_mark: editContributesToFinalMark,
        final_mark_weight: editContributesToFinalMark
          ? editFinalMarkWeight
          : "0",
        is_active: editIsActive,
      });

      await loadData();
      setEditingAssignmentId("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update assignment.",
      );
    } finally {
      setIsSavingAssignmentEdit(false);
    }
  }

  function startEditingTrack(level: AssignmentLevel) {
    setEditingTrackId(level.id);
    setEditTrackName(level.display_name);
    setEditTrackCode(level.level_code);
  }

  function cancelEditingTrack() {
    if (isSavingTrackEdit) return;

    setEditingTrackId("");
    setEditTrackName("");
    setEditTrackCode("");
  }

  async function saveTrackEdit(level: AssignmentLevel) {
    const name = editTrackName.trim();
    const code = editTrackCode.trim();

    if (!name) {
      setError("Track name is required.");
      return;
    }

    if (!code) {
      setError("Track code is required.");
      return;
    }

    setError("");
    setIsSavingTrackEdit(true);

    let lockAcquired = false;

    try {
      const lock = await updateAssignmentConfigurationLock(
        level.id,
        "acquire",
      );

      if (!lock.owned_by_me) {
        setError(
          lock.locked_by
            ? `${lock.locked_by} is currently editing this configuration.`
            : "This configuration is currently being edited by another administrator.",
        );
        return;
      }

      lockAcquired = true;

      await updateAssignmentLevel(level.id, {
        display_name: name,
        level_code: code,
      });

      await loadData();

      setEditingTrackId("");
      setEditTrackName("");
      setEditTrackCode("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update submission track.",
      );
    } finally {
      if (lockAcquired) {
        try {
          await updateAssignmentConfigurationLock(
            level.id,
            "release",
          );
        } catch {
          // Lock will expire automatically if release fails.
        }
      }

      setIsSavingTrackEdit(false);
    }
  }

  async function toggleTrackActive(level: AssignmentLevel) {
    const nextActive = !level.is_active;

    const confirmed = window.confirm(
      nextActive
        ? `Enable track "${level.display_name}"?`
        : `Disable track "${level.display_name}"? Learners will no longer be able to select this track until it is enabled again.`,
    );

    if (!confirmed) return;

    setError("");
    setTogglingTrackId(level.id);

    let lockAcquired = false;

    try {
      const lock = await updateAssignmentConfigurationLock(
        level.id,
        "acquire",
      );

      if (!lock.owned_by_me) {
        setError(
          lock.locked_by
            ? `${lock.locked_by} is currently editing this configuration.`
            : "This configuration is currently being edited by another administrator.",
        );
        return;
      }

      lockAcquired = true;

      await updateAssignmentLevel(level.id, {
        is_active: nextActive,
      });

      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to ${nextActive ? "enable" : "disable"} submission track.`,
      );
    } finally {
      if (lockAcquired) {
        try {
          await updateAssignmentConfigurationLock(
            level.id,
            "release",
          );
        } catch {
          // Lock will expire automatically if release fails.
        }
      }

      setTogglingTrackId("");
    }
  }


  async function removeTrack(level: AssignmentLevel) {
    if (
      !window.confirm(
        `Delete track "${level.display_name}"?`,
      )
    ) {
      return;
    }

    setError("");

    try {
      if (expandedLevelIds.includes(level.id)) {
        await releaseLevelLock(level.id);
        setExpandedLevelIds([]);
      }

      await deleteAssignmentLevel(level.id);

      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete submission track.",
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
    setLevelScenario(level.scenario);
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
        scenario: levelScenario,
        instructions: levelInstructions,
        deliverables: levelDeliverables
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        expected_outcome: levelExpectedOutcome,
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

  async function releaseLevelLock(levelId: string) {
    const currentLock = levelLocks[levelId];

    if (!currentLock?.owned_by_me) return;

    try {
      await updateAssignmentConfigurationLock(
        levelId,
        "release",
      );
    } catch {
      // The lease also expires automatically if release fails.
    }

    setLevelLocks((current) => ({
      ...current,
      [levelId]: {
        locked: false,
        locked_by: null,
        owned_by_me: false,
      },
    }));
  }

  async function toggleLevel(levelId: string) {
    const isOpen = expandedLevelIds.includes(levelId);

    if (isOpen) {
      await releaseLevelLock(levelId);
      setExpandedLevelIds([]);
      return;
    }

    const previousLevelId = expandedLevelIds[0];

    if (previousLevelId && previousLevelId !== levelId) {
      await releaseLevelLock(previousLevelId);
    }

    setBandCriterionId("");
    setError("");

    try {
      const lock = await updateAssignmentConfigurationLock(
        levelId,
        "acquire",
      );

      setLevelLocks((current) => ({
        ...current,
        [levelId]: lock,
      }));

      setExpandedLevelIds([levelId]);
      await refreshLevelTasks(levelId);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to open this configuration.",
      );
    }
  }

  function updateTaskDraft(
    levelId: string,
    field: "task_code" | "title" | "evidence_required",
    value: string,
  ) {
    setTaskDrafts((current) => ({
      ...current,
      [levelId]: {
        task_code: current[levelId]?.task_code ?? "",
        title: current[levelId]?.title ?? "",
        evidence_required:
          current[levelId]?.evidence_required ?? "",
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
      evidence_required: "",
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
        evidence_required: draft.evidence_required.trim(),
        sequence: nextSequence,
      });

      await refreshLevelTasks(level.id);
      await refreshLevels();
      setTaskDrafts((current) => ({
        ...current,
        [level.id]: {
          task_code: "",
          title: "",
          evidence_required: "",
        },
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

  function startEditingTask(task: Task) {
    setEditingTaskId(task.id);
    setEditTaskCode(task.task_code);
    setEditTaskTitle(task.title);
    setEditTaskEvidenceRequired(task.evidence_required);
  }

  function cancelTaskEdit() {
    if (isSavingTaskEdit) return;

    setEditingTaskId("");
    setEditTaskCode("");
    setEditTaskTitle("");
    setEditTaskEvidenceRequired("");
  }

  async function saveTaskEdit(task: Task) {
    if (!editTaskTitle.trim()) {
      setError("Task title is required.");
      return;
    }

    setError("");
    setIsSavingTaskEdit(true);

    try {
      await updateTask(task.id, {
        task_code: editTaskCode.trim() || task.task_code,
        title: editTaskTitle.trim(),
        evidence_required: editTaskEvidenceRequired.trim(),
      });

      await refreshLevelTasks(task.assignment_level);
      setEditingTaskId("");
      setEditTaskCode("");
      setEditTaskTitle("");
      setEditTaskEvidenceRequired("");
      await refreshLevels();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update task.",
      );
    } finally {
      setIsSavingTaskEdit(false);
    }
  }

  async function removeTask(task: Task) {
    if (!window.confirm(`Delete task ${task.task_code}?`)) return;

    setError("");
    try {
      await deleteTask(task.id);
      await refreshLevelTasks(task.assignment_level);
      await refreshLevels();
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

    const levelCriteria = criteria.filter(
      (criterion) => criterion.assignment_level === assignmentLevelId,
    );

    const nextSequence =
      levelCriteria.reduce(
        (max, criterion) => Math.max(max, criterion.sequence),
        0,
      ) + 1;

    const generatedCriterionCode =
      `C${String(nextSequence).padStart(2, "0")}`;

    try {
      await createRubricCriterion({
        assignment_level: assignmentLevelId,
        criterion_code:
          criterionCode.trim() || generatedCriterionCode,
        title: criterionTitle,
        description: criterionDescription,
        maximum_score: criterionMaximumScore,
        sequence: nextSequence,
        ai_gradable: true,
        deterministic: false,
      });

      setCriterionCode("");
      setCriterionTitle("");
      setCriterionDescription("");
      setCriterionMaximumScore("10");
      setCriteria(await getRubricCriteria());
      setBands(await getRubricBands());
      setCriterionFormLevelId("");
      await refreshLevels();
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
      await refreshLevels();
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
      await refreshLevels();
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
      await refreshLevels();

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
      await refreshLevels();
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
      await refreshLevels();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete rubric band.",
      );
    }
  }


  function downloadConfigurationCsvTemplate(
    level: AssignmentLevel,
  ) {
    const headers = [
      "record_type",
      "title",
      "skill_statement_code",
      "skill_statement",
      "objective",
      "scenario",
      "instructions",
      "deliverables",
      "expected_outcome",
      "task_code",
      "task_title",
      "task_evidence_required",
      "criterion_code",
      "criterion_title",
      "criterion_description",
      "maximum_score",
    ];

    const rows = [
      headers,
      [
        "configuration",
        level.title || "",
        "SS01",
        "Enter the skill statement here",
        "Enter the objective here",
        "Enter the scenario here",
        "Enter the submission instructions here",
        "Deliverable 1 | Deliverable 2",
        "Enter the expected outcome here",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      [
        "task",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "T01",
        "Task title",
        "Describe the evidence or work required for this task",
        "",
        "",
        "",
        "",
      ],
      [
        "task",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "T02",
        "Another task title",
        "Describe the evidence or work required for this task",
        "",
        "",
        "",
        "",
      ],
      [
        "criterion",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "C01",
        "Criterion title",
        "Describe what is being assessed",
        "10",
      ],
      [
        "criterion",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "C02",
        "Another criterion",
        "Describe what is being assessed",
        "20",
      ],
    ];

    const escapeCsvCell = (value: string) =>
      `"${value.replace(/"/g, '""')}"`;

    const csv = rows
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "assignment-configuration-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function importConfigurationCsv(
    level: AssignmentLevel,
    file: File,
  ) {
    setError("");
    setImportingLevelId(level.id);

    try {
      await importAssignmentConfigurationCsv(level.id, file);
      await loadData();
      setExpandedLevelIds([level.id]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to import assignment configuration CSV.",
      );
    } finally {
      setImportingLevelId("");
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

      await refreshLevels();
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


  async function handleCreateTrack() {
    if (!selectedAssignment) {
      return;
    }

    const displayName = newTrackName.trim();

    if (!displayName) {
      setError("Track name is required.");
      return;
    }

    const generatedCode = displayName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const levelCode =
      newTrackCode.trim() || generatedCode;

    if (!levelCode) {
      setError("Track code is required.");
      return;
    }

    const nextSequence =
      selectedAssignmentLevels.reduce(
        (max, level) =>
          Math.max(max, level.sequence ?? 0),
        0,
      ) + 1;

    setError("");

    const band1Name = newTrackBand1.trim();
    const band2Name = newTrackBand2.trim();

    if (!band1Name || !band2Name) {
      setError("Both achievement band names are required.");
      return;
    }

    const makeBandCode = (name: string) =>
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    setIsCreatingTrack(true);

    try {
      await createAssignmentLevel({
        assignment: selectedAssignment.id,
        level_code: levelCode,
        display_name: displayName,
        sequence: nextSequence,
        title: displayName,

        skill_statement_code: "",
        skill_statement: "",
        objective: "",
        scenario: "",
        instructions: "",
        tasks: [],
        deliverables: [],
        expected_outcome: "",

        source_filename: null,
        version: 1,
        configuration_status: "draft",
        is_active: true,

        band_definitions: [
          {
            band_code: "failed",
            display_name: "Failed",
            minimum_percentage: 0,
            maximum_percentage: 69.99,
          },
          {
            band_code: makeBandCode(band1Name),
            display_name: band1Name,
            minimum_percentage: 70,
            maximum_percentage: 79.99,
          },
          {
            band_code: makeBandCode(band2Name),
            display_name: band2Name,
            minimum_percentage: 80,
            maximum_percentage: 100,
          },
        ],
      });

      await loadData();

      setNewTrackName("");
      setNewTrackCode("");
      setNewTrackBand1("");
      setNewTrackBand2("");
      setShowCreateTrack(false);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create submission track.",
      );
    } finally {
      setIsCreatingTrack(false);
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

        <RecentDeletedAuditButton />
      </div>

      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      <AssignmentSummaryCards
        qualificationCount={qualifications.length}
        moduleCount={modules.length}
        assignmentCount={assignments.length}
      />

      <section className="page-section">

        <AssignmentListContent
          filteredAssignments={filteredAssignments}
          qualifications={qualifications}
          filteredModules={filteredModules}
          selectedAssignmentId={selectedAssignmentId}
          searchTerm={searchTerm}
          showCreateAssignment={showCreateAssignment}
          qualificationId={qualificationId}
          moduleId={moduleId}
          code={code}
          maximumScore={maximumScore}
          minimumPassScore={minimumPassScore}
          finalMarkWeight={finalMarkWeight}
          isSummative={isSummative}
          contributesToFinalMark={contributesToFinalMark}
          isActive={isActive}
          isSubmitting={isSubmitting}
          setSearchTerm={setSearchTerm}
          setShowCreateAssignment={
            setShowCreateAssignment
          }
          setQualificationId={setQualificationId}
          setModuleId={setModuleId}
          setCode={setCode}
          setMaximumScore={setMaximumScore}
          setMinimumPassScore={
            setMinimumPassScore
          }
          setFinalMarkWeight={setFinalMarkWeight}
          setIsSummative={setIsSummative}
          setContributesToFinalMark={
            setContributesToFinalMark
          }
          setIsActive={setIsActive}
          handleSubmit={handleSubmit}
          setSelectedAssignmentId={
            setSelectedAssignmentId
          }
          setActiveWorkspaceTab={
            setActiveWorkspaceTab
          }
          startEditingAssignment={
            startEditingAssignment
          }
          openAssignmentDelete={
            openAssignmentDelete
          }
        />


        {selectedAssignment && (
          <AssignmentWorkspaceShell
            assignment={selectedAssignment}
            activeWorkspaceTab={activeWorkspaceTab}
            onClose={() => {
              const levelId = expandedLevelIds[0];

              if (levelId) {
                void releaseLevelLock(levelId);
              }

              setExpandedLevelIds([]);
              setSelectedAssignmentId("");
            }}
            onTabChange={setActiveWorkspaceTab}
          >

            {activeWorkspaceTab === "overview" && (
              <AssignmentOverviewPanel
                assignment={selectedAssignment}
                levels={selectedAssignmentLevels}
                tasks={tasks}
                criteria={criteria}
                bands={bands}
                taskCriteriaMappings={taskCriteriaMappings}
              />
            )}

            {activeWorkspaceTab === "configuration" && (
              <div className="workspace-panel">
                <div className="section-header compact-section-header">
                  <div>
                    <h3>Submission configuration</h3>
                    <p className="section-description">
                      Configure submission tracks, requirements, tasks and rubrics.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() =>
                      setShowCreateTrack((current) => !current)
                    }
                  >
                    + Add Track
                  </button>
                </div>

                {showCreateTrack && (
                  <div
                    className="content-card"
                    style={{
                      padding: "18px",
                      marginBottom: "18px",
                    }}
                  >
                    <div className="form-grid form-grid-2">
                      <div className="form-group">
                        <label>Track name</label>

                        <input
                          value={newTrackName}
                          onChange={(event) =>
                            setNewTrackName(event.target.value)
                          }
                          placeholder="e.g. Professional"
                        />
                      </div>

                      <div className="form-group">
                        <label>Track code</label>

                        <input
                          value={newTrackCode}
                          onChange={(event) =>
                            setNewTrackCode(event.target.value)
                          }
                          placeholder="Auto-generated if empty"
                        />
                      </div>
                      <div className="form-group">
                        <label>Band 1</label>
                        <input
                          value={newTrackBand1}
                          onChange={(event) =>
                            setNewTrackBand1(event.target.value)
                          }
                          placeholder="e.g. Competent"
                        />
                      </div>

                      <div className="form-group">
                        <label>Band 2</label>
                        <input
                          value={newTrackBand2}
                          onChange={(event) =>
                            setNewTrackBand2(event.target.value)
                          }
                          placeholder="e.g. Mastery"
                        />
                      </div>
                    </div>

                    <div className="form-actions form-actions-compact">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={isCreatingTrack}
                        onClick={() =>
                          void handleCreateTrack()
                        }
                      >
                        {isCreatingTrack
                          ? "Creating..."
                          : "Create Track"}
                      </button>

                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={isCreatingTrack}
                        onClick={() => {
                          setShowCreateTrack(false);
                          setNewTrackName("");
                          setNewTrackCode("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="level-grid">
                  {selectedAssignmentLevels.map((level) => {



                    const isExpanded = expandedLevelIds.includes(level.id);
                    const levelLock = levelLocks[level.id];
                    const levelReadOnly =
                      Boolean(levelLock?.locked) &&
                      !levelLock?.owned_by_me;
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
                      evidence_required: "",
                    };
                    const nextTaskNumber =
                      levelTaskItems.reduce(
                        (max, task) => Math.max(max, task.sequence),
                        0,
                      ) + 1;
                    const suggestedTaskCode = `T${String(nextTaskNumber).padStart(2, "0")}`;
                    const nextCriterionNumber =
                      levelCriteria.reduce(
                        (max, criterion) =>
                          Math.max(max, criterion.sequence),
                        0,
                      ) + 1;
                    const suggestedCriterionCode =
                      `C${String(nextCriterionNumber).padStart(2, "0")}`;

                    return (
                      <div
                        key={level.id}
                        className={`level-config-item ${isExpanded ? "expanded" : ""}`}
                      >
                        <div
                          className={`track-summary-card ${isExpanded ? "is-expanded" : ""
                            } ${!level.is_active ? "is-disabled" : ""}`}
                        >
                          <div
                            className="track-summary-main"
                            role="button"
                            tabIndex={0}
                            onClick={() => void toggleLevel(level.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                void toggleLevel(level.id);
                              }
                            }}
                          >
                            <div className="track-summary-heading">
                              <div>
                                <span className="track-eyebrow">
                                  Submission Track
                                </span>

                                <div className="track-title-row">
                                  <h4>{level.display_name}</h4>

                                  <span
                                    className={`track-status-badge ${level.configuration_status === "ready"
                                        ? "track-status-ready"
                                        : "track-status-draft"
                                      }`}
                                  >
                                    {level.configuration_status === "ready"
                                      ? "Ready"
                                      : "Draft"}
                                  </span>

                                  {!level.is_active && (
                                    <span className="track-status-badge track-status-disabled">
                                      Disabled
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span className="track-configure-text">
                                {isExpanded ? "Hide configuration" : "Configure"}
                                <span aria-hidden="true">
                                  {isExpanded ? " ↑" : " ↓"}
                                </span>
                              </span>
                            </div>

                            {level.configuration_status === "draft" && (
                              <div className="track-draft-summary">
                                <strong>
                                  {level.configuration_errors?.length || 0}
                                  {" "}
                                  {level.configuration_errors?.length === 1
                                    ? "item needs attention"
                                    : "items need attention"}
                                </strong>

                                {level.configuration_errors?.length > 0 && (
                                  <ul>
                                    {level.configuration_errors
                                      .slice(0, 3)
                                      .map((message) => (
                                        <li key={message}>{message}</li>
                                      ))}
                                  </ul>
                                )}

                                {(level.configuration_errors?.length || 0) > 3 && (
                                  <small>
                                    +{level.configuration_errors.length - 3} more
                                  </small>
                                )}
                              </div>
                            )}

                            {!level.is_active && (
                              <p className="track-disabled-note">
                                Hidden from learners until this track is enabled.
                              </p>
                            )}
                          </div>

                          <div
                            className="track-summary-actions"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="btn-secondary track-action-button"
                              onClick={() => startEditingTrack(level)}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className={
                                level.is_active
                                  ? "btn-secondary track-action-button"
                                  : "btn-primary track-action-button"
                              }
                              disabled={togglingTrackId === level.id}
                              onClick={() => void toggleTrackActive(level)}
                            >
                              {togglingTrackId === level.id
                                ? "Saving..."
                                : level.is_active
                                  ? "Disable"
                                  : "Enable"}
                            </button>

                            <button
                              type="button"
                              className="btn-danger track-action-button"
                              onClick={() => void removeTrack(level)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>


                        {editingTrackId === level.id && (
                          <div
                            className="content-card"
                            style={{
                              padding: "16px",
                              marginTop: "10px",
                            }}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="form-grid form-grid-2">
                              <div className="form-group">
                                <label>Track name</label>
                                <input
                                  value={editTrackName}
                                  onChange={(event) =>
                                    setEditTrackName(event.target.value)
                                  }
                                />
                              </div>

                              <div className="form-group">
                                <label>Track code</label>
                                <input
                                  value={editTrackCode}
                                  onChange={(event) =>
                                    setEditTrackCode(event.target.value)
                                  }
                                />
                              </div>
                            </div>

                            <div className="form-actions form-actions-compact">
                              <button
                                type="button"
                                className="btn-primary"
                                disabled={isSavingTrackEdit}
                                onClick={() => void saveTrackEdit(level)}
                              >
                                {isSavingTrackEdit ? "Saving..." : "Save"}
                              </button>

                              <button
                                type="button"
                                className="btn-secondary"
                                disabled={isSavingTrackEdit}
                                onClick={cancelEditingTrack}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}



                        {isExpanded && (
                          <article className="level-card track-expanded-content">
                            <AssignmentLevelRequirements
                              level={level}
                              levelReadOnly={levelReadOnly}
                              lockedBy={levelLock?.locked_by}
                              importingLevelId={importingLevelId}

                              editingLevelId={editingLevelId}

                              levelTitle={levelTitle}
                              levelSkillStatementCode={levelSkillStatementCode}
                              levelSkillStatement={levelSkillStatement}
                              levelObjective={levelObjective}
                              levelScenario={levelScenario}
                              levelInstructions={levelInstructions}
                              levelDeliverables={levelDeliverables}
                              levelExpectedOutcome={levelExpectedOutcome}

                              isSavingLevel={isSavingLevel}

                              setLevelTitle={setLevelTitle}
                              setLevelSkillStatementCode={
                                setLevelSkillStatementCode
                              }
                              setLevelSkillStatement={
                                setLevelSkillStatement
                              }
                              setLevelObjective={setLevelObjective}
                              setLevelScenario={setLevelScenario}
                              setLevelInstructions={
                                setLevelInstructions
                              }
                              setLevelDeliverables={
                                setLevelDeliverables
                              }
                              setLevelExpectedOutcome={
                                setLevelExpectedOutcome
                              }
                              setEditingLevelId={setEditingLevelId}

                              downloadConfigurationCsvTemplate={
                                downloadConfigurationCsvTemplate
                              }
                              importConfigurationCsv={
                                importConfigurationCsv
                              }
                              startEditingLevel={startEditingLevel}
                              saveLevel={saveLevel}
                            />

                            <AssignmentTasksSection
                              level={level}
                              levelReadOnly={levelReadOnly}
                              levelTaskItems={levelTaskItems}

                              taskFormLevelId={taskFormLevelId}
                              savingTaskLevelId={savingTaskLevelId}
                              editingTaskId={editingTaskId}
                              isSavingTaskEdit={isSavingTaskEdit}

                              editTaskCode={editTaskCode}
                              editTaskTitle={editTaskTitle}
                              editTaskEvidenceRequired={editTaskEvidenceRequired}

                              taskDraft={taskDraft}
                              suggestedTaskCode={suggestedTaskCode}

                              setTaskFormLevelId={setTaskFormLevelId}

                              setEditTaskCode={setEditTaskCode}
                              setEditTaskTitle={setEditTaskTitle}
                              setEditTaskEvidenceRequired={
                                setEditTaskEvidenceRequired
                              }

                              updateTaskDraft={updateTaskDraft}
                              saveNewTask={saveNewTask}
                              startEditingTask={startEditingTask}
                              cancelTaskEdit={cancelTaskEdit}
                              saveTaskEdit={saveTaskEdit}
                              removeTask={removeTask}
                            />

                            <AssignmentCriteriaSection
                              level={level}
                              levelReadOnly={levelReadOnly}

                              levelCriteria={levelCriteria}
                              levelTaskItems={levelTaskItems}
                              taskCriteriaMappings={
                                taskCriteriaMappings
                              }

                              hasUnmappedCriteria={
                                hasUnmappedCriteria
                              }

                              criterionFormLevelId={
                                criterionFormLevelId
                              }
                              criterionCode={criterionCode}
                              criterionTitle={criterionTitle}
                              criterionDescription={
                                criterionDescription
                              }
                              criterionMaximumScore={
                                criterionMaximumScore
                              }
                              isSavingCriterion={
                                isSavingCriterion
                              }

                              editingCriterionId={
                                editingCriterionId
                              }
                              editCriterionTitle={
                                editCriterionTitle
                              }
                              editCriterionDescription={
                                editCriterionDescription
                              }
                              editCriterionMaximumScore={
                                editCriterionMaximumScore
                              }

                              suggestedCriterionCode={
                                suggestedCriterionCode
                              }

                              activeMappingCriterion={
                                activeMappingCriterion
                              }

                              selectedMappingTaskIds={
                                selectedMappingTaskIds
                              }
                              isSavingTaskMapping={
                                isSavingTaskMapping
                              }

                              setCriterionFormLevelId={
                                setCriterionFormLevelId
                              }
                              setCriterionCode={
                                setCriterionCode
                              }
                              setCriterionTitle={
                                setCriterionTitle
                              }
                              setCriterionDescription={
                                setCriterionDescription
                              }
                              setCriterionMaximumScore={
                                setCriterionMaximumScore
                              }

                              setEditingCriterionId={
                                setEditingCriterionId
                              }
                              setEditCriterionTitle={
                                setEditCriterionTitle
                              }
                              setEditCriterionDescription={
                                setEditCriterionDescription
                              }
                              setEditCriterionMaximumScore={
                                setEditCriterionMaximumScore
                              }

                              setMappingCriterionId={
                                setMappingCriterionId
                              }
                              setSelectedMappingTaskIds={
                                setSelectedMappingTaskIds
                              }

                              saveCriterion={saveCriterion}

                              openTaskMapping={openTaskMapping}
                              startEditingCriterion={
                                startEditingCriterion
                              }
                              saveCriterionEdit={
                                saveCriterionEdit
                              }
                              removeCriterion={removeCriterion}

                              toggleTaskMappingSelection={
                                toggleTaskMappingSelection
                              }
                              saveTaskMappings={
                                saveTaskMappings
                              }
                            />

                            <AssignmentBandsSection
                              level={level}
                              levelReadOnly={levelReadOnly}

                              levelBands={levelBands}
                              levelCriteria={levelCriteria}
                              bands={bands}

                              bandFormLevelId={bandFormLevelId}
                              bandCriterionId={bandCriterionId}
                              bandCode={bandCode}
                              bandDisplayName={bandDisplayName}
                              bandMinimumPercentage={bandMinimumPercentage}
                              bandMaximumPercentage={bandMaximumPercentage}
                              bandDescriptor={bandDescriptor}
                              bandSequence={bandSequence}

                              isSavingBand={isSavingBand}

                              editingBandId={editingBandId}
                              editBandMinimum={editBandMinimum}
                              editBandMaximum={editBandMaximum}
                              editBandDescriptor={editBandDescriptor}

                              setBandFormLevelId={setBandFormLevelId}
                              setBandCriterionId={setBandCriterionId}
                              setBandCode={setBandCode}
                              setBandDisplayName={setBandDisplayName}
                              setBandMinimumPercentage={
                                setBandMinimumPercentage
                              }
                              setBandMaximumPercentage={
                                setBandMaximumPercentage
                              }
                              setBandDescriptor={setBandDescriptor}
                              setBandSequence={setBandSequence}

                              setEditingBandId={setEditingBandId}
                              setEditBandMinimum={setEditBandMinimum}
                              setEditBandMaximum={setEditBandMaximum}
                              setEditBandDescriptor={setEditBandDescriptor}

                              saveBand={saveBand}
                              startEditingBand={startEditingBand}
                              saveBandEdit={saveBandEdit}
                              removeBand={removeBand}
                            />


                          </article>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </AssignmentWorkspaceShell>
        )}
      </section>

      <AssignmentManagementModals
        assignments={assignments}
        editingAssignmentId={editingAssignmentId}
        deleteAssignmentId={deleteAssignmentId}

        editCode={editCode}
        editMaximumScore={editMaximumScore}
        editMinimumPassScore={editMinimumPassScore}
        editIsSummative={editIsSummative}
        editContributesToFinalMark={editContributesToFinalMark}
        editFinalMarkWeight={editFinalMarkWeight}
        editIsActive={editIsActive}

        isSavingAssignmentEdit={isSavingAssignmentEdit}

        deleteImpact={deleteImpact}
        isCheckingDeleteImpact={isCheckingDeleteImpact}
        isDeletingAssignment={isDeletingAssignment}

        setEditCode={setEditCode}
        setEditMaximumScore={setEditMaximumScore}
        setEditMinimumPassScore={setEditMinimumPassScore}
        setEditIsSummative={setEditIsSummative}
        setEditContributesToFinalMark={setEditContributesToFinalMark}
        setEditFinalMarkWeight={setEditFinalMarkWeight}
        setEditIsActive={setEditIsActive}

        closeAssignmentEdit={closeAssignmentEdit}
        closeAssignmentDelete={closeAssignmentDelete}

        saveAssignmentEdit={saveAssignmentEdit}
        confirmAssignmentDelete={confirmAssignmentDelete}
      />

    </main >
  );
}
