import json
import logging

from django.utils import timezone

from .models import SubmissionGradingAudit, SubmissionProcessLog

logger = logging.getLogger(__name__)


def _json_safe(value):
    return json.loads(json.dumps(value, default=str))


def record_submission_event(
    submission,
    *,
    stage,
    status,
    event_code="",
    message="",
    details=None,
):
    """Best-effort event logging: never change the grading outcome."""
    try:
        assignment = submission.assignment_level.assignment
        cohort = submission.context.cohort
        learner = submission.learner

        return SubmissionProcessLog.objects.create(
            submission=submission,
            cohort_code=cohort.cohort_code,
            cohort_name=cohort.cohort_name,
            assignment_code=assignment.assignment_code,
            assignment_title=assignment.assignment_title,
            learner_email=learner.email or "",
            learner_username=learner.username,
            attempt_number=submission.attempt_number,
            stage=stage,
            status=status,
            event_code=event_code,
            message=message,
            details=_json_safe(details or {}),
        )
    except Exception:
        logger.exception(
            "Unable to persist submission process log for submission %s.",
            getattr(submission, "id", None),
        )
        return None


def update_grading_audit(submission, **updates):
    """Best-effort AI audit persistence: never change the grading outcome."""
    try:
        json_fields = {
            "task_mapping_snapshot",
            "raw_ai_response",
            "criterion_evaluations",
            "scoring_snapshot",
        }
        safe_updates = {
            key: _json_safe(value) if key in json_fields else value
            for key, value in updates.items()
        }

        audit, _ = SubmissionGradingAudit.objects.get_or_create(
            submission=submission,
            defaults={"started_at": timezone.now()},
        )

        for key, value in safe_updates.items():
            setattr(audit, key, value)

        audit.save()
        return audit
    except Exception:
        logger.exception(
            "Unable to persist grading audit for submission %s.",
            getattr(submission, "id", None),
        )
        return None


def serialize_grading_audit(submission):
    try:
        audit = submission.grading_audit
    except SubmissionGradingAudit.DoesNotExist:
        return None

    return {
        "status": audit.status,
        "model_name": audit.model_name,
        "grader_version": audit.grader_version,
        "task_mapping_snapshot": audit.task_mapping_snapshot,
        "raw_ai_response": audit.raw_ai_response,
        "criterion_evaluations": audit.criterion_evaluations,
        "scoring_snapshot": audit.scoring_snapshot,
        "overall_summary": audit.overall_summary,
        "error_code": audit.error_code,
        "error_message": audit.error_message,
        "started_at": audit.started_at,
        "completed_at": audit.completed_at,
        "updated_at": audit.updated_at,
    }


def serialize_process_logs(submission):
    return [
        {
            "id": str(entry.id),
            "stage": entry.stage,
            "status": entry.status,
            "event_code": entry.event_code,
            "message": entry.message,
            "details": entry.details,
            "created_at": entry.created_at,
        }
        for entry in submission.process_logs.all()
    ]
