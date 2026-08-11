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
      <div className="admin-header">
        <h1>Submit Assignment</h1>
      </div>

      <div className="submission-content">
        <header className="submission-header">
          <div>
            <p className="submission-eyebrow">
              Learner Submission
            </p>

            <h1>Submit Assignment</h1>

            <p className="submission-intro">
              Review your assignment details and upload the
              required document.
            </p>
          </div>

        </header>

        <section
          className="assignment-summary"
          aria-label="Assignment details"
        >
          <div className="summary-item">
            <span className="summary-label">
              Learner
            </span>
            <strong>{context.learner.name}</strong>
          </div>

          <div className="summary-item">
            <span className="summary-label">
              Module
            </span>
            <strong>
              {context.module.code} — {context.module.name}
            </strong>
          </div>

          <div className="summary-item">
            <span className="summary-label">
              Cohort
            </span>
            <strong>{context.cohort.name}</strong>
          </div>

          <div className="summary-item summary-item-wide">
            <span className="summary-label">
              Assignment
            </span>
            <strong>{context.assignment.title}</strong>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="submission-form"
        >
          <div className="upload-heading">
            <div>
              <h2>Upload your document</h2>
              <p>
                Accepted formats: DOC, DOCX, PDF, PBIX and ZIP.
              </p>
            </div>
          </div>

          <fieldset className="submission-track-options">
            <legend>Select submission type</legend>

            <label>
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
              Basic
            </label>

            <p>
              Grading outcome can be Failed, Foundation, or
              Proficient.
            </p>

            <label>
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
              Advanced
            </label>

            <p>
              Grading outcome can be Failed, Proficient, or
              Expert.
            </p>
          </fieldset>

          <label
            htmlFor="submitted-file"
            className="file-upload-box"
          >
            <span className="upload-icon" aria-hidden="true">
              ↑
            </span>

            <span className="upload-title">
              Choose a file to upload
            </span>

            <span className="upload-help">
              Select the completed assignment from your computer.
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
            disabled={isSubmitting}
            required
          />

          {selectedFile && (
            <div className="selected-file">
              <div>
                <span className="selected-file-label">
                  Selected file
                </span>

                <strong>{selectedFile.name}</strong>
              </div>

              <button
                type="button"
                className="remove-file-button"
                onClick={() => setSelectedFile(null)}
                disabled={isSubmitting}
              >
                Remove
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="error-message">
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
                isSubmitting
              }
            >
              {isSubmitting
                ? "Submitting..."
                : "Submit document"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}