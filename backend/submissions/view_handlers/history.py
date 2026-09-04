from ..view_handlers.submissions import LearnerSubmissionViewSet,SubmissionCreateView,SubmissionDetailView

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from lms.models import AssessmentMapping
from ..models import LearnerSubmission
from ..serializers import (
    LearnerSubmissionSerializer,
)
from ..attempt_policy import (
    get_attempt_policy,
)
from rest_framework.authentication import SessionAuthentication
from lms.authentication import LtiSessionAuthentication

class MappingSubmissionHistoryView(APIView):
    authentication_classes = [
        LtiSessionAuthentication,
        SessionAuthentication,
    ]
    permission_classes = [IsAuthenticated]

    def get(self, request, mapping_id):
        mapping = get_object_or_404(
            AssessmentMapping.objects.select_related(
                "cohort",
                "assignment",
            ),
            id=mapping_id,
            is_active=True,
        )

        submissions = (
            LearnerSubmission.objects
            .filter(
                learner=request.user,
                assignment_level__assignment=mapping.assignment,
                context__cohort=mapping.cohort,
            )
            .select_related(
                "assignment_level",
                "assignment_level__assignment",
                "context",
            )
            .prefetch_related(
                "criterion_results__rubric_criterion",
                "process_logs",
            )
            .order_by("-attempt_number")
        )

        attempt_policy = get_attempt_policy(
            learner=request.user,
            cohort=mapping.cohort,
            assignment=mapping.assignment,
        )

        return Response(
            {
                "submissions": LearnerSubmissionSerializer(
                    submissions,
                    many=True,
                ).data,
                "attempt_policy": {
                    "can_submit": attempt_policy.can_submit,
                    "limited_mode": attempt_policy.limited_mode,
                    "attempts_used": attempt_policy.attempts_used,
                    "attempts_remaining": attempt_policy.attempts_remaining,
                    "first_pass_attempt": attempt_policy.first_pass_attempt,
                    "best_score": (
                        str(attempt_policy.best_score)
                        if attempt_policy.best_score is not None
                        else None
                    ),
                },
            }
        )