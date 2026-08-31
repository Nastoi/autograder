from decimal import Decimal, ROUND_HALF_UP

from rest_framework.response import Response
from rest_framework.views import APIView

from submissions.models import LearnerSubmission


class SaPrReportView(APIView):
    def get(self, request):
        cohort_code = request.query_params.get("cohort_code", "").strip()

        submissions = (
            LearnerSubmission.objects
            .filter(
                assignment_level__assignment__assignment_code__iexact="SA-PR",
                status=LearnerSubmission.Status.COMPLETED,
            )
            .select_related(
                "learner",
                "context",
                "context__cohort",
                "assignment_level",
                "assignment_level__assignment",
            )
            .order_by(
                "learner_id",
                "context__cohort_id",
                "-attempt_number",
                "-submitted_at",
            )
        )

        if cohort_code:
            submissions = submissions.filter(
                context__cohort__cohort_code__iexact=cohort_code,
            )

        latest_by_learner = {}

        for submission in submissions:
            key = (
                submission.learner_id,
                submission.context.cohort_id,
            )

            if key in latest_by_learner:
                continue

            grade = None

            if (
                submission.final_score is not None
                and submission.maximum_score is not None
                and submission.maximum_score > 0
            ):
                grade = (
                    Decimal(submission.final_score)
                    / Decimal(submission.maximum_score)
                    * Decimal("100")
                ).quantize(
                    Decimal("0.01"),
                    rounding=ROUND_HALF_UP,
                )

            latest_by_learner[key] = {
                "school_email": submission.learner.email,
                "cohort_code": submission.context.cohort.cohort_code,
                "report_track": submission.get_submission_track_display(),
                "sa_pr_grade": float(grade) if grade is not None else None,
            }

        results = list(latest_by_learner.values())

        return Response(
            {
                "count": len(results),
                "results": results,
            }
        )