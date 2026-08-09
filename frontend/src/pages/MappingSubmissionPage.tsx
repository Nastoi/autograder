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
  type Submission,
} from "../api/submissions";









export function MappingSubmissionPage() {
  const [attempts, setAttempts] = useState<Submission[]>([]);
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

  const [isDragging, setIsDragging] =
    useState(false);

  const latestAttempt = attempts[0];

  const isWaitingForGrading =
    latestAttempt?.status === "uploaded" ||
    latestAttempt?.status === "processing";
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  const ALLOWED_EXTENSIONS = [
    ".doc",
    ".docx",
    ".pdf",
    ".pbix",
    ".zip",
  ];
  type SubmissionTrack = "basic" | "advanced";

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
        setAttempts(attemptData);
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
          const updatedAttempts =
            await getMappingSubmissionHistory(
              mappingId,
            );

          setAttempts(updatedAttempts);
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

    if (!submissionTrack) {
      setError(
        "Please select Basic or Advanced.",
      );
      return;
    }

    if (!selectedFile) {
      setError("Please select a document.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const resolvedContext =
        await resolveMappingContext(mappingId);

      await submitAssignment(
        resolvedContext.context_id,
        selectedFile,
        submissionTrack,
      );

      const updatedAttempts =
        await getMappingSubmissionHistory(mappingId);

      setAttempts(updatedAttempts);

      setSelectedFile(null);
      setSubmissionTrack("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Submission failed.",
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
        "Unsupported file type. Allowed types: DOC, DOCX, PDF, PBIX, ZIP.",
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

          <div className="summary-item summary-item-wide">
            <span className="summary-label">
              Assignment
            </span>

            <strong>
              {context.assignment.code} —{" "}
              {context.assignment.title}
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
        </section>

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

              <span className="attempt-status">
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
                      : attempts[0].final_score !== null
                        ? `${attempts[0].final_score} / ${attempts[0].maximum_score ?? "-"
                        }`
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
                      : attempts[0].achieved_band || "Pending"}
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
                  Feedback
                </span>

                <p>{attempts[0].feedback}</p>
              </div>
            )}

            {attempts[0].status === "error" && (
              <div className="grading-error-message">
                <strong>
                  Grading could not be completed.
                </strong>

                <p>
                  Please submit a new attempt.
                </p>
              </div>
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

                      <span className="attempt-status">
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
                          {attempt.final_score !== null
                            ? `${attempt.final_score} / ${attempt.maximum_score ?? "-"
                            }`
                            : "Pending"}
                        </strong>
                      </div>

                      <div>
                        <span className="attempt-detail-label">Band</span>

                        <strong>
                          {attempt.achieved_band || "Pending"}
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


                  </article>
                ))}
              </div>
            )}
          </section>
        )}


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
                  isWaitingForGrading
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
              isSubmitting || isWaitingForGrading
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
              DOC, DOCX, PDF, PBIX, ZIP — maximum 50 MB.
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
            accept=".doc,.docx,.pdf,.pbix,.zip"
            onChange={handleFileChange}
            disabled={
              isSubmitting ||
              isWaitingForGrading
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
                disabled={isSubmitting}
              >
                Remove
              </button>
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
              }
            >
              {isSubmitting
                ? "Submitting..."
                : attempts.length > 0
                  ? "Submit New Attempt"
                  : "Submit Assignment"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}