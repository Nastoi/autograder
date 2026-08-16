from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from lms.permissions import IsMappingAdmin

from .models import (
    AssignmentLevel,
    Cohort,
    Module,
    ModuleAssignment,
    Qualification,
)

from .serializers import (
    AssignmentLevelSerializer,
    CohortSerializer,
    ModuleAssignmentSerializer,
    ModuleSerializer,
    QualificationSerializer,
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

        if assignment.levels.filter(
            rubric_criteria__isnull=False,
        ).exists():
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

        record_portal_activity(
            user=request.user,
            action=PortalActivity.Action.DELETED,
            object_type="assignment",
            object_id=assignment.id,
            object_label=assignment.assignment_code,
        )

        return super().destroy(request, *args, **kwargs)


    def perform_update(self, serializer):
        assignment = serializer.save()

        record_portal_activity(
            user=self.request.user,
            action=PortalActivity.Action.UPDATED,
            object_type="assignment",
            object_id=assignment.id,
            object_label=assignment.assignment_code,
        )

class AssignmentLevelListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = AssignmentLevelSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = AssignmentLevel.objects.select_related(
            "assignment",
            "assignment__module",
            "assignment__module__qualification",
            "grading_configuration",
        ).order_by(
            "assignment__assignment_code",
            "level_code",
        )

        module_id = self.request.query_params.get("module_id")
        assignment_id = self.request.query_params.get("assignment_id")

        if module_id:
            queryset = queryset.filter(
                assignment__module_id=module_id,
            )

        if assignment_id:
            queryset = queryset.filter(
                assignment_id=assignment_id,
            )

        return queryset


class AssignmentLevelDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = AssignmentLevelSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return AssignmentLevel.objects.select_related(
            "assignment",
            "assignment__module",
            "assignment__module__qualification",
            "grading_configuration",
        ).order_by(
            "assignment__assignment_code",
            "level_code",
        )

    def destroy(self, request, *args, **kwargs):
        level = self.get_object()

        if (
            level.rubric_criteria.exists()
            or level.rag_sources.exists()
            or level.grading_tasks.exists()
            or level.task_criteria_mappings.exists()
            or hasattr(level, "ai_grading_profile")
        ):
            return Response(
                {
                    "detail": (
                        "This grading level cannot be deleted because "
                        "it already has grading configuration or related data. "
                        "Deactivate it instead."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        return super().destroy(request, *args, **kwargs)
