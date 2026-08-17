from dataclasses import dataclass

from django.db.models import QuerySet

from .models import LearnerSubmission


# MAX_ATTEMPTS_AFTER_FIRST_PASS = 3


@dataclass(frozen=True)
class AttemptPolicy:
    can_submit: bool
    limited_mode: bool
    attempts_used: int
    attempts_remaining: int | None
    first_pass_attempt: int | None
    best_score: object | None


def get_assignment_submissions(
    *,
    learner,
    cohort,
    assignment,
) -> QuerySet[LearnerSubmission]:
    """
    Return all submissions for the same learner, cohort and assignment.

    Assignment level is deliberately NOT used here because Basic/Advanced
    attempts still belong to the same assignment attempt history.
    """
    return LearnerSubmission.objects.filter(
        learner=learner,
        context__cohort=cohort,
        assignment_level__assignment=assignment,
    )


def submission_is_pass(submission: LearnerSubmission) -> bool:
    """
    Determine pass/fail using percentage score against
    the assignment's configured pass mark.
    """
    if (
        submission.status != LearnerSubmission.Status.COMPLETED
        or submission.final_score is None
        or submission.maximum_score is None
        or submission.maximum_score <= 0
    ):
        return False

    assignment = submission.assignment_level.assignment

    score_percentage = (
        float(submission.final_score)
        / float(submission.maximum_score)
    ) * 100

    return score_percentage >= float(
        assignment.minimum_pass_score
    )


def get_attempt_policy(
    *,
    learner,
    cohort,
    assignment,
) -> AttemptPolicy:
    submissions = (
        get_assignment_submissions(
            learner=learner,
            cohort=cohort,
            assignment=assignment,
        )
        .select_related(
            "assignment_level",
            "assignment_level__assignment",
        )
        .order_by(
            "attempt_number",
            "submitted_at",
        )
    )

    completed_submissions = [
        submission
        for submission in submissions
        if (
            submission.status
            == LearnerSubmission.Status.COMPLETED
            and submission.final_score is not None
        )
    ]

    best_score = None

    if completed_submissions:
        best_score = max(
            submission.final_score
            for submission in completed_submissions
        )

    attempts_used = len(completed_submissions)

    return AttemptPolicy(
        can_submit=True,
        limited_mode=False,
        attempts_used=attempts_used,
        attempts_remaining=None,
        first_pass_attempt=None,
        best_score=best_score,
    )

    # # Count completed graded attempts starting from the first pass.
    # #
    # # Example:
    # # A1 fail
    # # A2 pass  -> used 1
    # # A3 fail  -> used 2
    # # A4 fail  -> used 3
    # limited_attempts = [
    #     submission
    #     for submission in completed_submissions
    #     if submission.attempt_number >= first_pass.attempt_number
    # ]

    # attempts_used = len(limited_attempts)

    # attempts_remaining = max(
    # #     MAX_ATTEMPTS_AFTER_FIRST_PASS - attempts_used,
    # #     0,
    #     can_submit=attempts_remaining > 0,
    #     limited_mode=True,
    #     attempts_remaining=attempts_remaining,
    #     first_pass_attempt=first_pass.attempt_number,
    # )



    # # return AttemptPolicy(
    # #     can_submit=attempts_remaining > 0,
    # #     limited_mode=True,
    # #     attempts_used=attempts_used,
    # #     attempts_remaining=attempts_remaining,
    # #     first_pass_attempt=first_pass.attempt_number,
    # #     best_score=best_score,
    # # )
    
    # return AttemptPolicy(
    #     can_submit=True,
    #     limited_mode=False,
    #     attempts_used=attempts_used,
    #     attempts_remaining=None,
    #     first_pass_attempt=None,
    #     best_score=best_score,
    # )


def clean_up_submission_files(
    *,
    learner,
    cohort,
    assignment,
) -> None:
    """
    Retain physical files only for:

    1. The latest completed graded submission.
    2. The highest-scoring completed graded submission.

    All LearnerSubmission database records remain intact.

    If latest == best, only one physical file is retained.
    """

    submissions = list(
        get_assignment_submissions(
            learner=learner,
            cohort=cohort,
            assignment=assignment,
        )
        .filter(
            status=LearnerSubmission.Status.COMPLETED,
            final_score__isnull=False,
        )
        .order_by(
            "attempt_number",
            "submitted_at",
        )
    )

    if not submissions:
        return

    latest_submission = max(
        submissions,
        key=lambda submission: (
            submission.attempt_number,
            submission.submitted_at,
        ),
    )

    # In a score tie, prefer the newer submission.
    best_submission = max(
        submissions,
        key=lambda submission: (
            submission.final_score,
            submission.attempt_number,
            submission.submitted_at,
        ),
    )

    retained_ids = {
        latest_submission.id,
        best_submission.id,
    }

    for submission in submissions:
        if submission.id in retained_ids:
            continue

        if submission.submitted_file:
            submission.submitted_file.delete(
                save=False,
            )

            # Keep the submission/history row but remove its
            # reference to the deleted physical file.
            submission.submitted_file = ""

            submission.save(
                update_fields=[
                    "submitted_file",
                ]
            )