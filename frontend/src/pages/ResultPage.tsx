import "../css/AssessmentMappings.css";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import "../css/ResultPage.css";

import {
  getSubmission,
  type Submission,
} from "../api/submissions";

export function ResultPage() {
  const navigate = useNavigate();
  const { submissionId } = useParams();

  const [submission, setSubmission] =
    useState<Submission | null>(null);

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSubmission() {
      if (!submissionId) {
        setError("Submission ID is missing.");
        return;
      }

      try {
        const data = await getSubmission(submissionId);
        setSubmission(data);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load submission.",
        );
      }
    }

    void loadSubmission();
  }, [submissionId]);

  if (error) {
    return (
      <main className="admin-container">
        <div className="admin-header">
          <h1>Submission error</h1>
        </div>
        <p role="alert" className="error-message">{error}</p>
      </main>
    );
  }

  if (!submission) {
    return <main className="admin-container">Loading submission...</main>;
  }

  return (

    <main className="result-page">
      <div className="result-card">

        <div className="result-header">
          <div className="result-icon">✓</div>
          <h1>Submission Received</h1>
          <p>Your assignment has been successfully uploaded.</p>
        </div>

        <div className="result-details">

          <div className="result-row">
            <span>File</span>
            <strong>{submission.original_filename}</strong>
          </div>

          <div className="result-row">
            <span>Assignment</span>
            <strong>{submission.assignment_title}</strong>
          </div>

          <div className="result-row">
            <span>Status</span>
            <strong>{submission.status}</strong>
          </div>

          <div className="result-row">
            <span>Attempt</span>
            <strong>{submission.attempt_number}</strong>
          </div>

          {submission.status === "completed" && (
            <>
              <div className="result-row">
                <span>Score</span>
                <strong>
                  {submission.final_score} / {submission.maximum_score}
                </strong>
              </div>

              <div className="result-row">
                <span>Band</span>
                <strong>{submission.achieved_band}</strong>
              </div>

              <div className="feedback-box">
                <h3>Feedback</h3>
                <p>{submission.feedback}</p>
              </div>
            </>
          )}

          {submission.status === "uploaded" && (
            <div className="pending-box">
              Your assignment is waiting for grading.
            </div>
          )}

        </div>

        <main className="admin-container">
          <div className="admin-header">
            <h1>Submission received</h1>
          </div>

          <p>
            <strong>File:</strong>{" "}
            {submission.original_filename}
          </p>

          <p>
            <strong>Assignment:</strong>{" "}
            {submission.assignment_title}
          </p>

          <p>
            <strong>Status:</strong>{" "}
            {submission.status}
          </p>

          <p>
            <strong>Attempt:</strong>{" "}
            {submission.attempt_number}
          </p>

          {submission.status === "completed" && (
            <>
              <p>
                <strong>Score:</strong>{" "}
                {submission.final_score} / {submission.maximum_score}
              </p>

              <p>
                <strong>Band:</strong>{" "}
                {submission.achieved_band}
              </p>

              <p>
                <strong>Feedback:</strong>{" "}
                {submission.feedback}
              </p>
            </>
          )}

          {submission.status === "uploaded" && (
            <p>
              Your document was uploaded successfully and is
              waiting for grading.
            </p>
          )}


          <button
            className="submit-again-btn"
            type="button"
            onClick={() =>
              navigate(`/submit/${submission.context_id}`)
            }
          >
            Submit Another Attempt
          </button>
        </main>
      </div>
    </main>
  );
}