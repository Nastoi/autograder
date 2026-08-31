from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from lms.permissions import IsMappingAdmin
from django.shortcuts import get_object_or_404

from ..models import (
    AssignmentLevel,
    Cohort,
    Module,
    ModuleAssignment,
    Qualification,
)

from ..serializers import QualificationSerializer

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


class QualificationListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = QualificationSerializer
    permission_classes = [
        IsAuthenticated,
        IsMappingAdmin,
    ]

    def get_queryset(self):
        return Qualification.objects.order_by("qualification_code")

    def perform_create(self, serializer):
        qualification = serializer.save()

        record_portal_activity(
            user=self.request.user,
            action=PortalActivity.Action.CREATED,
            object_type="qualification",
            object_id=qualification.id,
            object_label=(
                f"{qualification.qualification_code} — "
                f"{qualification.qualification_name}"
            ),
        )


class QualificationDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = QualificationSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return Qualification.objects.order_by("qualification_code")

    def destroy(self, request, *args, **kwargs):
        qualification = self.get_object()

        active_cohorts = Cohort.objects.filter(
            module__qualification=qualification,
            is_active=True,
        )

        mappings = AssessmentMapping.objects.filter(
            Q(
                cohort__module__qualification=qualification,
            )
            | Q(
                assignment__module__qualification=qualification,
            )
        ).distinct()

        submissions = LearnerSubmission.objects.filter(
            Q(
                context__cohort__module__qualification=qualification,
            )
            | Q(
                assignment_level__assignment__module__qualification=(
                    qualification
                ),
            )
        ).distinct()

        # --------------------------------------------------
        # Strict blocker 1: active cohorts
        # --------------------------------------------------
        if active_cohorts.exists():
            return Response(
                {
                    "detail": (
                        "This qualification cannot be deleted because "
                        "it contains one or more active cohorts. "
                        "Deactivate those cohorts first."
                    ),
                    "blocker": "active_cohorts",
                    "active_cohorts": [
                        {
                            "id": str(cohort.id),
                            "code": cohort.cohort_code,
                            "name": cohort.cohort_name,
                        }
                        for cohort in active_cohorts
                    ],
                },
                status=status.HTTP_409_CONFLICT,
            )

        # --------------------------------------------------
        # Strict blocker 2: assessment mappings
        # --------------------------------------------------
        if mappings.exists():
            return Response(
                {
                    "detail": (
                        "This qualification cannot be deleted because "
                        "one or more assignments or cohorts are used in "
                        "assessment mappings. Remove those mappings first."
                    ),
                    "blocker": "assessment_mappings",
                    "assessment_mappings": [
                        {
                            "id": str(mapping.id),
                            "name": mapping.name,
                            "cohort": mapping.cohort.cohort_code,
                            "assignment": (
                                mapping.assignment.assignment_code
                            ),
                        }
                        for mapping in mappings.select_related(
                            "cohort",
                            "assignment",
                        )
                    ],
                },
                status=status.HTTP_409_CONFLICT,
            )

        # --------------------------------------------------
        # Strict blocker 3: learner submissions
        # --------------------------------------------------
        if submissions.exists():
            return Response(
                {
                    "detail": (
                        "This qualification cannot be deleted because "
                        "learner submissions exist for assignments under "
                        "this qualification. Remove those submissions first."
                    ),
                    "blocker": "submissions",
                    "submission_count": submissions.count(),
                },
                status=status.HTTP_409_CONFLICT,
            )

        # --------------------------------------------------
        # No strict blockers: remove children bottom-up
        # --------------------------------------------------
        try:
            with transaction.atomic():
                SubmissionContext.objects.filter(
                    Q(
                        cohort__module__qualification=qualification,
                    )
                    | Q(
                        assignment_level__assignment__module__qualification=(
                            qualification
                        ),
                    )
                ).distinct().delete()

                ModuleAssignment.objects.filter(
                    module__qualification=qualification,
                ).delete()

                Cohort.objects.filter(
                    module__qualification=qualification,
                ).delete()

                Module.objects.filter(
                    qualification=qualification,
                ).delete()


                record_portal_activity(
                    user=request.user,
                    action=PortalActivity.Action.DELETED,
                    object_type="qualification",
                    object_id=qualification.id,
                    object_label=(
                        f"{qualification.qualification_code} — {qualification.qualification_name}"
                    ),
                )
                qualification.delete()

        except ProtectedError:
            return Response(
                {
                    "detail": (
                        "This qualification still has protected related "
                        "records and cannot be deleted. Remove the related "
                        "records first."
                    ),
                    "blocker": "protected_related_data",
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )

    def perform_update(self, serializer):
        qualification = serializer.save()

        record_portal_activity(
            user=self.request.user,
            action=PortalActivity.Action.UPDATED,
            object_type="qualification",
            object_id=qualification.id,
            object_label=(
                f"{qualification.qualification_code} — "
                f"{qualification.qualification_name}"
            ),
        )

class QualificationDeleteImpactView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return Qualification.objects.order_by(
            "qualification_code",
        )

    def retrieve(self, request, *args, **kwargs):
        qualification = self.get_object()

        modules = Module.objects.filter(
            qualification=qualification,
        )

        cohorts = Cohort.objects.filter(
            module__qualification=qualification,
        )

        active_cohorts = cohorts.filter(
            is_active=True,
        )

        assignments = ModuleAssignment.objects.filter(
            module__qualification=qualification,
        )

        levels = AssignmentLevel.objects.filter(
            assignment__module__qualification=qualification,
        )

        mappings = AssessmentMapping.objects.filter(
            Q(
                cohort__module__qualification=qualification,
            )
            | Q(
                assignment__module__qualification=qualification,
            )
        ).distinct()

        submissions = LearnerSubmission.objects.filter(
            assignment_level__assignment__module__qualification=(
                qualification
            ),
        ).distinct()

        submission_contexts = SubmissionContext.objects.filter(
            Q(
                cohort__module__qualification=qualification,
            )
            | Q(
                assignment_level__assignment__module__qualification=(
                    qualification
                ),
            )
        ).distinct()

        blockers = {
            "active_cohorts": [
                {
                    "id": str(cohort.id),
                    "code": cohort.cohort_code,
                    "name": cohort.cohort_name,
                }
                for cohort in active_cohorts
            ],
            "assessment_mappings": [
                {
                    "id": str(mapping.id),
                    "name": mapping.name,
                    "cohort": mapping.cohort.cohort_code,
                    "assignment": (
                        mapping.assignment.assignment_code
                    ),
                }
                for mapping in mappings.select_related(
                    "cohort",
                    "assignment",
                )
            ],
            "submissions": submissions.count(),
        }

        can_delete = (
            not active_cohorts.exists()
            and not mappings.exists()
            and not submissions.exists()
        )

        return Response(
            {
                "can_delete": can_delete,
                "blockers": blockers,
                "affected": {
                    "modules": modules.count(),
                    "inactive_cohorts": cohorts.filter(
                        is_active=False,
                    ).count(),
                    "assignments": assignments.count(),
                    "assignment_levels": levels.count(),
                    "submission_contexts": (
                        submission_contexts.count()
                    ),
                },
            }
        )