import logging

from celery import shared_task
from django.conf import settings
import requests

from lms.ags import clear_ags_score, send_ags_score
from lms.models import LtiUserIdentity

from .attempt_policy import get_latest_submission
from .models import LearnerSubmission
from .audit import record_submission_event, update_grading_audit
from .services import run_ai_grading

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(),
    acks_late=True,
    reject_on_worker_lost=True,
)
def grade_submission_task(
    self,
    submission_id: str,
):
    submission = (
        LearnerSubmission.objects
        .select_related(
            "context",
            "context__cohort",
            "context__assessment_mapping",
            "assignment_level",
            "assignment_level__assignment",
        )
        .get(id=submission_id)
    )

    try:
        if submission.status == LearnerSubmission.Status.COMPLETED:
            # This can happen if a worker redelivers an already-completed task.
            # Queue AGS again safely; the passback task will verify this is
            # still the latest accepted attempt before sending anything.
            self.app.send_task(
                "submissions.tasks.push_submission_grade_task",
                args=[str(submission.id)],
            )
            return

        logger.info(
            "Background grading started for submission %s.",
            submission_id,
        )

        record_submission_event(
            submission,
            stage="background_grading",
            status="started",
            event_code="BACKGROUND_GRADING_STARTED",
            message="Background grading worker started processing the attempt.",
        )

        submission.status = LearnerSubmission.Status.PROCESSING
        submission.save(
            update_fields=["status"]
        )

        submission = run_ai_grading(submission)

        logger.info(
            "Background grading finished for submission %s with status %s.",
            submission_id,
            submission.status,
        )

        record_submission_event(
            submission,
            stage="completed",
            status=(
                "success"
                if submission.status == LearnerSubmission.Status.COMPLETED
                else "warning"
            ),
            event_code="BACKGROUND_GRADING_FINISHED",
            message=(
                "Background grading finished successfully."
                if submission.status == LearnerSubmission.Status.COMPLETED
                else "Background grading finished without a completed academic grade."
            ),
            details={"submission_status": submission.status},
        )

        # Do not touch the LMS when a submission is merely accepted.
        # AGS passback happens only after this grading run has finished.
        # The passback task sends the real percentage for a valid completed
        # grade, otherwise 0/100 for this accepted latest attempt.
        self.app.send_task(
            "submissions.tasks.push_submission_grade_task",
            args=[str(submission.id)],
        )

    except Exception as exc:
        logger.exception(
            "Background grading failed for submission %s",
            submission_id,
        )
        record_submission_event(
            submission,
            stage="background_grading",
            status="error",
            event_code="BACKGROUND_GRADING_ERROR",
            message="Background grading ended with a technical error.",
            details={
                "error_type": type(exc).__name__,
                "error_message": str(exc),
            },
        )
        update_grading_audit(
            submission,
            status="error",
            error_code=type(exc).__name__.upper(),
            error_message=str(exc),
        )

        submission.status = LearnerSubmission.Status.ERROR
        submission.save(
            update_fields=["status"]
        )

        # The submission row exists, so this is an accepted attempt.
        # Once grading has ended in error, queue AGS passback. If this is
        # still the latest attempt, the passback task will send 0/100.
        try:
            self.app.send_task(
                "submissions.tasks.push_submission_grade_task",
                args=[str(submission.id)],
            )
        except Exception:
            logger.exception(
                "Could not queue AGS passback for failed submission %s.",
                submission_id,
            )

        raise


@shared_task(
    bind=True,
    autoretry_for=(
        requests.exceptions.RequestException,
    ),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=5,
    acks_late=True,
    reject_on_worker_lost=True,
)
def push_submission_grade_task(
    self,
    submission_id: str,
):
    """Push the authoritative latest accepted attempt to the LMS via AGS.

    A valid completed grade is converted to /100.

    If the latest accepted attempt finishes without a usable grade,
    the previous LMS grade is cleared.

    Older attempts never overwrite a newer accepted attempt.
    """
    submission = (
        LearnerSubmission.objects
        .select_related(
            "learner",
            "context",
            "context__cohort",
            "context__assessment_mapping",
            "assignment_level",
            "assignment_level__assignment",
        )
        .get(id=submission_id)
    )

    assignment = submission.assignment_level.assignment
    cohort = submission.context.cohort

    latest_submission = get_latest_submission(
        learner=submission.learner,
        cohort=cohort,
        assignment=assignment,
    )

    if (
        latest_submission is None
        or latest_submission.id != submission.id
    ):
        logger.info(
            "Skipping AGS passback for submission %s because a newer accepted attempt exists.",
            submission_id,
        )
        record_submission_event(
            submission,
            stage="grade_posting",
            status="warning",
            event_code="AGS_SKIPPED_NEWER_ATTEMPT",
            message="LMS grade posting was skipped because a newer accepted attempt exists.",
        )
        return

    mapping = submission.context.assessment_mapping

    if mapping is None:
        logger.warning(
            "Skipping AGS passback for submission %s: no assessment mapping is linked.",
            submission_id,
        )
        record_submission_event(
            submission,
            stage="grade_posting",
            status="warning",
            event_code="AGS_NO_MAPPING",
            message="LMS grade posting was skipped because no assessment mapping is linked.",
        )
        return

    if not all([
        mapping.lti_client_id,
        mapping.lti_access_token_url,
        mapping.lti_ags_lineitem_url,
    ]):
        logger.warning(
            "Skipping AGS passback for submission %s: mapping %s has incomplete AGS configuration.",
            submission_id,
            mapping.id,
        )
        record_submission_event(
            submission,
            stage="grade_posting",
            status="warning",
            event_code="AGS_CONFIGURATION_INCOMPLETE",
            message="LMS grade posting was skipped because AGS configuration is incomplete.",
        )
        return

    identity = (
        LtiUserIdentity.objects
        .filter(
            user=submission.learner,
            issuer=settings.LTI_PLATFORM_ISSUER,
            deployment_id=mapping.lti_deployment_id,
        )
        .order_by("-updated_at")
        .first()
    )

    if identity is None:
        logger.warning(
            "Skipping AGS passback for submission %s: no matching LTI identity found for learner %s.",
            submission_id,
            submission.learner_id,
        )
        record_submission_event(
            submission,
            stage="grade_posting",
            status="warning",
            event_code="AGS_IDENTITY_MISSING",
            message="LMS grade posting was skipped because no matching LTI learner identity was found.",
        )
        return

    has_usable_score = (
        submission.status == LearnerSubmission.Status.COMPLETED
        and submission.final_score is not None
        and submission.maximum_score is not None
        and float(submission.maximum_score) > 0
    )

    if has_usable_score:
        percentage_score = (
            float(submission.final_score)
            / float(submission.maximum_score)
        ) * 100.0

        percentage_score = max(
            0.0,
            min(100.0, percentage_score),
        )

        logger.info(
            "Sending AGS score %.2f/100 for submission %s "
            "(status=%s) to mapping %s.",
            percentage_score,
            submission_id,
            submission.status,
            mapping.id,
        )

        record_submission_event(
            submission,
            stage="grade_posting",
            status="started",
            event_code="AGS_SCORE_POST_STARTED",
            message="Posting the completed grade to the LMS.",
            details={"percentage_score": round(percentage_score, 2)},
        )
        try:
            result = send_ags_score(
                client_id=mapping.lti_client_id,
                token_url=mapping.lti_access_token_url,
                lineitem_url=mapping.lti_ags_lineitem_url,
                lti_user_id=identity.lti_user_id,
                score=percentage_score,
                maximum_score=100.0,
            )
        except Exception as exc:
            record_submission_event(
                submission,
                stage="grade_posting",
                status="error",
                event_code="AGS_SCORE_POST_ERROR",
                message="Posting the grade to the LMS failed.",
                details={
                    "error_type": type(exc).__name__,
                    "error_message": str(exc),
                },
            )
            raise

        logger.info(
            "AGS passback completed for submission %s with HTTP %s.",
            submission_id,
            result["status_code"],
        )

        record_submission_event(
            submission,
            stage="grade_posting",
            status="success",
            event_code="AGS_SCORE_POST_COMPLETED",
            message="Grade posting to the LMS completed successfully.",
            details={"http_status": result["status_code"]},
        )

    else:
        logger.info(
            "Clearing AGS grade for submission %s because the "
            "latest accepted attempt has no usable grade "
            "(status=%s).",
            submission_id,
            submission.status,
        )

        record_submission_event(
            submission,
            stage="grade_posting",
            status="started",
            event_code="AGS_CLEAR_STARTED",
            message="Clearing the LMS grade because the latest accepted attempt has no usable grade.",
        )
        try:
            result = clear_ags_score(
                client_id=mapping.lti_client_id,
                token_url=mapping.lti_access_token_url,
                lineitem_url=mapping.lti_ags_lineitem_url,
                lti_user_id=identity.lti_user_id,
            )
        except Exception as exc:
            record_submission_event(
                submission,
                stage="grade_posting",
                status="error",
                event_code="AGS_CLEAR_ERROR",
                message="Clearing the LMS grade failed.",
                details={
                    "error_type": type(exc).__name__,
                    "error_message": str(exc),
                },
            )
            raise

        logger.info(
            "AGS grade cleared for submission %s with HTTP %s.",
            submission_id,
            result["status_code"],
        )

        record_submission_event(
            submission,
            stage="grade_posting",
            status="success",
            event_code="AGS_CLEAR_COMPLETED",
            message="The LMS grade was cleared successfully.",
            details={"http_status": result["status_code"]},
        )
