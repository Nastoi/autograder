from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from lms.permissions import IsMappingAdmin

from ..models import (
    AssignmentLevel,
    Cohort,
    Module,
    ModuleAssignment,
)

from ..serializers import (
    ModuleSerializer,
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



class ModuleListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = Module.objects.select_related(
            "qualification",
        )

        qualification_id = self.request.query_params.get(
            "qualification_id",
        )

        if qualification_id:
            queryset = queryset.filter(
                qualification_id=qualification_id,
            )

        return queryset

    def perform_create(self, serializer):
        module = serializer.save()

        record_portal_activity(
            user=self.request.user,
            action=PortalActivity.Action.CREATED,
            object_type="module",
            object_id=module.id,
            object_label=(
                f"{module.module_code} — {module.module_name}"
            ),
        )

class ModuleDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return Module.objects.select_related(
            "qualification",

        ).order_by(
            "qualification__qualification_code",
            "module_code"
        )


    def destroy(self, request, *args, **kwargs):
        module = self.get_object()

        active_cohorts = Cohort.objects.filter(
            module=module,
            is_active=True,
        )

        mappings = AssessmentMapping.objects.filter(
            Q(cohort__module=module)
            | Q(assignment__module=module)
        ).distinct()

        submissions = LearnerSubmission.objects.filter(
            Q(context__cohort__module=module)
            | Q(assignment_level__assignment__module=module)
        ).distinct()

        if active_cohorts.exists():
            return Response(
                {
                    "detail": (
                        "This module cannot be deleted because "
                        "it contains active cohorts. "
                        "Deactivate those cohorts first."
                    ),
                    "blocker": "active_cohorts",
                },
                status=status.HTTP_409_CONFLICT,
            )

        if mappings.exists():
            return Response(
                {
                    "detail": (
                        "This module cannot be deleted because "
                        "it has assessment mappings. "
                        "Remove those mappings first."
                    ),
                    "blocker": "assessment_mappings",
                },
                status=status.HTTP_409_CONFLICT,
            )

        if submissions.exists():
            return Response(
                {
                    "detail": (
                        "This module cannot be deleted because "
                        "learner submissions exist under it. "
                        "Remove those submissions first."
                    ),
                    "blocker": "submissions",
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                SubmissionContext.objects.filter(
                    Q(cohort__module=module)
                    | Q(
                        assignment_level__assignment__module=module
                    )
                ).distinct().delete()

                ModuleAssignment.objects.filter(
                    module=module,
                ).delete()

                Cohort.objects.filter(
                    module=module,
                ).delete()

                record_portal_activity(
                    user=request.user,
                    action=PortalActivity.Action.DELETED,
                    object_type="module",
                    object_id=module.id,
                    object_label=(
                        f"{module.module_code} — {module.module_name}"
                    ),
                )

                module.delete()

        except ProtectedError:
            return Response(
                {
                    "detail": (
                        "This module still has protected related data "
                        "and cannot be deleted."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )


    def perform_update(self, serializer):
        module = serializer.save()

        record_portal_activity(
            user=self.request.user,
            action=PortalActivity.Action.UPDATED,
            object_type="module",
            object_id=module.id,
            object_label=(
                f"{module.module_code} — {module.module_name}"
            ),
        )

class ModuleDeleteImpactView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return Module.objects.select_related(
            "qualification",
        )

    def retrieve(self, request, *args, **kwargs):
        module = self.get_object()

        cohorts = Cohort.objects.filter(
            module=module,
        )

        active_cohorts = cohorts.filter(
            is_active=True,
        )

        assignments = ModuleAssignment.objects.filter(
            module=module,
        )

        levels = AssignmentLevel.objects.filter(
            assignment__module=module,
        )

        mappings = AssessmentMapping.objects.filter(
            Q(cohort__module=module)
            | Q(assignment__module=module)
        ).distinct()

        submissions = LearnerSubmission.objects.filter(
            Q(context__cohort__module=module)
            | Q(assignment_level__assignment__module=module)
        ).distinct()

        submission_contexts = SubmissionContext.objects.filter(
            Q(cohort__module=module)
            | Q(assignment_level__assignment__module=module)
        ).distinct()

        can_delete = (
            not active_cohorts.exists()
            and not mappings.exists()
            and not submissions.exists()
        )

        return Response(
            {
                "can_delete": can_delete,

                "blockers": {
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
                },

                "affected": {
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