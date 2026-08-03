from django.utils import timezone

from .models import LearnerSubmission


def run_mock_grading(
    submission: LearnerSubmission,
) -> LearnerSubmission:
    submission.status = LearnerSubmission.Status.PROCESSING
    submission.save(update_fields=["status"])

    submission.final_score = 15
    submission.maximum_score = (
        submission.assignment_level.assignment.maximum_score
    )
    submission.achieved_band = "foundation"
    submission.feedback = (
        "Temporary mock grading result. "
        "The real grading pipeline is not enabled yet."
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