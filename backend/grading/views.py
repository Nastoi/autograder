import base64
import json
import httpx
from decimal import Decimal
from pydantic import BaseModel, Field
from openai import OpenAI
from .services.submission_grader import map_submission_tasks
from grading.services.submission_grader import grade_submission

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response as DRFResponse
from rest_framework.views import APIView


from django.conf import settings
from django.shortcuts import get_object_or_404

from .schemas import GradingResponseSchema, PDFTaskMappingResponseSchema
from submissions.models import LearnerSubmission, SubmissionPage
from lms.permissions import IsMappingAdmin
from .models import ExtractedEvidence, SubmissionTaskMapping




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
    AIDispatchRequestSerializer,
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
        ).order_by(
            "assignment_level__assignment__assignment_code",
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
        ).order_by(
            "assignment_level__assignment__assignment_code",
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
        ).order_by(
            "rubric_criterion__assignment_level__assignment__assignment_code",
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
        ).order_by(
            "rubric_criterion__assignment_level__assignment__assignment_code",
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
        ).order_by(
            "assignment_level__assignment__assignment_code",
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
        ).order_by(
            "assignment_level__assignment__assignment_code",
            "assignment_level__level_code",
        )


class TaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = Task.objects.select_related(
            "assignment_level",
        ).order_by(
            "assignment_level__assignment__assignment_code",
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
        ).order_by(
            "assignment_level__assignment__assignment_code",
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
        ).order_by(
            "task__assignment_level__assignment__assignment_code",
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
            "task__assignment_level__assignment__assignment_code",
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
            "assignment_level__assignment__assignment_code",
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
            "assignment_level__assignment__assignment_code",
            "task__sequence",
            "rubric_criterion__sequence",
        )


class ExtractedEvidenceListCreateView(generics.ListCreateAPIView):
    serializer_class = ExtractedEvidenceSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = ExtractedEvidence.objects.select_related(
            "submission",
        ).order_by("page_number", "created_at")

        submission_id = self.request.query_params.get("submission_id")
        page_number = self.request.query_params.get("page_number")

        if submission_id:
            queryset = queryset.filter(submission_id=submission_id)

        if page_number:
            queryset = queryset.filter(page_number=page_number)

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


class TaskMappingProcessView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        submission_id = request.data.get("submission_id")

        if not submission_id:
            return DRFResponse(
                {"error": "submission_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        submission = get_object_or_404(
            LearnerSubmission,
            id=submission_id,
        )

        if (
            not hasattr(submission, "context")
            or not submission.context.assignment_level
        ):
            return DRFResponse(
                {
                    "error": (
                        "Submission is missing context "
                        "or assignment level."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = map_submission_tasks(submission)

            return DRFResponse(
                {
                    "submission_id": str(submission.id),
                    "assignment_level": str(
                        submission.context.assignment_level.id
                    ),
                    **result,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return DRFResponse(
                {
                    "error": "Task mapping process failed",
                    "details": str(e),
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

class Gpt4oDispatchView(APIView):
    """
    Step 2: Grades submission using TaskCriteriaMapping (weights & max_score) 
    and task evidence mapped in Step 1. Calculates mathematical totals in Python,
    grouping by Rubric Criterion to ensure max_score is counted uniquely per criterion.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        submission_id = request.data.get("submission_id")

        if not submission_id:
            return DRFResponse(
                {"error": "submission_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        submission = get_object_or_404(
            LearnerSubmission,
            id=submission_id,
        )

        try:
            result = grade_submission(submission)

            return DRFResponse(
                result,
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return DRFResponse(
                {
                    "error": "Grading dispatch failed",
                    "details": str(e),
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
            

# Pydantic Schemas for OpenAI Structured Outputs
class TaskCriterionPair(BaseModel):
    task_code: str = Field(description="The task_code (e.g., T-F-01)")
    rubric_criterion_id: str = Field(description="UUID of the best matching rubric criterion")
    inferred_weight: float = Field(description="Proportional weight percentage for this task under its criterion")
    ai_explanation: str = Field(description="Justification for mapping and difficulty-based weight allocation")


class AutoMappingResponseSchema(BaseModel):
    mappings: list[TaskCriterionPair]


class MapTasksCriteriaView(APIView):
    """
    Automated AI Endpoint: Evaluates all tasks and rubric criteria for an 
    AssignmentLevel and automatically saves TaskCriteriaMapping records to DB.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        assignment_level_id = request.data.get("assignment_level")

        if not assignment_level_id:
            return DRFResponse(
                {"error": "assignment_level is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Load tasks and criteria
        tasks = Task.objects.filter(assignment_level_id=assignment_level_id).order_by("sequence")
        criteria = RubricCriterion.objects.filter(assignment_level_id=assignment_level_id)

        if not tasks.exists() or not criteria.exists():
            return DRFResponse(
                {"error": "Both Tasks and RubricCriteria must exist for this assignment_level."},
                status=status.HTTP_404_NOT_FOUND,
            )

        task_data = [
            {"task_code": t.task_code, "title": t.title, "instructions": t.instructions}
            for t in tasks
        ]
        criteria_data = [
            {"id": str(c.id), "criterion_code": c.criterion_code, "title": c.title, "description": c.description}
            for c in criteria
        ]

        # Fully generalized dynamic prompt requiring 100% task coverage
        user_prompt = (
            f"AVAILABLE ASSIGNMENT TASKS ({len(task_data)} total):\n"
            f"{json.dumps(task_data, indent=2)}\n\n"
            f"AVAILABLE RUBRIC CRITERIA ({len(criteria_data)} total):\n"
            f"{json.dumps(criteria_data, indent=2)}\n\n"

            "MANDATORY TASK-TO-CRITERION MAPPING RULES:\n\n"

            "1. COMPLETE TASK COVERAGE:\n"
            "   - Evaluate EVERY task listed in AVAILABLE ASSIGNMENT TASKS.\n"
            "   - Every task MUST be mapped to at least one genuinely relevant Rubric Criterion.\n"
            "   - Do NOT skip, drop, or omit any task_code.\n\n"

            "2. SEMANTIC ACCURACY:\n"
            "   - Base mappings ONLY on the supplied task title, task instructions, "
            "criterion title, and criterion description.\n"
            "   - Map a task to a criterion only when the task genuinely requires evidence "
            "relevant to that criterion.\n"
            "   - Do NOT create mappings merely because words look similar.\n"
            "   - Do NOT invent requirements, evidence, tasks, criteria, or relationships "
            "that are not supported by the provided content.\n\n"

            "3. MULTI-MAPPING IS ALLOWED AND REQUIRED WHEN APPROPRIATE:\n"
            "   - A single task MAY map to MULTIPLE Rubric Criteria when its instructions "
            "genuinely require evidence for multiple criteria.\n"
            "   - A single Rubric Criterion MAY be supported by MULTIPLE tasks.\n"
            "   - Do not force each task to only one criterion.\n"
            "   - Do not duplicate the same task_code + rubric_criterion_id pair.\n\n"

            "4. CRITERION COVERAGE:\n"
            "   - Consider EVERY Rubric Criterion before producing the final mappings.\n"
            "   - Every criterion should have at least one mapped task when the assignment "
            "tasks genuinely provide evidence for it.\n"
            "   - Do NOT fabricate an unrelated mapping simply to force criterion coverage.\n\n"

            "5. EXACT IDENTIFIERS:\n"
            "   - Use the task_code EXACTLY as provided.\n"
            "   - Use the exact Rubric Criterion 'id' provided in AVAILABLE RUBRIC CRITERIA "
            "as rubric_criterion_id.\n"
            "   - Do NOT invent, shorten, modify, or substitute identifiers.\n\n"

            "6. INFERRED WEIGHT MEANING:\n"
            "   - inferred_weight is a PERCENTAGE from 0.01 to 100.00.\n"
            "   - It represents how much of THAT SPECIFIC criterion's expected evidence "
            "is contributed by the mapped task.\n"
            "   - Weight is relative within each criterion, NOT across the whole assignment.\n\n"

            "7. STRICT 100% WEIGHT NORMALIZATION PER CRITERION:\n"
            "   - For EACH Rubric Criterion independently, the sum of inferred_weight "
            "across ALL tasks mapped to that criterion MUST equal exactly 100.00.\n"
            "   - Example: if Criterion C01 is supported by T01 and T02, valid weights "
            "could be T01 = 60.00 and T02 = 40.00.\n"
            "   - If only one task supports a criterion, that mapping should normally "
            "receive 100.00.\n"
            "   - Allocate weights according to relative scope, effort, difficulty, "
            "technical complexity, and amount of evidence expected from each task.\n\n"

            "8. WEIGHT CONSISTENCY:\n"
            "   - Do NOT use decimal fractions such as 0.60 to mean 60%.\n"
            "   - Use 60.00 to represent 60 percent.\n"
            "   - Never allow the total weight for a criterion to exceed or fall below "
            "100.00.\n\n"

            "9. AI EXPLANATION:\n"
            "   - For every mapping, provide a concise and specific ai_explanation.\n"
            "   - Explain WHY the task provides evidence for that criterion.\n"
            "   - Also explain why its inferred_weight is appropriate relative to other "
            "tasks mapped to the same criterion.\n"
            "   - Base the explanation on the supplied task instructions and criterion "
            "description, not generic assumptions.\n\n"

            "10. FINAL VERIFICATION BEFORE RETURNING:\n"
            "   - Confirm every task_code appears at least once.\n"
            "   - Confirm there are no duplicate task/criterion pairs.\n"
            "   - Confirm every rubric_criterion_id exists in the supplied criterion list.\n"
            "   - Confirm each criterion's mapped weights total exactly 100.00.\n"
            "   - Confirm all mappings are semantically justified.\n"
            "   - Return only data conforming to the required structured output schema."
        )

        try:
            http_client = httpx.Client()
            client = OpenAI(api_key=settings.OPENAI_API_KEY, http_client=http_client)

            completion = client.beta.chat.completions.parse(
                model=settings.OPENAI_API_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert curriculum design evaluator. Align learning tasks to rubric criteria dynamically.",
                    },
                    {"role": "user", "content": user_prompt},
                ],
                response_format=AutoMappingResponseSchema,
                temperature=0.0,
            )

            result = completion.choices[0].message.parsed

            # 2. Python Weight Normalization Step (Guarantees sum == 100.0% per criterion)
            criterion_groups = {}
            for item in result.mappings:
                cid = item.rubric_criterion_id
                if cid not in criterion_groups:
                    criterion_groups[cid] = []
                criterion_groups[cid].append(item)

            for cid, group in criterion_groups.items():
                total_weight = sum(m.inferred_weight for m in group)
                if total_weight > 0 and total_weight != 100.0:
                    for m in group:
                        # Scale raw AI weights proportionally so they sum to 100.0%
                        m.inferred_weight = round((m.inferred_weight / total_weight) * 100.0, 2)

            # 3. Save mappings directly to PostgreSQL
            task_dict = {t.task_code: t for t in tasks}
            criteria_dict = {}

            for c in criteria:
                criteria_dict[str(c.id)] = c
                criteria_dict[c.criterion_code] = c

            created_records = []
            detailed_mappings = []

            print("AI MAPPINGS COUNT:", len(result.mappings))

            for item in result.mappings:
                print(
                    "AI MAP:",
                    repr(item.task_code),
                    repr(item.rubric_criterion_id),
                    repr(item.inferred_weight),
                )

            print("TASK KEYS:", list(task_dict.keys()))
            print("CRITERIA KEYS:", list(criteria_dict.keys()))

            for item in result.mappings:
                task_obj = task_dict.get(item.task_code)
                criterion_obj = criteria_dict.get(str(item.rubric_criterion_id))

                if task_obj and criterion_obj:
                    record, _ = TaskCriteriaMapping.objects.update_or_create(
                        assignment_level_id=assignment_level_id,
                        task=task_obj,
                        rubric_criterion=criterion_obj,
                        defaults={
                            "inferred_weight": Decimal(str(item.inferred_weight)),
                            "ai_explanation": item.ai_explanation,
                        },
                    )
                    created_records.append(record.id)

                    # Enrich response with human-readable criterion details
                    detailed_mappings.append({
                        "task_code": task_obj.task_code,
                        "task_title": task_obj.title,
                        "rubric_criterion": {
                            "id": str(criterion_obj.id),
                            "criterion_code": getattr(criterion_obj, "criterion_code", None),
                            "title": getattr(criterion_obj, "title", None),
                            "description": getattr(criterion_obj, "description", None),
                            "maximum_score": float(getattr(criterion_obj, "maximum_score", 0.0)),
                        },
                        "inferred_weight": float(item.inferred_weight),
                        "ai_explanation": item.ai_explanation,
                    })

            return DRFResponse(
                {
                    "assignment_level": assignment_level_id,
                    "tasks_mapped": len(created_records),
                    "status": "auto_mapped_successfully",
                    "mappings": detailed_mappings,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return DRFResponse(
                {"error": "Auto-mapping failed", "details": str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


       
            