import logging

from celery import shared_task
from django.conf import settings
import requests

from lms.ags import send_ags_score
from lms.models import LtiUserIdentity

from .attempt_policy import get_latest_submission
from .models import LearnerSubmission
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
            push_submission_grade_task.delay(str(submission.id))
            return

        logger.info(
            "Background grading started for submission %s.",
            submission_id,
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

        # Do not touch the LMS when a submission is merely accepted.
        # AGS passback happens only after this grading run has finished.
        # The passback task sends the real percentage for a valid completed
        # grade, otherwise 0/100 for this accepted latest attempt.
        push_submission_grade_task.delay(str(submission.id))

    except Exception:
        logger.exception(
            "Background grading failed for submission %s",
            submission_id,
        )

        submission.status = LearnerSubmission.Status.ERROR
        submission.save(
            update_fields=["status"]
        )

        # The submission row exists, so this is an accepted attempt.
        # Once grading has ended in error, queue AGS passback. If this is
        # still the latest attempt, the passback task will send 0/100.
        try:
            push_submission_grade_task.delay(str(submission.id))
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

    A valid completed grade is converted to /100. Any accepted latest attempt
    whose grading ended without a usable score is sent as 0/100. Older attempts
    never overwrite a newer accepted attempt.
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
        return

    mapping = submission.context.assessment_mapping

    if mapping is None:
        logger.warning(
            "Skipping AGS passback for submission %s: no assessment mapping is linked.",
            submission_id,
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
        percentage_score = max(0.0, min(100.0, percentage_score))
    else:
        # This submission exists in the database and grading has already
        # finished/failed before this task was queued, so it is an accepted
        # latest attempt without a usable grade. Latest-attempt policy = 0.
        percentage_score = 0.0

    logger.info(
        "Sending AGS score %.2f/100 for submission %s (status=%s) to mapping %s.",
        percentage_score,
        submission_id,
        submission.status,
        mapping.id,
    )

    result = send_ags_score(
        client_id=mapping.lti_client_id,
        token_url=mapping.lti_access_token_url,
        lineitem_url=mapping.lti_ags_lineitem_url,
        lti_user_id=identity.lti_user_id,
        score=percentage_score,
        maximum_score=100.0,
    )

    logger.info(
        "AGS passback completed for submission %s with HTTP %s.",
        submission_id,
        result["status_code"],
    )
