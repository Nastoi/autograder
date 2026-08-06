import "../css/AssessmentMappings.css";
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

export function SubmissionPage() {
  const { contextId } = useParams();
  const navigate = useNavigate();

  const [context, setContext] =
    useState<SubmissionContext | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

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
    return <main className="admin-container">Loading submission page...</main>;
  }

  if (error && !context) {
    return (
      <main className="admin-container">
        <div className="admin-header">
                <h1>Unable to load submission</h1>
            </div>
        <p role="alert" className="error-message">{error}</p>
      </main>
    );
  }

  if (!context) {
    return <main className="admin-container">Submission context was not found.</main>;
  }

  return (
    <main className="admin-container">
      <div className="admin-header">
                <h1>Submit Assignment</h1>
            </div>

      <section>
        <p>
          <strong>Learner:</strong>{" "}
          {context.learner.name}
        </p>

        <p>
          <strong>Module:</strong>{" "}
          {context.module.code} — {context.module.name}
        </p>

        <p>
          <strong>Cohort:</strong>{" "}
          {context.cohort.name}
        </p>

        <p>
          <strong>Assignment:</strong>{" "}
          {context.assignment.title}
        </p>

        <p>
          <strong>Level:</strong>{" "}
          {context.assignment_level.display_name}
        </p>
      </section>

      <form onSubmit={handleSubmit} className="modern-form">
        <label htmlFor="submitted-file">
          Select your document
        </label>

        <input
          id="submitted-file"
          name="submitted_file"
          type="file"
          accept=".doc,.docx,.pdf,.pbix,.zip"
          onChange={handleFileChange}
          disabled={isSubmitting}
          required
        />

        {selectedFile && (
          <p>Selected: {selectedFile.name}</p>
        )}

        {error && <p role="alert" className="error-message">{error}</p>}

        <div className="form-actions">
                        <button
                                  type="submit"
                                  disabled={!selectedFile || isSubmitting}
                                 className="btn-primary">
                                  {isSubmitting
                                    ? "Submitting..."
                                    : "Submit document"}
                                </button>
                    </div>
      </form>
    </main>
  );
}