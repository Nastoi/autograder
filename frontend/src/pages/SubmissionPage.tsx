import "../css/SubmissionPage.css";

import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  useNavigate,
  useParams,
} from "react-router";

import {
  getSubmissionContext,
  submitAssignment,
  type SubmissionContext,
} from "../api/submissions";

type SubmissionTrack = "basic" | "advanced";

export function SubmissionPage() {
  const { contextId } = useParams();
  const navigate = useNavigate();

  const [context, setContext] =
    useState<SubmissionContext | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [submissionTrack, setSubmissionTrack] =
    useState<SubmissionTrack | "">("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadContext() {
      if (!contextId) {
        setError("Submission context is missing.");
        setIsLoading(false);
        return;
      }

      try {
        const data = await getSubmissionContext(contextId);
        setContext(data);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load the submission page.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadContext();
  }, [contextId]);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setError("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!submissionTrack) {
      setError("Please select Basic or Advanced.");
      return;
    }

    if (!contextId) {
      setError("Submission context is missing.");
      return;
    }

    if (!selectedFile) {
      setError("Please select a document.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const submission = await submitAssignment(
        contextId,
        selectedFile,
        submissionTrack,
      );

      navigate(`/results/${submission.id}`, {
        replace: true,
      });
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
        <div className="submission-content">
          Loading submission page...
        </div>
      </main>
    );
  }

  if (error && !context) {
    return (
      <main className="submission-page">
        <div className="submission-content">
          <header className="submission-header">
            <h1>Unable to load submission</h1>
          </header>

          <p role="alert" className="error-message">
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (!context) {
    return (
      <main className="submission-page">
        <div className="submission-content">
          Submission context was not found.
        </div>
      </main>
    );
  }

  return (
    <main className="admin-container submission-page">
      <div className="submission-content submission-content-redesign">
        <header className="submission-header submission-header-compact">
          <div>
            <p className="submission-eyebrow">
              Learner Submission
            </p>

            <h1>{context.assignment.title}</h1>

            <p className="submission-intro">
              Select a submission type and upload your completed
              assignment document.
            </p>
          </div>
        </header>

        {/* Submission action first */}
        <form
          onSubmit={handleSubmit}
          className="submission-form submission-form-primary"
        >
          <div className="submission-form-top">
            <div>
              <h2>Submit your assignment</h2>
              <p>
                Accepted formats: DOC, DOCX, PDF, PBIX and ZIP.
              </p>
            </div>
          </div>

          <fieldset className="submission-track-options submission-track-grid">
            <legend>Select submission type</legend>

            <label
              className={
                submissionTrack === "basic"
                  ? "submission-track-card selected"
                  : "submission-track-card"
              }
            >
              <input
                type="radio"
                name="submission_track"
                value="basic"
                checked={submissionTrack === "basic"}
                onChange={() =>
                  setSubmissionTrack("basic")
                }
                disabled={isSubmitting}
                required
              />

              <span>
                <strong>Basic</strong>
                <small>
                  Failed, Foundation or Proficient
                </small>
              </span>
            </label>

            <label
              className={
                submissionTrack === "advanced"
                  ? "submission-track-card selected"
                  : "submission-track-card"
              }
            >
              <input
                type="radio"
                name="submission_track"
                value="advanced"
                checked={submissionTrack === "advanced"}
                onChange={() =>
                  setSubmissionTrack("advanced")
                }
                disabled={isSubmitting}
                required
              />

              <span>
                <strong>Advanced</strong>
                <small>
                  Failed, Proficient or Expert
                </small>
              </span>
            </label>
          </fieldset>

          <div className="submission-upload-row">
            <label
              htmlFor="submitted-file"
              className="file-upload-box file-upload-box-compact"
            >
              <span className="upload-icon" aria-hidden="true">
                ↑
              </span>

              <span className="upload-copy">
                <strong className="upload-title">
                  {selectedFile
                    ? selectedFile.name
                    : "Choose a file to upload"}
                </strong>

                <span className="upload-help">
                  {selectedFile
                    ? "File ready to submit"
                    : "Select the completed assignment from your computer."}
                </span>
              </span>

              <span className="file-button">
                {selectedFile ? "Change file" : "Browse files"}
              </span>
            </label>

            <input
              id="submitted-file"
              name="submitted_file"
              className="file-input"
              type="file"
              accept=".doc,.docx,.pdf,.pbix,.zip"
              onChange={handleFileChange}
              disabled={isSubmitting}
              required
            />

            {selectedFile && (
              <button
                type="button"
                className="remove-file-button"
                onClick={() => setSelectedFile(null)}
                disabled={isSubmitting}
              >
                Remove
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}

          <div className="form-actions submission-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={
                !selectedFile ||
                !submissionTrack ||
                isSubmitting
              }
            >
              {isSubmitting
                ? "Submitting..."
                : "Submit document"}
            </button>
          </div>
        </form>

        {/* Compact context summary below the submission action */}
        <section
          className="assignment-summary assignment-summary-compact"
          aria-label="Assignment details"
        >
          <div className="summary-item">
            <span className="summary-label">Learner</span>
            <strong>{context.learner.name}</strong>
          </div>

          <div className="summary-item">
            <span className="summary-label">Cohort</span>
            <strong>{context.cohort.name}</strong>
          </div>

          <div className="summary-item">
            <span className="summary-label">Module</span>
            <strong>
              {context.module.code} — {context.module.name}
            </strong>
          </div>

          <div className="summary-item">
            <span className="summary-label">Assignment</span>
            <strong>{context.assignment.title}</strong>
          </div>

          <div className="summary-item">
            <span className="summary-label">Maximum score</span>
            <strong>{context.assignment.maximum_score}</strong>
          </div>
        </section>
      </div>
    </main>
  );
}
