from rest_framework.permissions import IsAuthenticated
from lms.permissions import IsMappingAdmin
from rest_framework import generics
from ..serializers import ModuleAssignmentSerializer
from ..models import ModuleAssignment
from accounts.audit import record_portal_activity
from accounts.models import PortalActivity
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.db.models.deletion import ProtectedError
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from grading.models import (
    RubricBand,
    RubricCriterion,
    Task,
    TaskCriteriaMapping,
)
from lms.models import AssessmentMapping
from lms.permissions import IsMappingAdmin
from submissions.models import LearnerSubmission, SubmissionContext

class ModuleAssignmentListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = ModuleAssignmentSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = ModuleAssignment.objects.select_related(
            "module",
            "module__qualification",
            "grading_configuration",
        ).order_by(
            "module__module_code",
            "level",
            "assignment_code",
        )

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
        assignment = serializer.save()

        record_portal_activity(
            user=self.request.user,
            action=PortalActivity.Action.CREATED,
            object_type="assignment",
            object_id=assignment.id,
            object_label=assignment.assignment_code,
        )

def build_assignment_delete_impact(assignment):
    level_ids = list(
        assignment.levels.values_list("id", flat=True)
    )

    mappings = list(
        AssessmentMapping.objects
        .filter(assignment=assignment)
        .select_related("cohort")
        .values(
            "id",
            "name",
            "cohort__cohort_code",
            "cohort__cohort_name",
        )
    )

    submission_count = LearnerSubmission.objects.filter(
        assignment_level__assignment=assignment,
    ).count()

    context_count = SubmissionContext.objects.filter(
        assignment_level__assignment=assignment,
    ).count()

    criteria = RubricCriterion.objects.filter(
        assignment_level_id__in=level_ids,
    )

    return {
        "can_delete": (
            len(mappings) == 0
            and submission_count == 0
        ),
        "blockers": {
            "assessment_mappings": [
                {
                    "id": str(item["id"]),
                    "name": item["name"],
                    "cohort": (
                        f'{item["cohort__cohort_code"]} — '
                        f'{item["cohort__cohort_name"]}'
                    ),
                }
                for item in mappings
            ],
            "submissions": submission_count,
        },
        "affected": {
            "assignment_levels": len(level_ids),
            "tasks": Task.objects.filter(
                assignment_level_id__in=level_ids,
            ).count(),
            "rubric_criteria": criteria.count(),
            "rubric_bands": RubricBand.objects.filter(
                rubric_criterion__in=criteria,
            ).count(),
            "task_criteria_mappings": (
                TaskCriteriaMapping.objects.filter(
                    assignment_level_id__in=level_ids,
                ).count()
            ),
            "submission_contexts": context_count,
        },
    }


class ModuleAssignmentDeleteImpactView(APIView):
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get(self, request, id):
        assignment = get_object_or_404(
            ModuleAssignment.objects.all(),
            id=id,
        )
        return Response(
            build_assignment_delete_impact(assignment)
        )


class ModuleAssignmentSafeDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = ModuleAssignmentSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return ModuleAssignment.objects.select_related(
            "module",
            "module__qualification",
            "grading_configuration",
        )

    def perform_update(self, serializer):
        assignment = serializer.save()

        record_portal_activity(
            user=self.request.user,
            action=PortalActivity.Action.UPDATED,
            object_type="assignment",
            object_id=assignment.id,
            object_label=assignment.assignment_code,
        )

    def destroy(self, request, *args, **kwargs):
        assignment = self.get_object()
        impact = build_assignment_delete_impact(assignment)

        if not impact["can_delete"]:
            blockers = []

            mapping_count = len(
                impact["blockers"]["assessment_mappings"]
            )
            if mapping_count:
                blockers.append(
                    f"{mapping_count} LMS assessment mapping(s)"
                )

            submission_count = impact["blockers"]["submissions"]
            if submission_count:
                blockers.append(
                    f"{submission_count} learner submission(s)"
                )

            return Response(
                {
                    "detail": (
                        "This assignment cannot be deleted because "
                        "it is tied to "
                        + " and ".join(blockers)
                        + ". Remove those dependencies first."
                    ),
                    "impact": impact,
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                SubmissionContext.objects.filter(
                    assignment_level__assignment=assignment,
                ).delete()

                record_portal_activity(
                    user=request.user,
                    action=PortalActivity.Action.DELETED,
                    object_type="assignment",
                    object_id=assignment.id,
                    object_label=assignment.assignment_code,
                )

                assignment.delete()

        except ProtectedError:
            return Response(
                {
                    "detail": (
                        "This assignment still has protected related "
                        "records and cannot be deleted."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)
