"""User-safe submission failure recording helpers.

Technical exception details remain in the grading audit/process logs.  The
LearnerSubmission fields populated here are intentionally suitable for display
to learners, faculty and administrators.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.utils import timezone

from .audit import record_submission_event
from .models import LearnerSubmission


@dataclass(frozen=True)
class FailureDefinition:
    code: str
    message: str
    mitigation: str


FAILURES: dict[str, FailureDefinition] = {
    "WORKER_LOST": FailureDefinition(
        code="WORKER_LOST",
        message=(
            "The grading worker stopped unexpectedly while processing this "
            "submission."
        ),
        mitigation=(
            "Retry the submission once. If the file is very large or contains "
            "many image-heavy pages, reduce unnecessary pages and compress "
            "screenshots before retrying. If the problem continues, contact "
            "your instructor or system administrator and provide the submission ID."
        ),
    ),
    "GRADING_TIMEOUT": FailureDefinition(
        code="GRADING_TIMEOUT",
        message=(
            "Grading took longer than the allowed processing time and was "
            "stopped safely."
        ),
        mitigation=(
            "Reduce the number of image-heavy pages, compress screenshots or "
            "images before exporting the PDF, and keep only evidence relevant "
            "to the assignment. Then submit again. If the problem continues, "
            "contact your instructor or system administrator and provide the "
            "submission ID."
        ),
    ),
    "PDF_EXTRACTION_FAILED": FailureDefinition(
        code="PDF_EXTRACTION_FAILED",
        message=(
            "The submitted PDF could not be prepared for grading."
        ),
        mitigation=(
            "Open the PDF locally to confirm it is not corrupted, then export "
            "or print it to a new PDF and submit again. If the file contains "
            "very large images, compress them before re-exporting."
        ),
    ),
    "TASK_MAPPING_FAILED": FailureDefinition(
        code="TASK_MAPPING_FAILED",
        message=(
            "The grading service could not reliably map the submitted evidence "
            "to the configured assignment tasks."
        ),
        mitigation=(
            "Check that the correct assignment file was submitted and that the "
            "document clearly identifies the required tasks and evidence. Retry "
            "once; if it fails again, contact your instructor or administrator."
        ),
    ),
    "AI_GRADING_FAILED": FailureDefinition(
        code="AI_GRADING_FAILED",
        message=(
            "The automated grading service could not complete the assessment."
        ),
        mitigation=(
            "Retry the submission once. If the problem continues, contact your "
            "instructor or system administrator and provide the submission ID."
        ),
    ),
    "UNRELATED_DOCUMENT": FailureDefinition(
        code="UNRELATED_DOCUMENT",
        message=(
            "The submitted document does not appear to match this assignment."
        ),
        mitigation=(
            "Check the assignment and submission type, then upload the correct "
            "document and submit again."
        ),
    ),
    "GRADING_QUEUE_FAILED": FailureDefinition(
        code="GRADING_QUEUE_FAILED",
        message=(
            "The submission was received, but background grading could not be "
            "started."
        ),
        mitigation=(
            "Wait a short time and try again. If the problem continues, contact "
            "the system administrator and provide the submission ID."
        ),
    ),
    "GRADING_TECHNICAL_ERROR": FailureDefinition(
        code="GRADING_TECHNICAL_ERROR",
        message=(
            "Grading could not be completed because of a technical error."
        ),
        mitigation=(
            "Retry the submission once. If the problem continues, contact your "
            "instructor or system administrator and provide the submission ID."
        ),
    ),
}


def get_failure_definition(code: str) -> FailureDefinition:
    return FAILURES.get(code, FAILURES["GRADING_TECHNICAL_ERROR"])


def clear_submission_failure(submission: LearnerSubmission) -> None:
    """Clear a previous failure before a controlled retry/requeue."""
    if not any(
        [
            submission.failure_code,
            submission.failure_message,
            submission.failure_mitigation,
            submission.failed_at,
        ]
    ):
        return

    submission.failure_code = ""
    submission.failure_message = ""
    submission.failure_mitigation = ""
    submission.failed_at = None
    submission.save(
        update_fields=[
            "failure_code",
            "failure_message",
            "failure_mitigation",
            "failed_at",
        ]
    )


def mark_submission_failed(
    submission: LearnerSubmission,
    *,
    code: str,
    technical_details: dict | None = None,
    overwrite: bool = True,
) -> LearnerSubmission:
    """Persist a learner-safe failure while retaining technical details in logs."""
    if submission.failure_code and not overwrite:
        return submission

    definition = get_failure_definition(code)

    submission.status = LearnerSubmission.Status.ERROR
    submission.failure_code = definition.code
    submission.failure_message = definition.message
    submission.failure_mitigation = definition.mitigation
    submission.failed_at = timezone.now()
    submission.save(
        update_fields=[
            "status",
            "failure_code",
            "failure_message",
            "failure_mitigation",
            "failed_at",
        ]
    )

    record_submission_event(
        submission,
        stage="failure",
        status="error",
        event_code=definition.code,
        message=definition.message,
        details=technical_details or {},
    )

    return submission
