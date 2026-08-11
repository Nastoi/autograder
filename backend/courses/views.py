from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from lms.permissions import IsMappingAdmin

from .models import (
    Cohort,
    Module,
    ModuleAssignment,
    Qualification,
)

from .serializers import (
    CohortSerializer,
    ModuleAssignmentSerializer,
    ModuleSerializer,
    QualificationSerializer,
)


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
            .order_by("cohort_code")
        )

    def list(self, request, *args, **kwargs):
        cohorts = self.get_queryset()

        data = [
            {
                "id": cohort.id,
                "cohort_code": cohort.cohort_code,
                "cohort_name": cohort.cohort_name,
                "module": {
                    "id": str(cohort.module.id),
                    "module_code": cohort.module.module_code,
                    "module_name": cohort.module.module_name,
                },
                "qualification": {
                    "id": str(cohort.module.qualification.id),
                    "qualification_code": (
                        cohort.module.qualification.qualification_code
                    ),
                                        "qualification_name": (
                        cohort.module.qualification.qualification_name
                    ),
                },
            }
            for cohort in cohorts
        ]

        return Response(data)

# from .models import AssignmentLevel


# class AssignmentLevelListView(generics.ListAPIView):
#     permission_classes = [
#         IsAuthenticated,
#         IsMappingAdmin,
#     ]

#     def get_queryset(self):
#         queryset = (
#             AssignmentLevel.objects
#             .select_related(
#                 "assignment",
#                 "assignment__module",
#             )
#             .filter(is_active=True)
#             .order_by(
#                 "assignment__assignment_number",
#                 "level_code",
#             )
#         )

#         module_id = self.request.query_params.get("module_id")

#         if module_id:
#             queryset = queryset.filter(
#                 assignment__module_id=module_id,
#             )

#         return queryset

#     def list(self, request, *args, **kwargs):
#         levels = self.get_queryset()

#         data = [
#             {
#                 "id": str(level.id),
#                 "level_code": level.level_code,
#                 "display_name": level.display_name,
#                 "version": level.version,
#                 "configuration_status": (
#                     level.configuration_status
#                 ),
#                 "assignment": {
#                     "id": str(level.assignment.id),
#                     "code": level.assignment.assignment_code,
#                     "title": level.assignment.assignment_title,
#                     "assignment_number": (
#                         level.assignment.assignment_number
#                     ),
#                     "maximum_score": str(
#                         level.assignment.maximum_score
#                     ),
#                 },
#                 "module": {
#                     "id": str(level.assignment.module.id),
#                     "code": level.assignment.module.module_code,
#                     "name": level.assignment.module.module_name,
#                 },
#             }
#             for level in levels
#         ]

#         from rest_framework.response import Response

#         return Response(data)


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

        if qualification.modules.exists():
            return Response(
                {
                    "detail": (
                        "This qualification cannot be deleted "
                        "because it already contains modules. "
                        "Deactivate it instead."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        return super().destroy(request, *args, **kwargs)


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


class ModuleDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return Module.objects.select_related(
            "qualification",
        ).order_by("module_code")

    def destroy(self, request, *args, **kwargs):
        module = self.get_object()

        if (
            module.cohorts.exists()
            or module.assignments.exists()
        ):
            return Response(
                {
                    "detail": (
                        "This module cannot be deleted because "
                        "it already contains cohorts or assignments. "
                        "Deactivate it instead."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        return super().destroy(request, *args, **kwargs)

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

        if cohort.enrolments.exists():
            return Response(
                {
                    "detail": (
                        "This cohort cannot be deleted because "
                        "it already has learner enrolments. "
                        "Deactivate it instead."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        return super().destroy(request, *args, **kwargs)


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


class ModuleAssignmentDetailView(
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
        ).order_by(
            "module__module_code",
            "level",
            "assignment_code",
        )

    def destroy(self, request, *args, **kwargs):
        assignment = self.get_object()

        if (
            assignment.rubric_criteria.exists()
            or assignment.rag_sources.exists()
            or assignment.grading_tasks.exists()
            or assignment.task_criteria_mappings.exists()
            or hasattr(assignment, "ai_grading_profile")
        ):
            return Response(
                {
                    "detail": (
                        "This assignment cannot be deleted because "
                        "it already has grading configuration. "
                        "Deactivate it instead."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        return super().destroy(request, *args, **kwargs)


AssignmentLevelListCreateView = ModuleAssignmentListCreateView
AssignmentLevelDetailView = ModuleAssignmentDetailView
