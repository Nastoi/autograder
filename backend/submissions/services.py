from django.utils import timezone

from .models import LearnerSubmission
from decimal import Decimal

def run_mock_grading(
    submission: LearnerSubmission,
) -> LearnerSubmission:
    submission.status = LearnerSubmission.Status.PROCESSING
    submission.save(update_fields=["status"])

    maximum_score = (
        submission.assignment_level.assignment.maximum_score
    )

    submission.maximum_score = maximum_score

    if (
        submission.submission_track
        == LearnerSubmission.SubmissionTrack.BASIC
    ):
        submission.final_score = maximum_score * Decimal("0.75")
        submission.achieved_band = "proficient"
        submission.feedback = (
            "Temporary Basic-track mock result. "
            "The submission achieved Proficient."
        )

    elif (
        submission.submission_track
        == LearnerSubmission.SubmissionTrack.ADVANCED
    ):
        submission.final_score = maximum_score * Decimal("0.90")
        submission.achieved_band = "expert"
        submission.feedback = (
            "Temporary Advanced-track mock result. "
            "The submission achieved Expert."
        )

    submission.status = LearnerSubmission.Status.COMPLETED
    submission.completed_at = timezone.now()

    submission.save(
        update_fields=[
            "final_score",
            "maximum_score",
            "achieved_band",
            "feedback",
            "status",
            "completed_at",
        ],
    )

    return submission