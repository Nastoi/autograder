import "../css/SubmissionFailureNotice.css";

type Props = {
  submissionId?: string;
  code?: string | null;
  message?: string | null;
  mitigation?: string | null;
  compact?: boolean;
};

export function SubmissionFailureNotice({
  submissionId,
  code,
  message,
  mitigation,
  compact = false,
}: Props) {
  if (!message && !mitigation) {
    return null;
  }

  return (
    <div
      className={`submission-failure-notice${compact ? " submission-failure-notice--compact" : ""}`}
      role="alert"
    >
      <div className="submission-failure-notice__title">
        Grading could not be completed
      </div>

      {code && (
        <div className="submission-failure-notice__code">
          Reference: {code}
        </div>
      )}

      {message && (
        <div className="submission-failure-notice__section">
          <strong>Why it failed</strong>
          <p>{message}</p>
        </div>
      )}

      {mitigation && (
        <div className="submission-failure-notice__section">
          <strong>What you can do</strong>
          <p>{mitigation}</p>
        </div>
      )}

      {submissionId && (
        <div className="submission-failure-notice__submission-id">
          Submission ID: <code>{submissionId}</code>
        </div>
      )}
    </div>
  );
}
