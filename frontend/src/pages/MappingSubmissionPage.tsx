import "../css/SubmissionPage.css";
import "../css/SubmissionRecordsPage.css";
import "../css/AssessmentMappings.css";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  useParams,
} from "react-router";

import {
  createInstructorGradeOverride,
  downloadInstructorSubmission,
  getInstructorMappingDashboard,
  syncInstructorMappingDueDate,
  updateInstructorResultVisibility,
  type InstructorMappingAttempt,
  type InstructorMappingDashboard,
  type InstructorMappingLearner,
} from "../api/instructor";

import {
  getMappingSubmissionContext,
  getMappingSubmissionHistory,
  resolveMappingContext,
  submitAssignment,
  type AttemptPolicy,
  type MappingSubmissionContext,
  type Submission,
} from "../api/submissions";


import { jsPDF } from "jspdf";



type SubmissionTrack = "basic" | "advanced";


export function MappingSubmissionPage() {
  const [attempts, setAttempts] = useState<Submission[]>([]);
  const [, setAttemptPolicy] =
    useState<AttemptPolicy | null>(null);
  const { mappingId } = useParams();

  const [context, setContext] =
    useState<MappingSubmissionContext | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [submissionTrack, setSubmissionTrack] =
    useState<SubmissionTrack | "">("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showSubmissionReceivedModal, setShowSubmissionReceivedModal] =
    useState(false);
  const [activeTab, setActiveTab] =
    useState<"submission" | "instructor">("submission");
  const [instructorData, setInstructorData] =
    useState<InstructorMappingDashboard | null>(null);
  const [isLoadingInstructor, setIsLoadingInstructor] = useState(false);
  const [instructorError, setInstructorError] = useState("");
  const [isUpdatingResultVisibility, setIsUpdatingResultVisibility] =
    useState(false);
  const [expandedInstructorLearners, setExpandedInstructorLearners] =
    useState<string[]>([]);
  const [overrideTarget, setOverrideTarget] = useState<{
    learner: InstructorMappingLearner;
    attempt: InstructorMappingAttempt;
  } | null>(null);
  const [overrideScores, setOverrideScores] = useState<Record<string, string>>({});
  const [overrideFeedback, setOverrideFeedback] = useState<Record<string, string>>({});
  const [overrideOverallFeedback, setOverrideOverallFeedback] = useState("");
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState("");

  const [isDragging, setIsDragging] =
    useState(false);

  const latestAttempt = attempts[0];

  const latestAttemptFailed =
    latestAttempt?.status === "completed" &&
    latestAttempt?.achieved_band?.toLowerCase() === "failed";

  // const hasNoAttemptsRemaining =
  //   attemptPolicy?.can_submit === false;
  const isWaitingForGrading =
    latestAttempt?.status === "uploaded" ||
    latestAttempt?.status === "processing";

  const deadlinePassed =
    context?.deadline_passed ?? false;
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  const ALLOWED_EXTENSIONS = [
    ".pdf",
    ".zip",
  ];

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const gradingMessages = [
    "Uploading your file...",
    "Registering your submission...",
    "Preparing background grading...",
  ];

  const [gradingMessageIndex, setGradingMessageIndex] =
    useState(0);

  useEffect(() => {
    if (!isSubmitting) {
      setGradingMessageIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setGradingMessageIndex((current) =>
        (current + 1) % gradingMessages.length,
      );
    }, 3500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isSubmitting]);

  useEffect(() => {
    async function loadMapping() {
      if (!mappingId) {
        setError("Invalid assessment mapping.");
        setIsLoading(false);
        return;
      }

      try {
        const [
          mappingData,
          attemptData,
        ] = await Promise.all([
          getMappingSubmissionContext(mappingId),
          getMappingSubmissionHistory(mappingId),
        ]);

        setContext(mappingData);
        setAttempts(attemptData.submissions);
        setAttemptPolicy(attemptData.attempt_policy);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load assignment.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadMapping();
  }, [mappingId]);

  useEffect(() => {
    if (
      !mappingId ||
      !context?.is_instructor ||
      !context.lms_platform_url ||
      !context.lms_course_id ||
      !context.lms_resource_link_id
    ) {
      return;
    }

    const currentMappingId = mappingId;
    const lmsPlatformUrl = context.lms_platform_url;
    const lmsCourseId = context.lms_course_id;
    const lmsResourceLinkId = context.lms_resource_link_id;
    let cancelled = false;

    async function syncLiveLmsDueDate() {
      try {
        const params = new URLSearchParams({
          course_id: lmsCourseId,
          depth: "all",
          requested_fields: "due",
          all_blocks: "true",
        });

        const blocksResponse = await fetch(
          `${lmsPlatformUrl}/api/courses/v1/blocks/?${params.toString()}`,
          {
            method: "GET",
            credentials: "include",
          },
        );

        if (!blocksResponse.ok) {
          let detail = `LMS Blocks API returned ${blocksResponse.status}.`;

          try {
            const errorData = await blocksResponse.json();
            const developerMessage =
              errorData?.developer_message ??
              errorData?.field_errors?.username?.developer_message;

            if (typeof developerMessage === "string") {
              detail = developerMessage;
            }
          } catch {
            // Keep the status-based message.
          }

          throw new Error(detail);
        }

        const blocksData = (await blocksResponse.json()) as {
          blocks?: Record<
            string,
            {
              id?: string;
              due?: string | null;
            }
          >;
        };

        const exactBlock =
          blocksData.blocks?.[lmsResourceLinkId];

        if (!exactBlock) {
          throw new Error(
            "The LMS response did not contain this LTI assessment block.",
          );
        }

        const synced = await syncInstructorMappingDueDate(
          currentMappingId,
          {
            course_id: lmsCourseId,
            resource_link_id: lmsResourceLinkId,
            due_date: exactBlock.due ?? null,
          },
        );

        if (cancelled) {
          return;
        }

        setContext((current) =>
          current
            ? {
              ...current,
              due_date: synced.due_date,
              deadline_passed: synced.deadline_passed,
            }
            : current,
        );

        setInstructorData((current) =>
          current
            ? {
              ...current,
              mapping: {
                ...current.mapping,
                due_date: synced.due_date,
                deadline_passed: synced.deadline_passed,
              },
            }
            : current,
        );
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        console.warn(
          "Unable to refresh the live LMS due date:",
          caughtError,
        );

      }
    }

    function handleWindowFocus() {
  void syncLiveLmsDueDate();
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") {
    void syncLiveLmsDueDate();
  }
}

  void syncLiveLmsDueDate();

  window.addEventListener(
    "focus",
    handleWindowFocus,
  );

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange,
  );

  return () => {
    cancelled = true;

    window.removeEventListener(
      "focus",
      handleWindowFocus,
    );

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
  };
  }, [
    mappingId,
    context?.is_instructor,
    context?.lms_platform_url,
    context?.lms_course_id,
    context?.lms_resource_link_id,
  ]);

  useEffect(() => {
    if (!mappingId) {
      return;
    }

    const latestAttempt = attempts[0];

    const shouldPoll =
      latestAttempt?.status === "uploaded" ||
      latestAttempt?.status === "processing";

    if (!shouldPoll) {
      return;
    }

    const intervalId = window.setInterval(
      async () => {
        try {
          const updatedHistory =
            await getMappingSubmissionHistory(
              mappingId,
            );

          setAttempts(updatedHistory.submissions);
          setAttemptPolicy(updatedHistory.attempt_policy);
        } catch {
          // Keep the current page state.
          // We don't want a temporary polling
          // failure to replace the whole page.
        }
      },
      5000,
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [mappingId, attempts]);

  useEffect(() => {
    if (
      activeTab !== "instructor" ||
      !context?.is_instructor ||
      !mappingId
    ) {
      return;
    }

    const currentMappingId = mappingId;

    let cancelled = false;

    async function loadInstructorTab() {
      setIsLoadingInstructor(true);

      try {
        const result =
          await getInstructorMappingDashboard(
            currentMappingId,
          );

        if (cancelled) {
          return;
        }

        setInstructorData(result);

        // Keep all learner cards closed initially so the instructor
        // can scan the learner list and open only the learner needed.
        setExpandedInstructorLearners([]);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setInstructorError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load instructor submission records.",
        );
      } finally {
        if (!cancelled) {
          setIsLoadingInstructor(false);
        }
      }
    }

    void loadInstructorTab();

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    context?.is_instructor,
    mappingId,
  ]);

  function downloadFeedbackPdf(attempt: Submission) {
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    const maxWidth = pageWidth - margin * 2;

    let y = 20;

    function addText(
      text: string,
      size = 11,
      bold = false,
      spacing = 6,
    ) {
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");

      const lines = doc.splitTextToSize(
        text || "—",
        maxWidth,
      );

      for (const line of lines) {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }

        doc.text(line, margin, y);
        y += spacing;
      }
    }

    addText("AutoGrad3r Detailed Feedback", 16, true, 8);
    addText(`Assignment: ${attempt.assignment_code}`, 11, true);
    addText(`Attempt: ${attempt.attempt_number}`);
    addText(
      `Score: ${formatScoreOutOf100(
        attempt.final_score,
        attempt.maximum_score,
      )}`,
    );
    addText(`Band: ${attempt.achieved_band || "—"}`);

    y += 4;

    addText("Overall Feedback", 13, true, 8);
    addText(
      attempt.feedback || "No overall feedback provided.",
    );

    y += 6;

    addText("Detailed Criterion Feedback", 13, true, 8);

    attempt.criterion_results.forEach(
      (criterion, index) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        addText(`Criterion ${index + 1}`, 12, true);
        addText(`Awarded marks: ${criterion.awarded_marks}`);

        if (criterion.achievement_band) {
          addText(`Band: ${criterion.achievement_band}`);
        }

        addText(
          criterion.feedback ||
          "No detailed feedback was provided.",
        );

        y += 6;
      },
    );

    doc.save(
      `${attempt.assignment_code}-attempt-${attempt.attempt_number}-feedback.pdf`,
    );
  }


  function formatScoreOutOf100(
    score: string | number | null | undefined,
    maximumScore: string | number | null | undefined,
  ) {
    if (
      score === null ||
      score === undefined ||
      maximumScore === null ||
      maximumScore === undefined
    ) {
      return "—";
    }

    const numericScore = Number(score);
    const numericMaximum = Number(maximumScore);

    if (
      !Number.isFinite(numericScore) ||
      !Number.isFinite(numericMaximum) ||
      numericMaximum <= 0
    ) {
      return "—";
    }

    return `${(
      (numericScore / numericMaximum) *
      100
    ).toFixed(2)} / 100`;
  }


  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size === 0) {
      setSelectedFile(null);
      setError(
        "The selected file is empty. Please choose a valid file.",
      );
      return false;
    }

    validateFile(file);
  }

  function handleDragOver(
    event: DragEvent<HTMLLabelElement>,
  ) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(
    event: DragEvent<HTMLLabelElement>,
  ) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(
    event: DragEvent<HTMLLabelElement>,
  ) {
    event.preventDefault();
    setIsDragging(false);

    const file =
      event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    validateFile(file);
  }



  function formatInstructorDate(value: string | null) {
    if (!value) return "—";

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function formatInstructorResult(
    score: string | null,
    maximumScore: string | null,
  ) {
    if (score === null || maximumScore === null) {
      return "Pending";
    }

    const numericScore = Number(score);
    const numericMaximum = Number(maximumScore);

    if (
      !Number.isFinite(numericScore) ||
      !Number.isFinite(numericMaximum) ||
      numericMaximum <= 0
    ) {
      return "Pending";
    }

    const percentage = (numericScore / numericMaximum) * 100;

    return `${percentage.toFixed(2)} / 100`;
  }

  async function handleResultVisibilityChange(
    showResultToLearner: boolean,
  ) {
    if (!mappingId) {
      setInstructorError("Assessment mapping is missing.");
      return;
    }

    setInstructorError("");
    setIsUpdatingResultVisibility(true);

    try {
      await updateInstructorResultVisibility(
        mappingId,
        showResultToLearner,
      );

      setContext((current) =>
        current
          ? {
            ...current,
            show_result_to_learner: showResultToLearner,
          }
          : current,
      );

      setInstructorData((current) =>
        current
          ? {
            ...current,
            mapping: {
              ...current.mapping,
              show_result_to_learner: showResultToLearner,
            },
          }
          : current,
      );
    } catch (caughtError) {
      setInstructorError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update learner result visibility.",
      );
    } finally {
      setIsUpdatingResultVisibility(false);
    }
  }

  async function handleInstructorSubmissionDownload(
    submissionId: string,
    filename: string,
  ) {
    if (!mappingId) {
      setInstructorError("Assessment mapping is missing.");
      return;
    }

    setInstructorError("");

    try {
      await downloadInstructorSubmission(
        mappingId,
        submissionId,
        filename,
      );
    } catch (caughtError) {
      setInstructorError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to download the learner submission.",
      );
    }
  }



  function getOverrideCriteria(attempt: InstructorMappingAttempt) {
    if (attempt.criterion_results.length > 0) {
      return attempt.criterion_results.map((criterion) => ({
        rubric_criterion: criterion.rubric_criterion,
        criterion_code: criterion.criterion_code,
        criterion_title: criterion.criterion_title,
        maximum_score: criterion.maximum_score,
        awarded_marks: criterion.awarded_marks,
        feedback: criterion.feedback || "",
      }));
    }

    return (attempt.configured_criteria || []).map((criterion) => ({
      ...criterion,
      awarded_marks: "",
      feedback: "",
    }));
  }

  function openInstructorOverride(
    learner: InstructorMappingLearner,
    attempt: InstructorMappingAttempt,
  ) {
    const overrideCriteria = getOverrideCriteria(attempt);

    setOverrideTarget({ learner, attempt });
    setOverrideScores(
      Object.fromEntries(
        overrideCriteria.map((criterion) => [
          criterion.rubric_criterion,
          criterion.awarded_marks,
        ]),
      ),
    );
    setOverrideFeedback(
      Object.fromEntries(
        overrideCriteria.map((criterion) => [
          criterion.rubric_criterion,
          criterion.feedback,
        ]),
      ),
    );
    setOverrideOverallFeedback(attempt.feedback || "");
    setOverrideError("");
  }

  function closeInstructorOverride() {
    if (isSavingOverride) return;
    setOverrideTarget(null);
    setOverrideError("");
  }

  async function handleInstructorOverrideSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!mappingId || !overrideTarget) {
      setOverrideError("Assessment mapping or override attempt is missing.");
      return;
    }

    setOverrideError("");
    setIsSavingOverride(true);

    try {
      await createInstructorGradeOverride(
        mappingId,
        overrideTarget.attempt.id,
        {
          overall_feedback: overrideOverallFeedback,
          criteria: getOverrideCriteria(overrideTarget.attempt).map(
            (criterion) => ({
              rubric_criterion: criterion.rubric_criterion,
              awarded_marks:
                overrideScores[criterion.rubric_criterion] ?? "",
              feedback:
                overrideFeedback[criterion.rubric_criterion] ?? "",
            }),
          ),
        },
      );

      const refreshed = await getInstructorMappingDashboard(mappingId);
      setInstructorData(refreshed);
      setOverrideTarget(null);
    } catch (caughtError) {
      setOverrideError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save the faculty grade override.",
      );
    } finally {
      setIsSavingOverride(false);
    }
  }

  function toggleInstructorLearner(learnerId: string) {
    setExpandedInstructorLearners((current) =>
      current.includes(learnerId)
        ? current.filter((id) => id !== learnerId)
        : [...current, learnerId],
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!mappingId) {
      setError("Assessment mapping is missing.");
      return;
    }

    if (!context) {
      setError("Assignment context is not available.");
      return;
    }

    if (!submissionTrack) {
      setError("Please select Basic or Advanced.");
      return;
    }

    if (!selectedFile) {
      setError("Please select a document.");
      return;
    }

    if (context.deadline_passed) {
      setError(
        "The submission deadline has passed. This assessment is no longer accepting submissions.",
      );
      return;
    }

    const previousLatestSubmissionId =
      attempts[0]?.id ?? null;

    setError("");
    setNotice("");
    setShowSubmissionReceivedModal(false);
    setIsSubmitting(true);

    try {
      const selectedAssignmentLevel =
        context.assignment_levels.find(
          (level) =>
            level.level_code === submissionTrack,
        );

      if (!selectedAssignmentLevel) {
        throw new Error(
          `Unable to find the ${submissionTrack} assignment level.`,
        );
      }

      const resolvedContext =
        await resolveMappingContext(
          mappingId,
          selectedAssignmentLevel.id,
        );

      try {
        await submitAssignment(
          resolvedContext.context_id,
          selectedFile,
          submissionTrack,
        );
        setShowSubmissionReceivedModal(true);
      } catch (submissionError) {
        try {
          const verificationHistory =
            await getMappingSubmissionHistory(mappingId);

          setAttempts(verificationHistory.submissions);
          setAttemptPolicy(
            verificationHistory.attempt_policy,
          );

          const latestSubmission =
            verificationHistory.submissions[0];

          const newSubmissionExists =
            latestSubmission &&
            latestSubmission.id !==
            previousLatestSubmissionId;

          if (newSubmissionExists) {
            setSelectedFile(null);
            setSubmissionTrack("");

            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }

            setNotice(
              "Your submission has been received and is being reviewed. Your result and feedback will be available soon.",
            );
            setShowSubmissionReceivedModal(true);

            return;
          }
        } catch {
          // Verification also failed.
        }

        throw submissionError;
      }

      try {
        const updatedHistory =
          await getMappingSubmissionHistory(mappingId);

        setAttempts(updatedHistory.submissions);
        setAttemptPolicy(
          updatedHistory.attempt_policy,
        );

        const latestSubmission =
          updatedHistory.submissions[0];

        if (
          latestSubmission?.status === "uploaded" ||
          latestSubmission?.status === "processing"
        ) {
          setNotice(
            "Your submission has been received and is being reviewed. Your result and feedback will be available soon.",
          );
        }
      } catch {
        setNotice(
          "Your submission has been received and is being reviewed. Your result and feedback will be available soon.",
        );
      }

      setSelectedFile(null);
      setSubmissionTrack("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "We could not submit your assignment. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="submission-page">
        Loading submission page...
      </main>
    );
  }

  if (error && !context) {
    return (
      <main className="submission-page">
        <div className="submission-content">
          <h1>Unable to load assignment</h1>

          <p
            role="alert"
            className="error-message"
          >
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (!context) {
    return (
      <main className="submission-page">
        Assignment was not found.
      </main>
    );
  }

  function validateFile(file: File): boolean {
    const extension =
      `.${file.name.split(".").pop()?.toLowerCase()}`;

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setSelectedFile(null);
      setError(
        "Unsupported file type. Please upload a PDF or ZIP containing one PDF.",
      );
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setError(
        "The file cannot exceed 50 MB.",
      );
      return false;
    }

    setSelectedFile(file);
    setError("");
    return true;
  }

  function getStatusLabel(status: Submission["status"]) {
    if (status === "completed" || status === "graded") {
      return "Graded";
    }

    if (status === "error" || status === "failed") {
      return "Not Graded";
    }

    if (status === "uploaded" || status === "processing") {
      return "Processing";
    }

    if (status === "manual_review") {
      return "Manual Review";
    }

    return status;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    const kilobytes = bytes / 1024;

    if (kilobytes < 1024) {
      return `${kilobytes.toFixed(1)} KB`;
    }

    const megabytes = kilobytes / 1024;

    return `${megabytes.toFixed(1)} MB`;
  }

  return (
    <main className="submission-page">
      <div className="submission-content">
        <header className="submission-header">
          <div>
            <p className="submission-eyebrow">
              Learner Submission
            </p>

            <h1>Assignment Submission</h1>

            <p className="submission-intro">
              Submit your completed assignment and check its submission status.
            </p>
          </div>
        </header>

        {context.is_instructor && (
          <div
            className="workspace-tabs"
            style={{ marginBottom: "24px" }}
          >
            <button
              type="button"
              className={
                activeTab === "submission"
                  ? "workspace-tab active"
                  : "workspace-tab"
              }
              onClick={() => setActiveTab("submission")}
            >
              Submission
            </button>

            <button
              type="button"
              className={
                activeTab === "instructor"
                  ? "workspace-tab active"
                  : "workspace-tab"
              }
              onClick={() => setActiveTab("instructor")}
            >
              Instructor
            </button>
          </div>
        )}

        {activeTab === "submission" && (
          <>
            <section
              className="assignment-summary"
              aria-label="Assignment details"
            >
              <div className="summary-item">
                <span className="summary-label">
                  Cohort
                </span>

                <strong>
                  {context.cohort.code}
                </strong>
              </div>

              <div className="summary-item">
                <span className="summary-label">
                  Assignment
                </span>

                <strong>
                  {context.assignment.code}
                </strong>
              </div>

              <div className="summary-item">
                <span className="summary-label">
                  Maximum score
                </span>

                <strong>
                  {context.assignment.maximum_score}
                </strong>
              </div>

              <div className="summary-item">
                <span className="summary-label">
                  Due date
                </span>

                <strong>
                  {context.due_date
                    ? new Date(context.due_date).toLocaleString()
                    : "No due date"}
                </strong>

                <small className="table-subtext">
                  Synced from LMS
                </small>
              </div>

              <div className="summary-item">
                <span className="summary-label">
                  Attempts
                </span>

                <strong>
                  {attempts.length === 0
                    ? "No attempts yet"
                    : `${attempts.length} ${attempts.length === 1 ? "attempt" : "attempts"}`}
                </strong>
              </div>
            </section>

            {/* {attemptPolicy?.limited_mode && (
          <div className="grading-wait-message">
            <strong>
              {attemptPolicy.attempts_remaining === 0
                ? "No attempts remaining"
                : `${attemptPolicy.attempts_remaining} ${attemptPolicy.attempts_remaining === 1
                  ? "attempt"
                  : "attempts"
                } remaining`}
            </strong>

            <p>
              You have used{" "}
              {attemptPolicy.attempts_used} of 3 attempts.
            </p>
          </div>
        )} */}



            <div className="new-attempt-heading">
              <h2>
                {!context.show_result_to_learner
                  ? "Submit Assignment"
                  : latestAttemptFailed
                    ? "Resubmit Assignment"
                    : attempts.length > 0
                      ? "Submit a New Attempt"
                      : "Submit Your First Attempt"}
              </h2>

              <p>
                {context.show_result_to_learner && latestAttemptFailed
                  ? "Your latest graded attempt was Failed. Review the feedback, make your changes, then upload a revised submission."
                  : "Choose the submission track and upload your completed assignment."}
              </p>
            </div>
            {/* 
        {isWaitingForGrading && (
          <div className="grading-wait-message">
            <strong>
              Your latest attempt is still being graded.
            </strong>

            <p>
              You can submit another attempt after
              grading is complete.
            </p>
          </div>
        )} */}
            {/* {isWaitingForGrading
              ? "Waiting for Grading"
              : isSubmitting
                ? "Submitting..."
                : attempts.length > 0
                  ? "Submit New Attempt"
                  : "Submit Assignment"} */}


            {context.show_result_to_learner && latestAttemptFailed && (
              <div className="grading-wait-message">
                <strong>
                  Your latest result is Failed.
                </strong>

                <p>
                  You may resubmit after reviewing the feedback below.
                </p>
              </div>
            )}

            {deadlinePassed && (
              <div className="grading-wait-message">
                <strong>Submission deadline has passed.</strong>
                <p>
                  This assessment is no longer accepting submissions.
                </p>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="submission-form"
            >
              <fieldset className="submission-track-options">
                <legend>
                  Select submission type
                </legend>

                <label>
                  <input
                    type="radio"
                    name="submission_track"
                    value="basic"
                    checked={
                      submissionTrack === "basic"
                    }
                    onChange={() =>
                      setSubmissionTrack("basic")
                    }
                    disabled={
                      isSubmitting ||
                      isWaitingForGrading ||
                      deadlinePassed
                      // hasNoAttemptsRemaining
                    }
                    required
                  />
                  Basic
                </label>

                <p>
                  Outcome can be Failed,
                  Foundation, or Proficient.
                </p>

                <label>
                  <input
                    type="radio"
                    name="submission_track"
                    value="advanced"
                    checked={
                      submissionTrack === "advanced"
                    }
                    onChange={() =>
                      setSubmissionTrack("advanced")
                    }
                    disabled={
                      isSubmitting ||
                      isWaitingForGrading ||
                      deadlinePassed
                      // hasNoAttemptsRemaining
                    }
                    required
                  />
                  Advanced
                </label>

                <p>
                  Outcome can be Failed,
                  Proficient, or Expert.
                </p>
              </fieldset>

              <label
                htmlFor="submitted-file"
                className={[
                  "file-upload-box",
                  isDragging
                    ? "file-upload-box-dragging"
                    : "",
                  isSubmitting ||
                    isWaitingForGrading ||
                    deadlinePassed
                    // hasNoAttemptsRemaining
                    ? "file-upload-box-disabled"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <span
                  className="upload-icon"
                  aria-hidden="true"
                >
                  ↑
                </span>

                <span className="upload-title">
                  Drag and drop your file here
                </span>

                <span className="upload-help">
                  or browse your computer.
                  PDF or ZIP containing one PDF — maximum 50 MB.
                </span>

                <span className="file-button">
                  Browse files
                </span>
              </label>

              <input
                id="submitted-file"
                name="submitted_file"
                className="file-input"
                type="file"
                accept=".pdf,.zip"
                onChange={handleFileChange}
                disabled={
                  isSubmitting ||
                  isWaitingForGrading ||
                  deadlinePassed
                  // hasNoAttemptsRemaining
                }
                ref={fileInputRef}
                required
              />

              {selectedFile && (
                <div className="selected-file">
                  <div className="selected-file-details">
                    <span className="selected-file-label">
                      Selected file
                    </span>

                    <strong className="selected-file-name">
                      {selectedFile.name}
                    </strong>

                    <span className="selected-file-size">
                      {formatFileSize(selectedFile.size)}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="remove-file-button"
                    onClick={() => {
                      setSelectedFile(null);
                      setError("");

                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    disabled={isSubmitting ||
                      isWaitingForGrading ||
                      deadlinePassed
                      // hasNoAttemptsRemaining
                    }
                  >
                    Remove
                  </button>
                </div>
              )}

              {notice && (
                <div
                  role="status"
                  className="submission-notice"
                >
                  {notice}
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="error-message"
                >
                  {error}
                </p>
              )}

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    !selectedFile ||
                    !submissionTrack ||
                    isSubmitting ||
                    isWaitingForGrading ||
                    deadlinePassed
                    // hasNoAttemptsRemaining
                  }
                >
                  {
                    // hasNoAttemptsRemaining
                    //   ? "No Attempts Remaining"
                    //   : 
                    deadlinePassed
                      ? "Deadline Passed"
                      : isWaitingForGrading
                        ? "Waiting for Grading"
                        : isSubmitting
                          ? "Submitting..."
                          : !context.show_result_to_learner
                            ? "Submit Assignment"
                            : latestAttemptFailed
                              ? "Resubmit Assignment"
                              : attempts.length > 0
                                ? "Submit New Attempt"
                                : "Submit Assignment"}
                </button>
              </div>
            </form>

            {!context.show_result_to_learner && attempts.length > 0 && (
              <div className="grading-wait-message">
                <strong>Submission received.</strong>
                <p>
                  Your submission has been received and is being reviewed.
                  Your result and feedback will be available soon.
                </p>
              </div>
            )}

            {context.show_result_to_learner && attempts.length > 0 && (
              <section className="latest-result">
                <div className="latest-result-heading">
                  <div>
                    <span className="section-eyebrow">
                      Latest Result
                    </span>

                    <h2>
                      Attempt {attempts[0].attempt_number}
                    </h2>

                    {attempts[0].is_manual_override && (
                      <span className="faculty-override-label learner-manual-grade-pill">
                        Manually reviewed by {attempts[0].manual_override_by || "faculty"}
                      </span>
                    )}
                  </div>

                  <span
                    className={`attempt-status status-${attempts[0].status}`}
                  >
                    {getStatusLabel(attempts[0].status)}
                  </span>
                </div>

                <div className="latest-result-file">
                  <span>Submitted file</span>

                  <strong>
                    {attempts[0].original_filename}
                  </strong>
                </div>

                <div className="attempt-details">
                  <div>
                    <span className="attempt-detail-label">
                      Track
                    </span>

                    <strong className="attempt-detail-value">
                      {attempts[0].submission_track === "basic"
                        ? "Basic"
                        : "Advanced"}
                    </strong>
                  </div>

                  <div>
                    <span className="attempt-detail-label">
                      Score
                    </span>

                    <strong className="attempt-detail-value">
                      {attempts[0].status === "error"
                        ? "Unavailable"
                        : attempts[0].status === "uploaded" ||
                          attempts[0].status === "processing"
                          ? "Processing"
                          : attempts[0].final_score !== null &&
                            attempts[0].maximum_score !== null &&
                            Number(attempts[0].maximum_score) > 0
                            ? `${(
                              (Number(attempts[0].final_score) /
                                Number(attempts[0].maximum_score)) *
                              100
                            ).toFixed(2)} / 100`
                            : "Pending"}
                    </strong>
                  </div>

                  <div>
                    <span className="attempt-detail-label">
                      Band
                    </span>

                    <strong className="attempt-detail-value">
                      {attempts[0].status === "error"
                        ? "Not graded"
                        : attempts[0].status === "uploaded" ||
                          attempts[0].status === "processing"
                          ? "Processing"
                          : attempts[0].achieved_band
                            ? attempts[0].achieved_band.charAt(0).toUpperCase() +
                            attempts[0].achieved_band.slice(1)
                            : "Pending"}
                    </strong>
                  </div>

                  <div>
                    <span className="attempt-detail-label">
                      Submitted
                    </span>

                    <strong className="attempt-detail-value">
                      {new Date(
                        attempts[0].submitted_at,
                      ).toLocaleString()}
                    </strong>
                  </div>
                </div>

                {attempts[0].feedback && (
                  <div className="latest-feedback">
                    <span className="attempt-detail-label">
                      Overall Feedback
                    </span>

                    <p>{attempts[0].feedback}</p>
                  </div>
                )}

                {attempts[0].status === "completed" &&
                  attempts[0].criterion_results.length > 0 && (
                    <details className="latest-feedback detailed-feedback-collapse">
                      <summary>
                        Detailed Feedback
                      </summary>

                      <div className="detailed-feedback-content">
                        {attempts[0].criterion_results.map(
                          (criterion, index) => (
                            <div
                              key={criterion.id}
                              className="criterion-feedback-item"
                            >
                              <div className="criterion-feedback-header">
                                <strong>
                                  Criterion {index + 1}
                                </strong>

                                <span>
                                  {criterion.awarded_marks} marks
                                </span>
                              </div>

                              {criterion.achievement_band && (
                                <div className="criterion-feedback-band">
                                  {criterion.achievement_band}
                                </div>
                              )}

                              <p className="criterion-feedback-text">
                                {criterion.feedback}
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    </details>
                  )}

                {attempts[0].status === "completed" && (
                  <button
                    type="button"
                    className="btn-primary feedback-download-btn"
                    onClick={() =>
                      downloadFeedbackPdf(attempts[0])
                    }
                  >
                    Download Detailed Feedback PDF
                  </button>
                )}

                {attempts[0].status === "manual_review" && (
                  <div className="grading-review-message">
                    <strong>
                      Manual review required.
                    </strong>

                    <p>
                      Your submission is waiting for review.
                    </p>
                  </div>
                )}
              </section>
            )}



            {context.show_result_to_learner && attempts.length > 1 && (
              <section
                className="submission-history"
                aria-label="Previous submission attempts"
              >
                <div className="submission-history-header">
                  <div>
                    <h2>Previous Attempts</h2>

                    <p>
                      Review your earlier submissions and grading results.
                    </p>
                  </div>
                </div>

                {attempts.length === 0 ? (
                  <p className="submission-history-empty">
                    No previous attempts yet.
                  </p>
                ) : (
                  <div className="submission-history-list">
                    {attempts.slice(1).map((attempt) => (
                      <article
                        key={attempt.id}
                        className="submission-attempt-card"
                      >
                        <div className="attempt-card-header">
                          <div>
                            <span className="attempt-number">
                              Attempt {attempt.attempt_number}
                            </span>

                            {attempt.is_manual_override && (
                              <span className="faculty-override-label learner-manual-grade-pill">
                                Manually reviewed by {attempt.manual_override_by || "faculty"}
                              </span>
                            )}

                            <strong className="attempt-filename">
                              {attempt.original_filename}
                            </strong>
                          </div>

                          <span
                            className={`attempt-status status-${attempt.status}`}
                          >
                            {getStatusLabel(attempt.status)}
                          </span>
                        </div>

                        <div className="attempt-details">


                          <div>
                            <span className="attempt-detail-label">
                              Track
                            </span>

                            <strong className="attempt-detail-value">
                              {attempt.submission_track === "basic"
                                ? "Basic"
                                : "Advanced"}
                            </strong>
                          </div>

                          <div>
                            <span className="attempt-detail-label">Score</span>

                            <strong>
                              {attempt.status === "error"
                                ? "Unavailable"
                                : attempt.status === "uploaded" ||
                                  attempt.status === "processing"
                                  ? "Processing"
                                  : attempt.final_score !== null &&
                                    attempt.maximum_score !== null &&
                                    Number(attempt.maximum_score) > 0
                                    ? `${(
                                      (Number(attempt.final_score) /
                                        Number(attempt.maximum_score)) *
                                      100
                                    ).toFixed(2)} / 100`
                                    : "Pending"}
                            </strong>
                          </div>

                          <div>
                            <span className="attempt-detail-label">Band</span>

                            <strong>
                              {attempt.status === "error"
                                ? "Not graded"
                                : attempt.status === "uploaded" ||
                                  attempt.status === "processing"
                                  ? "Processing"
                                  : attempt.achieved_band || "Pending"}
                            </strong>
                          </div>

                          <div>
                            <span className="attempt-detail-label" >Submitted</span>

                            <strong>
                              {new Date(
                                attempt.submitted_at,
                              ).toLocaleString()}
                            </strong>
                          </div>
                        </div>
                        {attempt.feedback && (
                          <div className="latest-feedback">
                            <span className="attempt-detail-label">
                              Feedback
                            </span>

                            <p>{attempt.feedback}</p>
                          </div>
                        )}


                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

          </>
        )}

        {context.is_instructor && activeTab === "instructor" && (
          <section>
            {isLoadingInstructor ? (
              <div className="content-card" style={{ padding: "24px" }}>
                Loading instructor submission records...
              </div>
            ) : (
              <>
                {instructorError && (
                  <p role="alert" className="error-message">
                    {instructorError}
                  </p>
                )}

                <div
                  className="content-card"
                  style={{
                    padding: "18px 20px",
                    marginBottom: "20px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      cursor: isUpdatingResultVisibility
                        ? "default"
                        : "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={context.show_result_to_learner}
                      onChange={(event) =>
                        void handleResultVisibilityChange(
                          event.target.checked,
                        )
                      }
                      disabled={isUpdatingResultVisibility}
                    />

                    <strong>
                      Show grading result to learner
                    </strong>
                  </label>

                  <p
                    className="table-subtext"
                    style={{ marginTop: "6px" }}
                  >
                    When enabled, learners can view their grading result
                    and feedback for this assignment.
                  </p>
                </div>

                <section className="submission-record-metrics">
                  <div className="submission-record-metric">
                    <span>Learners submitted</span>
                    <strong>
                      {instructorData?.learners.length ?? 0}
                    </strong>
                  </div>

                  <div className="submission-record-metric">
                    <span>Total attempts</span>
                    <strong>
                      {instructorData?.learners.reduce(
                        (total, learner) =>
                          total + learner.attempts.length,
                        0,
                      ) ?? 0}
                    </strong>
                  </div>

                  <div className="submission-record-metric">
                    <span>LMS due date</span>
                    <strong>
                      {formatInstructorDate(
                        instructorData?.mapping.due_date ?? null,
                      )}
                    </strong>
                  </div>


                </section>

                <section className="submission-record-list">
                  {!instructorData ||
                    instructorData.learners.length === 0 ? (
                    <div className="empty-state">
                      No learner submissions yet.
                    </div>
                  ) : (
                    instructorData.learners.map((learner) => {
                      const open =
                        expandedInstructorLearners.includes(
                          learner.id,
                        );

                      return (
                        <article
                          key={learner.id}
                          className="submission-cohort-card content-card"
                        >
                          <button
                            type="button"
                            className="submission-learner-heading"
                            onClick={() =>
                              toggleInstructorLearner(learner.id)
                            }
                          >
                            <span className="submission-heading-icon">
                              {open ? "▼" : "▶"}
                            </span>

                            <span className="submission-learner-identity">
                              <strong>
                                {learner.name || learner.learner_id}
                              </strong>
                              {learner.email && (
                                <span>{learner.email}</span>
                              )}
                              <small>{learner.learner_id}</small>
                            </span>

                            <span className="submission-attempt-count">
                              {learner.attempts.length} attempt
                              {learner.attempts.length === 1
                                ? ""
                                : "s"}
                            </span>
                          </button>

                          {open && (
                            <div className="submission-attempt-table-wrap">
                              <table className="submission-attempt-table">
                                <thead>
                                  <tr>
                                    <th>Attempt</th>
                                    <th>Path</th>
                                    <th>Status</th>
                                    <th>Result</th>
                                    <th>Band</th>
                                    <th>Submitted</th>
                                    <th>Submission</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {learner.attempts.map((attempt, attemptIndex) => (
                                    <Fragment key={attempt.id}>
                                      <tr>
                                        <td>#{attempt.attempt_number}</td>
                                        <td>
                                          <span className="submission-level-pill">
                                            {attempt.level_name ||
                                              attempt.level_code}
                                          </span>
                                          {attempt.is_manual_override && (
                                            <span className="faculty-override-label">
                                              Manually reviewed by {attempt.manual_override_by || "faculty"}
                                            </span>
                                          )}
                                        </td>
                                        <td>{attempt.status_display}</td>
                                        <td>
                                          <strong>
                                            {formatInstructorResult(
                                              attempt.final_score,
                                              attempt.maximum_score,
                                            )}
                                          </strong>
                                        </td>
                                        <td>
                                          {attempt.achieved_band
                                            ? attempt.achieved_band.charAt(0).toUpperCase() +
                                            attempt.achieved_band.slice(1)
                                            : "Pending"}
                                        </td>
                                        <td>
                                          {formatInstructorDate(
                                            attempt.submitted_at,
                                          )}
                                        </td>
                                        <td>
                                          {attemptIndex === 0 ? (
                                            <div className="instructor-attempt-actions">
                                              {attempt.has_submitted_file && (
                                                <button
                                                  type="button"
                                                  className="btn-action"
                                                  onClick={() =>
                                                    void handleInstructorSubmissionDownload(
                                                      attempt.id,
                                                      attempt.original_filename,
                                                    )
                                                  }
                                                >
                                                  Download
                                                </button>
                                              )}

                                              {(
                                                attempt.criterion_results.length > 0 ||
                                                (attempt.configured_criteria?.length ?? 0) > 0
                                              ) && (
                                                  <button
                                                    type="button"
                                                    className="btn-action"
                                                    onClick={() =>
                                                      openInstructorOverride(
                                                        learner,
                                                        attempt,
                                                      )
                                                    }
                                                  >
                                                    {attempt.status === "completed"
                                                      ? "Override"
                                                      : "Manual Review"}
                                                  </button>
                                                )}
                                            </div>
                                          ) : (
                                            <span>—</span>
                                          )}
                                        </td>
                                      </tr>

                                      <tr className="submission-feedback-row">
                                        <td colSpan={7}>
                                          <div className="submission-feedback">
                                            <span>Overall Feedback</span>
                                            <p>
                                              {attempt.feedback ||
                                                "No feedback available."}
                                            </p>

                                            {attempt.criterion_results.length >
                                              0 && (
                                                <details>
                                                  <summary>
                                                    Detailed Feedback
                                                  </summary>
                                                  <div
                                                    style={{
                                                      marginTop: "12px",
                                                    }}
                                                  >
                                                    {attempt.criterion_results.map(
                                                      (
                                                        criterion,
                                                        index,
                                                      ) => (
                                                        <div
                                                          key={criterion.id}
                                                          style={{
                                                            marginBottom:
                                                              "14px",
                                                          }}
                                                        >
                                                          <div className="criterion-feedback-header">
                                                            <strong>
                                                              Criterion{" "}
                                                              {index + 1}
                                                            </strong>
                                                            <span>
                                                              {criterion.awarded_marks} /{" "}
                                                              {criterion.maximum_score}
                                                            </span>
                                                          </div>
                                                          {criterion.achievement_band && (
                                                            <div className="criterion-feedback-band">
                                                              {criterion.achievement_band
                                                                .charAt(0)
                                                                .toUpperCase() +
                                                                criterion.achievement_band.slice(1)}
                                                            </div>
                                                          )}
                                                          <p>
                                                            {criterion.feedback ||
                                                              "No detailed feedback available."}
                                                          </p>
                                                        </div>
                                                      ),
                                                    )}
                                                  </div>
                                                </details>
                                              )}

                                            {attempt.grading_audit && (
                                              <details>
                                                <summary>AI Grading Details</summary>
                                                <div style={{ marginTop: "12px" }}>
                                                  <p>
                                                    <strong>Audit status:</strong>{" "}
                                                    {attempt.grading_audit.status}
                                                  </p>
                                                  <p>
                                                    <strong>Model:</strong>{" "}
                                                    {attempt.grading_audit.model_name || "—"}
                                                  </p>
                                                  <p>
                                                    <strong>Grader version:</strong>{" "}
                                                    {attempt.grading_audit.grader_version || "—"}
                                                  </p>

                                                  {attempt.grading_audit.error_message && (
                                                    <p className="error-message">
                                                      {attempt.grading_audit.error_code
                                                        ? `${attempt.grading_audit.error_code}: `
                                                        : ""}
                                                      {attempt.grading_audit.error_message}
                                                    </p>
                                                  )}

                                                  {attempt.grading_audit.criterion_evaluations.map(
                                                    (evaluation) => (
                                                      <div
                                                        key={`${evaluation.task_code}:${evaluation.rubric_criterion_id}`}
                                                        style={{ marginBottom: "16px" }}
                                                      >
                                                        <strong>{evaluation.task_code}</strong>
                                                        <div>
                                                          AI evaluation:{" "}
                                                          {Number(evaluation.score_percentage).toFixed(2)}%
                                                        </div>
                                                        <div>
                                                          Weight:{" "}
                                                          {Number(evaluation.inferred_weight).toFixed(2)}%
                                                        </div>
                                                        <div>
                                                          Earned contribution:{" "}
                                                          {Number(evaluation.earned_points).toFixed(2)}
                                                        </div>
                                                        <div>
                                                          Evidence pages:{" "}
                                                          {evaluation.mapped_page_numbers.length
                                                            ? evaluation.mapped_page_numbers.join(", ")
                                                            : "No mapped pages"}
                                                        </div>
                                                        <div>
                                                          Mapping confidence:{" "}
                                                          {Number(
                                                            evaluation.mapping_confidence,
                                                          ).toFixed(2)}
                                                        </div>
                                                        {evaluation.mapping_justification && (
                                                          <p>
                                                            <strong>Evidence mapping:</strong>{" "}
                                                            {evaluation.mapping_justification}
                                                          </p>
                                                        )}
                                                        <p>{evaluation.feedback}</p>
                                                      </div>
                                                    ),
                                                  )}

                                                  <p>
                                                    <strong>Calculated total:</strong>{" "}
                                                    {attempt.grading_audit.scoring_snapshot
                                                      .total_earned_points ?? "—"}{" "}
                                                    /{" "}
                                                    {attempt.grading_audit.scoring_snapshot
                                                      .total_max_possible_points ?? "—"}
                                                    {" "}
                                                    {attempt.grading_audit.scoring_snapshot
                                                      .overall_percentage !== undefined
                                                      ? `(${Number(
                                                        attempt.grading_audit.scoring_snapshot
                                                          .overall_percentage,
                                                      ).toFixed(2)}%)`
                                                      : ""}
                                                  </p>
                                                </div>
                                              </details>
                                            )}


                                          </div>
                                        </td>
                                      </tr>
                                    </Fragment>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </section>
              </>
            )}
          </section>
        )}


      </div>
      {overrideTarget && (
        <div
          className="grading-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="faculty-override-title"
        >
          <form
            className="faculty-override-modal"
            onSubmit={handleInstructorOverrideSubmit}
          >
            <div className="faculty-override-header">
              <div>
                <p className="submission-eyebrow">Faculty Review</p>
                <h2 id="faculty-override-title">Manual Grade Override</h2>
                <p>
                  {overrideTarget.learner.name ||
                    overrideTarget.learner.learner_id}
                  {" · "}Attempt #{overrideTarget.attempt.attempt_number}
                  {" → "}new Attempt #{overrideTarget.attempt.attempt_number + 1}
                </p>
              </div>
              <button
                type="button"
                className="faculty-override-close"
                onClick={closeInstructorOverride}
                disabled={isSavingOverride}
                aria-label="Close manual grade override"
              >
                ×
              </button>
            </div>

            <div className="faculty-override-summary">
              <span>Current result</span>
              <strong>
                {formatInstructorResult(
                  overrideTarget.attempt.final_score,
                  overrideTarget.attempt.maximum_score,
                )}
              </strong>
              <span>Current band</span>
              <strong>
                {overrideTarget.attempt.achieved_band
                  ? overrideTarget.attempt.achieved_band.charAt(0).toUpperCase() +
                  overrideTarget.attempt.achieved_band.slice(1)
                  : "—"}
              </strong>
            </div>

            <div className="faculty-override-body">
              {getOverrideCriteria(overrideTarget.attempt).map(
                (criterion, index) => (
                  <section
                    className="faculty-override-criterion"
                    key={criterion.rubric_criterion}
                  >
                    <div className="faculty-override-criterion-heading">
                      <div>
                        <strong>
                          {criterion.criterion_code || `Criterion ${index + 1}`}
                        </strong>
                        <span>
                          {criterion.criterion_title || `Criterion ${index + 1}`}
                        </span>
                      </div>
                      <span>Max {criterion.maximum_score}</span>
                    </div>

                    <label>
                      New score
                      <input
                        type="number"
                        min="0"
                        max={criterion.maximum_score}
                        step="0.01"
                        value={
                          overrideScores[criterion.rubric_criterion] ?? ""
                        }
                        onChange={(event) =>
                          setOverrideScores((current) => ({
                            ...current,
                            [criterion.rubric_criterion]: event.target.value,
                          }))
                        }
                        disabled={isSavingOverride}
                        required
                      />
                    </label>

                    <label>
                      Criterion feedback
                      <textarea
                        value={
                          overrideFeedback[criterion.rubric_criterion] ?? ""
                        }
                        onChange={(event) =>
                          setOverrideFeedback((current) => ({
                            ...current,
                            [criterion.rubric_criterion]: event.target.value,
                          }))
                        }
                        disabled={isSavingOverride}
                        required
                      />
                    </label>
                  </section>
                ),
              )}

              <label className="faculty-override-overall">
                Overall feedback
                <textarea
                  value={overrideOverallFeedback}
                  onChange={(event) =>
                    setOverrideOverallFeedback(event.target.value)
                  }
                  disabled={isSavingOverride}
                  required
                />
              </label>

              {overrideError && (
                <p role="alert" className="error-message">
                  {overrideError}
                </p>
              )}
            </div>

            <div className="faculty-override-actions">
              <button
                type="button"
                className="btn-action"
                onClick={closeInstructorOverride}
                disabled={isSavingOverride}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSavingOverride}
              >
                {isSavingOverride ? "Saving Override..." : "Submit Override"}
              </button>
            </div>
          </form>
        </div>
      )}
      {isSubmitting && (
        <div
          className="grading-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="grading-modal-title"
        >
          <div className="grading-modal">
            <div
              className="grading-spinner"
              aria-hidden="true"
            />

            <h2 id="grading-modal-title">
              Submitting your assignment
            </h2>

            <p className="grading-progress-message">
              {gradingMessages[gradingMessageIndex]}
            </p>

            <p className="grading-modal-description">
              Your file is being uploaded and registered.
              Grading will continue in the background once the
              submission is accepted.
            </p>

            <p className="grading-modal-note">
              Please keep this page open until the upload is
              accepted. After that, you may leave and return later.
            </p>
          </div>
        </div>
      )}
      {!isSubmitting && showSubmissionReceivedModal && (
        <div
          className="grading-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submission-received-modal-title"
        >
          <div className="grading-modal">
            <h2 id="submission-received-modal-title">
              Submission received
            </h2>

            <p className="grading-modal-description">
              Your submission was received successfully.
              Your work is being reviewed.
            </p>

            <p className="grading-modal-note">
              You may leave this page. Your result and feedback
              will be available soon.
            </p>

            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                setShowSubmissionReceivedModal(false)
              }
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </main>
  );
}