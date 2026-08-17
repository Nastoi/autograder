import "../css/SubmissionPage.css";

import {
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
  getMappingSubmissionContext,
  type MappingSubmissionContext,
} from "../api/lms";

import {
  getMappingSubmissionHistory,
  resolveMappingContext,
  submitAssignment,
  type AttemptPolicy,
  type Submission,
} from "../api/submissions";

import { jsPDF } from "jspdf";



type SubmissionTrack = "basic" | "advanced";

export function MappingSubmissionPage() {
  const [attempts, setAttempts] = useState<Submission[]>([]);
  const [attemptPolicy, setAttemptPolicy] = useState<AttemptPolicy | null>(null);
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

  const [isDragging, setIsDragging] =
    useState(false);

  const latestAttempt = attempts[0];
  // const hasNoAttemptsRemaining =
  //   attemptPolicy?.can_submit === false;
  const isWaitingForGrading =
    latestAttempt?.status === "uploaded" ||
    latestAttempt?.status === "processing";
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  const ALLOWED_EXTENSIONS = [
    ".pdf",
    ".zip",
  ];

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      `Score: ${attempt.final_score ?? "—"} / ${attempt.maximum_score ?? "—"}`,
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

    const previousLatestSubmissionId =
      attempts[0]?.id ?? null;

    setError("");
    setNotice("");
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
              latestSubmission.status === "completed"
                ? "Your submission was graded successfully."
                : "Your submission was received successfully. Please refresh the page shortly to view the latest grading result.",
            );

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
      } catch {
        setNotice(
          "Your submission was received successfully. Please refresh the page shortly to view the latest grading result.",
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
              Review your results, previous attempts,
              or submit a new attempt.
            </p>
          </div>
        </header>

        <section
          className="assignment-summary"
          aria-label="Assignment details"
        >
          <div className="summary-item">
            <span className="summary-label">
              Cohort
            </span>

            <strong>
              {context.cohort.code} —{" "}
              {context.cohort.name}
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
              Attempts
            </span>

            {/* <strong>
              {attempts.length === 0
                ? "-"
                : attemptPolicy?.limited_mode
                  ? attemptPolicy.attempts_remaining === 0
                    ? "No attempts remaining"
                    : `${attemptPolicy.attempts_remaining} ${attemptPolicy.attempts_remaining === 1
                      ? "attempt"
                      : "attempts"
                    } remaining`
                  : "Resubmit and try again"}
            </strong> */}
            <strong>
              {attempts.length === 0
                ? "No attempts yet"
                : `${attempts.length} ${attempts.length === 1 ? "attempt" : "attempts"
                }`}
            </strong>
          </div>

          <div className="summary-item summary-item-wide">
            <span className="summary-label">
              Assignment
            </span>

            <strong>
              {context.assignment.code} —{" "}
              {context.assignment.title}
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
            {attempts.length > 0
              ? "Submit a New Attempt"
              : "Submit Your First Attempt"}
          </h2>

          <p>
            Choose the submission track and upload
            your completed assignment.
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
        {isWaitingForGrading
          ? "Waiting for Grading"
          : isSubmitting
            ? "Submitting..."
            : attempts.length > 0
              ? "Submit New Attempt"
              : "Submit Assignment"}


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
                  isWaitingForGrading
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
                  isWaitingForGrading
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
                isWaitingForGrading
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
              isWaitingForGrading
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
                  isWaitingForGrading
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
                isWaitingForGrading
                // hasNoAttemptsRemaining
              }
            >
              {
                // hasNoAttemptsRemaining
                //   ? "No Attempts Remaining"
                //   : 
                isWaitingForGrading
                  ? "Waiting for Grading"
                  : isSubmitting
                    ? "Submitting..."
                    : attempts.length > 0
                      ? "Submit New Attempt"
                      : "Submit Assignment"}
            </button>
          </div>
        </form>
        {attempts.length > 0 && (
          <section className="latest-result">
            <div className="latest-result-heading">
              <div>
                <span className="section-eyebrow">
                  Latest Result
                </span>

                <h2>
                  Attempt {attempts[0].attempt_number}
                </h2>
              </div>

              <span
                className={`attempt-status status-${attempts[0].status}`}
              >
                {attempts[0].status}
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



        {attempts.length > 1 && (
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

                        <strong className="attempt-filename">
                          {attempt.original_filename}
                        </strong>
                      </div>

                      <span
                        className={`attempt-status status-${attempt.status}`}
                      >
                        {attempt.status}
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


      </div>
    </main>
  );
}