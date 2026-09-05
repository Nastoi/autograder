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

type SubmissionTrack = string;



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
  const [technicalError, setTechnicalError] = useState("");

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
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load the submission page.";

        setTechnicalError(message);
        setError(
          "We could not establish your assessment session automatically.",
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
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setSelectedFile(null);
      setError("");
      return;
    }

    const extension = file.name
      .slice(file.name.lastIndexOf("."))
      .toLowerCase();

    const allowedExtensions = [".pdf", ".zip"];

    if (!allowedExtensions.includes(extension)) {
      setSelectedFile(null);
      setError(
        "Unsupported file type. Please upload a PDF or ZIP containing one PDF.",
      );

      event.target.value = "";
      return;
    }

    const maxFileSize = 50 * 1024 * 1024;

    if (file.size > maxFileSize) {
      setSelectedFile(null);
      setError("The file cannot exceed 50 MB.");

      event.target.value = "";
      return;
    }

    if (file.size === 0) {
      setSelectedFile(null);
      setError("The selected file is empty.");

      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setError("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!submissionTrack) {
      setError("Please select a submission track.");
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
          <section
            className="content-card"
            style={{ padding: "32px" }}
          >
            <h1 style={{ marginTop: 0 }}>
              Unable to open your assessment
            </h1>

            <p>
              We could not establish your assessment session automatically.
              Your work has not been affected.
            </p>

            <p>Please try the following:</p>

            <ol style={{ paddingLeft: "22px", lineHeight: 1.7 }}>
              <li>Refresh this page once.</li>

              <li>
                Make sure you are still signed in to your LMS, then return
                to your LMS course and open the assignment again.
              </li>

              <li>
                If you are using Chrome or Edge, check that third-party
                cookies are allowed for the LMS and AutoGrad3r.
              </li>

              <li>
                If the issue continues, try another browser.
              </li>
            </ol>

            <p>
              If the assessment still cannot be opened after these steps,
              please contact your instructor or support.
            </p>

            {technicalError && (
              <details style={{ marginTop: "24px" }}>
                <summary
                  style={{
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Technical details
                </summary>

                <p
                  style={{
                    marginTop: "10px",
                    padding: "12px",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "13px",
                    overflowWrap: "anywhere",
                  }}
                >
                  {technicalError}
                </p>
              </details>
            )}
          </section>
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
                Accepted formats: PDF or ZIP containing one PDF.
              </p>
            </div>
          </div>

          <fieldset className="submission-track-options submission-track-grid">
            <legend>Select submission type</legend>

            {context.assignment_levels.map((level) => (
              <label
                key={level.id}
                className={
                  submissionTrack === level.level_code
                    ? "submission-track-card selected"
                    : "submission-track-card"
                }
              >
                <input
                  type="radio"
                  name="submission_track"
                  value={level.level_code}
                  checked={
                    submissionTrack === level.level_code
                  }
                  onChange={() =>
                    setSubmissionTrack(level.level_code)
                  }
                  required
                />

                <div>
                  <strong>
                    {level.display_name}
                  </strong>

                  <span
                    style={{
                      display: "block",
                      marginTop: "4px",
                      fontSize: "14px",
                      fontWeight: 400,
                    }}
                  >
                    Outcome can be{" "}
                    {level.band_definitions
                      .map((band) => band.display_name)
                      .join(", ")}.
                  </span>
                </div>
              </label>
            ))}
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
              accept=".pdf,.zip"
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
            <strong>{context.cohort.code}</strong>
          </div>

          <div className="summary-item">
            <span className="summary-label">Module</span>
            <strong>
              {context.module.code} — {context.module.name}
            </strong>
          </div>

          <div className="summary-item">
            <span className="summary-label">Assignment</span>
            <strong>{context.assignment.code}</strong>
          </div>

          <div className="summary-item">
            <span className="summary-label">Maximum score</span>
            <strong>{context.assignment.maximum_score}</strong>
          </div>
        </section>
      </div>


      {isSubmitting && (
        <div className="grading-modal-backdrop">
          <div className="grading-modal">
            <div className="grading-spinner" />

            <h2>Grading your submission</h2>

            <p>
              AutoGrad3r is reviewing your submission against the
              assignment tasks and rubric.
            </p>

            <p className="grading-modal-note">
              This may take a few minutes. Please keep this page open.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
