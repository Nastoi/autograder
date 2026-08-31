from dataclasses import dataclass

from django.db.models import QuerySet

from .models import LearnerSubmission



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






def get_latest_submission(
    *,
    learner,
    cohort,
    assignment,
):
    """Return the latest accepted attempt for this learner/assignment."""
    return (
        get_assignment_submissions(
            learner=learner,
            cohort=cohort,
            assignment=assignment,
        )
        .order_by(
            "-attempt_number",
            "-submitted_at",
        )
        .first()
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

    latest_submission = get_latest_submission(
        learner=learner,
        cohort=cohort,
        assignment=assignment,
    )

    # Kept as "best_score" for API compatibility. It now represents
    # the latest attempt's score, because the latest attempt is authoritative.
    best_score = (
        latest_submission.final_score
        if latest_submission is not None
        else None
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


def clean_up_submission_files(
    *,
    learner,
    cohort,
    assignment,
) -> None:
    """
    Retain the physical uploaded file only for the
    latest submission attempt.

    All LearnerSubmission database/history rows remain intact.
    """

    submissions = list(
        get_assignment_submissions(
            learner=learner,
            cohort=cohort,
            assignment=assignment,
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

    for submission in submissions:
        if submission.id == latest_submission.id:
            continue

        # Previous attempts keep their history/results, but generated
        # PDF page images/text are no longer needed once a newer attempt exists.
        submission.pages.all().delete()

        if submission.submitted_file:
            submission.submitted_file.delete(
                save=False,
            )

            submission.submitted_file = ""

            submission.save(
                update_fields=[
                    "submitted_file",
                ]
            )