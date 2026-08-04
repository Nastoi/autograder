from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from lms.permissions import IsMappingAdmin

from .models import AssignmentLevel, Cohort
from rest_framework import generics, status
from rest_framework.response import Response

from .models import AssignmentLevel, Cohort, Qualification
from .serializers import QualificationSerializer


class CohortListView(generics.ListAPIView):
    permission_classes = [
        IsAuthenticated,
        IsMappingAdmin,
    ]

    def get_queryset(self):
        return (
            Cohort.objects
            .select_related("module", "module__qualification")
            .filter(is_active=True)
            .order_by("code")
        )

    def list(self, request, *args, **kwargs):
        cohorts = self.get_queryset()

        data = [
            {
                "id": cohort.id,
                "code": cohort.code,
                "name": cohort.name,
                "module": {
                    "id": str(cohort.module.id),
                    "code": cohort.module.code,
                    "name": cohort.module.name,
                },
                "qualification": {
                    "id": str(cohort.module.qualification.id),
                    "code": cohort.module.qualification.code,
                    "name": cohort.module.qualification.name,
                },
            }
            for cohort in cohorts
        ]

        from rest_framework.response import Response

        return Response(data)

from .models import AssignmentLevel


class AssignmentLevelListView(generics.ListAPIView):
    permission_classes = [
        IsAuthenticated,
        IsMappingAdmin,
    ]

    def get_queryset(self):
        queryset = (
            AssignmentLevel.objects
            .select_related(
                "assignment",
                "assignment__module",
            )
            .filter(is_active=True)
            .order_by(
                "assignment__assignment_number",
                "level_code",
            )
        )

        module_id = self.request.query_params.get("module_id")

        if module_id:
            queryset = queryset.filter(
                assignment__module_id=module_id,
            )

        return queryset

    def list(self, request, *args, **kwargs):
        levels = self.get_queryset()

        data = [
            {
                "id": str(level.id),
                "level_code": level.level_code,
                "display_name": level.display_name,
                "version": level.version,
                "configuration_status": (
                    level.configuration_status
                ),
                "assignment": {
                    "id": str(level.assignment.id),
                    "code": level.assignment.code,
                    "title": level.assignment.title,
                    "assignment_number": (
                        level.assignment.assignment_number
                    ),
                    "maximum_score": str(
                        level.assignment.maximum_score
                    ),
                },
                "module": {
                    "id": str(level.assignment.module.id),
                    "code": level.assignment.module.code,
                    "name": level.assignment.module.name,
                },
            }
            for level in levels
        ]

        from rest_framework.response import Response

        return Response(data)


class QualificationListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = QualificationSerializer
    permission_classes = [
        IsAuthenticated,
        IsMappingAdmin,
    ]

    def get_queryset(self):
        return Qualification.objects.order_by("code")