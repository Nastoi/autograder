import logging

from celery import shared_task

# from .attempt_policy import clean_up_submission_files
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
            "assignment_level",
            "assignment_level__assignment",
        )
        .get(id=submission_id)
    )

    try:
        if submission.status == LearnerSubmission.Status.COMPLETED:
            logger.info(
                "Submission %s is already completed; skipping grading.",
                submission_id,
            )
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

        # if (
        #     submission.status
        #     == LearnerSubmission.Status.COMPLETED
        #     and submission.final_score is not None
        # ):
        #     clean_up_submission_files(
        #         learner=submission.learner,
        #         cohort=submission.context.cohort,
        #         assignment=submission.assignment_level.assignment,
        #     )

    except Exception:
        logger.exception(
            "Background grading failed for submission %s",
            submission_id,
        )

        submission.status = LearnerSubmission.Status.ERROR
        submission.save(
            update_fields=["status"]
        )

        raise