from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response as DRFResponse

from lms.permissions import IsMappingAdmin

from .models import (
    AIGradingProfile,
    CriterionResult,
    ExtractedEvidence,
    GradingConfiguration,
    Prompt,
    Response,
    RubricBand,
    RubricCriterion,
    Task,
    TaskCriterionWeight,
    TaskCriteriaMapping,
    TaskEvidenceMap,
)

from .serializers import (
    AIGradingProfileSerializer,
    CriterionResultSerializer,
    ExtractedEvidenceSerializer,
    GradingConfigurationSerializer,
    PromptSerializer,
    ResponseSerializer,
    RubricBandSerializer,
    RubricCriterionSerializer,
    TaskCriteriaMappingSerializer,
    TaskCriterionWeightSerializer,
    TaskEvidenceMapSerializer,
    TaskSerializer,
)


class GradingConfigurationListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = GradingConfigurationSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        return GradingConfiguration.objects.order_by(
            "grading_config_code",
        )


class GradingConfigurationDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = GradingConfigurationSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return GradingConfiguration.objects.order_by("grading_config_code")

    def destroy(self, request, *args, **kwargs):
        configuration = self.get_object()

        if configuration.assignment_levels.exists():
            return DRFResponse(
                {
                    "detail": (
                        "This grading configuration cannot be deleted "
                        "because it is already used by assignment levels. "
                        "Deactivate it instead."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        return super().destroy(request, *args, **kwargs)



class RubricCriterionListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = RubricCriterionSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = RubricCriterion.objects.select_related(
            "assignment_level",
            "assignment_level__assignment",
        ).order_by(
            "assignment_level__assignment",
            "sequence",
        )

        assignment_level_id = self.request.query_params.get(
            "assignment_level_id",
        )

        if assignment_level_id:
            queryset = queryset.filter(
                assignment_level_id=assignment_level_id,
            )

        return queryset


class RubricCriterionDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = RubricCriterionSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return RubricCriterion.objects.select_related(
            "assignment_level",
            "assignment_level__assignment",
        ).order_by(
            "assignment_level__assignment__code",
            "sequence",
        )

    def destroy(self, request, *args, **kwargs):
        criterion = self.get_object()

        if criterion.bands.exists():
            return DRFResponse(
                {
                    "detail": (
                        "This rubric criterion cannot be deleted "
                        "because it already has rubric bands."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        return super().destroy(request, *args, **kwargs)


class RubricBandListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = RubricBandSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = RubricBand.objects.select_related(
            "rubric_criterion",
            "rubric_criterion__assignment_level",
            "rubric_criterion__assignment_level__assignment",
        ).order_by(
            "rubric_criterion__assignment_level__assignment",
            "rubric_criterion__sequence",
            "sequence",
        )

        rubric_criterion_id = self.request.query_params.get(
            "rubric_criterion_id",
        )

        assignment_level_id = self.request.query_params.get(
            "assignment_level_id",
        )

        if rubric_criterion_id:
            queryset = queryset.filter(
                rubric_criterion_id=rubric_criterion_id,
            )

        if assignment_level_id:
            queryset = queryset.filter(
                rubric_criterion__assignment_level_id=
                    assignment_level_id,
            )

        return queryset


class RubricBandDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = RubricBandSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return RubricBand.objects.select_related(
            "rubric_criterion",
            "rubric_criterion__assignment_level",
            "rubric_criterion__assignment_level__assignment",
        ).order_by(
            "rubric_criterion__assignment_level__assignment__code",
            "rubric_criterion__sequence",
            "sequence",
        )

class AIGradingProfileListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = AIGradingProfileSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = AIGradingProfile.objects.select_related(
            "assignment_level",
            "assignment_level__assignment",
        ).order_by(
            "assignment_level__assignment__code",
            "assignment_level__level_code",
        )

        assignment_level_id = self.request.query_params.get(
            "assignment_level_id",
        )

        if assignment_level_id:
            queryset = queryset.filter(
                assignment_level_id=assignment_level_id,
            )

        return queryset


class AIGradingProfileDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = AIGradingProfileSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return AIGradingProfile.objects.select_related(
            "assignment_level",
            "assignment_level__assignment",
        ).order_by(
            "assignment_level__assignment__code",
            "assignment_level__level_code",
        )


class TaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = Task.objects.select_related(
            "assignment_level",
            "assignment_level__assignment",
        ).order_by(
            "assignment_level__assignment",
            "sequence",
        )

        assignment_level_id = self.request.query_params.get(
            "assignment_level_id",
        )

        if assignment_level_id:
            queryset = queryset.filter(
                assignment_level_id=assignment_level_id,
            )

        return queryset


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return Task.objects.select_related(
            "assignment_level",
            "assignment_level__assignment",
        ).order_by(
            "assignment_level__assignment__code",
            "sequence",
        )


class TaskCriterionWeightListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskCriterionWeightSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = TaskCriterionWeight.objects.select_related(
            "task",
            "rubric_criterion",
            "rubric_criterion__assignment_level",
            "rubric_criterion__assignment_level__assignment",
        ).order_by(
            "task__assignment_level__assignment__code",
            "task__sequence",
            "rubric_criterion__sequence",
        )

        task_id = self.request.query_params.get("task_id")
        rubric_criterion_id = self.request.query_params.get("rubric_criterion_id")

        if task_id:
            queryset = queryset.filter(task_id=task_id)

        if rubric_criterion_id:
            queryset = queryset.filter(
                rubric_criterion_id=rubric_criterion_id,
            )

        return queryset


class TaskCriterionWeightDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = TaskCriterionWeightSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return TaskCriterionWeight.objects.select_related(
            "task",
            "rubric_criterion",
        ).order_by(
            "task__assignment_level__assignment__code",
            "task__sequence",
            "rubric_criterion__sequence",
        )


class TaskCriteriaMappingListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskCriteriaMappingSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = TaskCriteriaMapping.objects.select_related(
            "assignment_level",
            "task",
            "rubric_criterion",
        ).order_by(
            "assignment_level__assignment__code",
            "task__sequence",
            "rubric_criterion__sequence",
        )

        assignment_level_id = self.request.query_params.get(
            "assignment_level_id",
        )
        task_id = self.request.query_params.get("task_id")
        rubric_criterion_id = self.request.query_params.get(
            "rubric_criterion_id",
        )

        if assignment_level_id:
            queryset = queryset.filter(
                assignment_level_id=assignment_level_id,
            )

        if task_id:
            queryset = queryset.filter(task_id=task_id)

        if rubric_criterion_id:
            queryset = queryset.filter(
                rubric_criterion_id=rubric_criterion_id,
            )

        return queryset


class TaskCriteriaMappingDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = TaskCriteriaMappingSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return TaskCriteriaMapping.objects.select_related(
            "assignment_level",
            "task",
            "rubric_criterion",
        ).order_by(
            "assignment_level__assignment__code",
            "task__sequence",
            "rubric_criterion__sequence",
        )


class ExtractedEvidenceListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = ExtractedEvidenceSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = ExtractedEvidence.objects.select_related(
            "submission",
        ).order_by("created_at")

        submission_id = self.request.query_params.get("submission_id")
        evidence_type = self.request.query_params.get("evidence_type")

        if submission_id:
            queryset = queryset.filter(submission_id=submission_id)

        if evidence_type:
            queryset = queryset.filter(evidence_type=evidence_type)

        return queryset


class ExtractedEvidenceDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = ExtractedEvidenceSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return ExtractedEvidence.objects.select_related(
            "submission",
        ).order_by("created_at")


class TaskEvidenceMapListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = TaskEvidenceMapSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = TaskEvidenceMap.objects.select_related(
            "task",
            "evidence",
        ).order_by("id")

        task_id = self.request.query_params.get("task_id")
        evidence_id = self.request.query_params.get("evidence_id")

        if task_id:
            queryset = queryset.filter(task_id=task_id)

        if evidence_id:
            queryset = queryset.filter(evidence_id=evidence_id)

        return queryset


class TaskEvidenceMapDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = TaskEvidenceMapSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return TaskEvidenceMap.objects.select_related(
            "task",
            "evidence",
        ).order_by("id")


class PromptListCreateView(generics.ListCreateAPIView):
    serializer_class = PromptSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = Prompt.objects.select_related(
            "submission",
        ).order_by("created_at")

        submission_id = self.request.query_params.get("submission_id")
        stage = self.request.query_params.get("stage")

        if submission_id:
            queryset = queryset.filter(submission_id=submission_id)

        if stage:
            queryset = queryset.filter(stage=stage)

        return queryset


class PromptDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = PromptSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return Prompt.objects.select_related(
            "submission",
        ).order_by("created_at")


class ResponseListCreateView(generics.ListCreateAPIView):
    serializer_class = ResponseSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = Response.objects.select_related(
            "prompt",
        ).order_by("created_at")

        prompt_id = self.request.query_params.get("prompt_id")

        if prompt_id:
            queryset = queryset.filter(prompt_id=prompt_id)

        return queryset


class ResponseDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = ResponseSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return Response.objects.select_related(
            "prompt",
        ).order_by("created_at")


class CriterionResultListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = CriterionResultSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = CriterionResult.objects.select_related(
            "submission",
            "rubric_criterion",
            "rubric_criterion__assignment_level",
        ).order_by("created_at")

        submission_id = self.request.query_params.get("submission_id")
        rubric_criterion_id = self.request.query_params.get("rubric_criterion_id")

        if submission_id:
            queryset = queryset.filter(submission_id=submission_id)

        if rubric_criterion_id:
            queryset = queryset.filter(
                rubric_criterion_id=rubric_criterion_id,
            )

        return queryset


class CriterionResultDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = CriterionResultSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return CriterionResult.objects.select_related(
            "submission",
            "rubric_criterion",
        ).order_by("created_at")
