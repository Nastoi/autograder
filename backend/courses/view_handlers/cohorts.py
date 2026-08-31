from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from lms.permissions import IsMappingAdmin
from ..serializers import CohortSerializer


from ..models import (
    Cohort,
)

from ..serializers import (
    CohortSerializer,
)

from django.db.models import Q

from lms.models import AssessmentMapping
from submissions.models import (
    LearnerSubmission,
    SubmissionContext,
)
from django.db import transaction
from django.db.models.deletion import ProtectedError
from accounts.audit import record_portal_activity
from accounts.models import PortalActivity


class CohortListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = CohortSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = Cohort.objects.select_related(
            "module",
            "module__qualification",
        ).order_by("cohort_code")

        module_id = self.request.query_params.get(
            "module_id",
        )

        qualification_id = self.request.query_params.get(
            "qualification_id",
        )

        if module_id:
            queryset = queryset.filter(
                module_id=module_id,
            )

        if qualification_id:
            queryset = queryset.filter(
                module__qualification_id=qualification_id,
            )

        return queryset

    def perform_create(self, serializer):
        cohort = serializer.save()

        record_portal_activity(
            user=self.request.user,
            action=PortalActivity.Action.CREATED,
            object_type="cohort",
            object_id=cohort.id,
            object_label=(
                f"{cohort.cohort_code} — {cohort.cohort_name}"
            ),
        )

class CohortDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = CohortSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return Cohort.objects.select_related(
            "module",
            "module__qualification",
        ).order_by("cohort_code")

    def destroy(self, request, *args, **kwargs):
        cohort = self.get_object()

        mappings = AssessmentMapping.objects.filter(
            cohort=cohort,
        )

        submissions = LearnerSubmission.objects.filter(
            context__cohort=cohort,
        ).distinct()

        if mappings.exists():
            return Response(
                {
                    "detail": (
                        "This cohort cannot be deleted because "
                        "it is used in one or more assessment mappings. "
                        "Remove those mappings first."
                    ),
                    "blocker": "assessment_mappings",
                    "assessment_mappings": [
                        {
                            "id": str(mapping.id),
                            "name": mapping.name,
                            "assignment": (
                                mapping.assignment.assignment_code
                            ),
                        }
                        for mapping in mappings.select_related(
                            "assignment",
                        )
                    ],
                },
                status=status.HTTP_409_CONFLICT,
            )

        if submissions.exists():
            return Response(
                {
                    "detail": (
                        "This cohort cannot be deleted because "
                        "learner submissions exist for it. "
                        "Remove those submissions first."
                    ),
                    "blocker": "submissions",
                    "submission_count": submissions.count(),
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                SubmissionContext.objects.filter(
                    cohort=cohort,
                    submissions__isnull=True,
                ).distinct().delete()

                record_portal_activity(
                    user=request.user,
                    action=PortalActivity.Action.DELETED,
                    object_type="cohort",
                    object_id=cohort.id,
                    object_label=(
                        f"{cohort.cohort_code} — {cohort.cohort_name}"
                    ),
                )
                                        
                cohort.delete()

        except ProtectedError:
            return Response(
                {
                    "detail": (
                        "This cohort still has protected related data "
                        "and cannot be deleted."
                    ),
                    "blocker": "protected_related_data",
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )


    def perform_update(self, serializer):
        cohort = serializer.save()

        record_portal_activity(
            user=self.request.user,
            action=PortalActivity.Action.UPDATED,
            object_type="cohort",
            object_id=cohort.id,
            object_label=(
                f"{cohort.cohort_code} — {cohort.cohort_name}"
            ),
        )


class CohortDeleteImpactView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return Cohort.objects.select_related(
            "module",
            "module__qualification",
        )

    def retrieve(self, request, *args, **kwargs):
        cohort = self.get_object()

        mappings = AssessmentMapping.objects.filter(
            cohort=cohort,
        )

        submissions = LearnerSubmission.objects.filter(
            context__cohort=cohort,
        ).distinct()

        empty_contexts = SubmissionContext.objects.filter(
            cohort=cohort,
            submissions__isnull=True,
        ).distinct()

        can_delete = (
            not mappings.exists()
            and not submissions.exists()
        )

        return Response(
            {
                "can_delete": can_delete,
                "blockers": {
                    "assessment_mappings": [
                        {
                            "id": str(mapping.id),
                            "name": mapping.name,
                            "assignment": (
                                mapping.assignment.assignment_code
                            ),
                        }
                        for mapping in mappings.select_related(
                            "assignment",
                        )
                    ],
                    "submissions": submissions.count(),
                },
                "affected": {
                    "submission_contexts": empty_contexts.count(),
                },
            }
        )