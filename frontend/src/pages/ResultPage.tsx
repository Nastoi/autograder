import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import "../css/ResultPage.css";

import {
  getSubmission,
  type Submission,
} from "../api/submissions";

import { jsPDF } from "jspdf";

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

  function downloadFeedbackPdf() {
    if (!submission) return;

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

      const lines = doc.splitTextToSize(text || "—", maxWidth);

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

    addText(`Assignment: ${submission.assignment_code}`, 11, true);
    addText(`Attempt: ${submission.attempt_number}`);
    addText(
      `Score: ${submission.final_score ?? "—"} / ${submission.maximum_score ?? "—"
      }`,
    );
    addText(`Band: ${submission.achieved_band || "—"}`);

    y += 4;

    addText("Overall Feedback", 13, true, 8);
    addText(submission.feedback || "No overall feedback provided.");

    y += 6;

    addText("Detailed Criterion Feedback", 13, true, 8);

    submission.criterion_results.forEach((criterion, index) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      addText(`Criterion ${index + 1}`, 12, true);

      addText(
        `Awarded marks: ${criterion.awarded_marks}`,
      );

      if (criterion.achievement_band) {
        addText(
          `Band: ${criterion.achievement_band}`,
        );
      }

      addText(
        criterion.feedback ||
        "No detailed feedback was provided.",
      );

      y += 6;
    });

    doc.save(
      `${submission.assignment_code}-attempt-${submission.attempt_number}-feedback.pdf`,
    );
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
            <span>Submission Type</span>
            <strong>
              {submission.submission_track}
            </strong>
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
                <h3>Overall Feedback</h3>
                <p>{submission.feedback}</p>
              </div>

              {submission.criterion_results.length > 0 && (
                <div className="feedback-box">
                  <h3>Detailed Feedback</h3>

                  {submission.criterion_results.map((criterion, index) => (
                    <div
                      key={criterion.id}
                      className="criterion-feedback-item"
                    >
                      <div className="criterion-feedback-header">
                        <strong>Criterion {index + 1}</strong>
                        <span>{criterion.awarded_marks} marks</span>
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
                  ))}
                </div>
              )}

              <button
                type="button"
                className="submit-again-btn"
                onClick={downloadFeedbackPdf}
              >
                Download Detailed Feedback PDF
              </button>
            </>
          )}

          {submission.status === "uploaded" && (
            <div className="pending-box">
              Your assignment is waiting for grading.
            </div>
          )}

        </div>

        <button
          className="submit-again-btn"
          type="button"
          onClick={() =>
            navigate(`/submit/${submission.context_id}`)
          }
        >
          Submit Another Attempt
        </button>
      </div>
    </main>
  );
}
