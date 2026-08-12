import base64
import json
import httpx
from decimal import Decimal
from pydantic import BaseModel, Field
from openai import OpenAI


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
            "assignment_level__assignment_code",
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
            "assignment_level__assignment_code",
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
            "rubric_criterion__assignment_level__assignment_code",
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
            "rubric_criterion__assignment_level__assignment_code",
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
            "assignment_level__assignment_code",
            "assignment_level__level",
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
            "assignment_level__assignment_code",
            "assignment_level__level",
        )


class TaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = Task.objects.select_related(
            "assignment_level",
        ).order_by(
            "assignment_level__assignment_code",
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
            "assignment_level__assignment_code",
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
            "task__assignment_level__assignment_code",
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
            "task__assignment_level__assignment_code",
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
            "assignment_level__assignment_code",
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
            "assignment_level__assignment_code",
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

        # 1. Fetch Learner Submission and related Assignment Tasks
        submission = get_object_or_404(LearnerSubmission, id=submission_id)

        if not hasattr(submission, "context") or not submission.context.assignment_level:
            return DRFResponse(
                {"error": "Submission is missing context or assignment level."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment_level = submission.context.assignment_level
        tasks = Task.objects.filter(assignment_level=assignment_level).order_by("sequence")

        if not tasks.exists():
            return DRFResponse(
                {"error": f"No tasks found for AssignmentLevel {assignment_level.id}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Build task definitions list
        task_definitions = [
            {
                "task_code": task.task_code,
                "title": task.title,
                "instructions": task.instructions,
            }
            for task in tasks
        ]

        # 2. Primary lookup on SubmissionPage (Guarantees layout data is available)
        submission_pages = SubmissionPage.objects.filter(
            submission_id=submission_id
        ).order_by("page_number")

        total_pages = submission_pages.count()

        if total_pages == 0:
            return DRFResponse(
                {"error": f"No submission pages found for submission {submission_id}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Pre-fetch ExtractedEvidence text into an O(1) dictionary lookup
        evidence_text_map = {
            ev.page_number: ev.content_text
            for ev in ExtractedEvidence.objects.filter(submission_id=submission_id)
            if ev.content_text
        }

        # 3. Construct user message payload with strict metadata framing
        user_content = [
            {
                "type": "text",
                "text": (
                    f"CRITICAL DOCUMENT METADATA:\n"
                    f"- THIS DOCUMENT HAS EXACTLY {total_pages} PAGES (Pages 1 to {total_pages}).\n"
                    f"- DO NOT MAP ANY PAGE NUMBER GREATER THAN {total_pages}.\n"
                    f"- A SINGLE PAGE CAN CONTAIN EVIDENCE FOR MULTIPLE TASKS.\n\n"
                    f"Target Assignment Tasks to Map:\n{json.dumps(task_definitions, indent=2)}\n\n"
                    "Examine the page text and images below and map relevant task_codes to exact page numbers."
                ),
            }
        ]

        # Append page-by-page text snippets and image data from SubmissionPage
        for page in submission_pages:
            page_num = page.page_number

            user_content.append(
                {
                    "type": "text",
                    "text": f"=== START OF PAGE {page_num} OF {total_pages} ===",
                }
            )

            # Combine page text sources (ExtractedEvidence preferred, fallback to SubmissionPage text)
            page_text = evidence_text_map.get(page_num) or getattr(page, "extracted_text", None)
            if page_text:
                user_content.append(
                    {
                        "type": "text",
                        "text": f"Page {page_num} Extracted Text:\n{page_text}",
                    }
                )

            # Attach page image (Binary blob or Hosted URL)
            if getattr(page, "image_data", None):
                b64_image = base64.b64encode(page.image_data).decode("utf-8")
                mime_type = getattr(page, "image_mime_type", "image/webp")
                user_content.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{b64_image}"},
                    }
                )
            elif getattr(page, "image_url", None):
                user_content.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": page.image_url},
                    }
                )

        # 4. Define AI System Prompt with Semantic & Multi-Task Matching Rules
        system_prompt = (
            "You are an expert academic evaluator and document structure mapper.\n\n"
            "YOUR GOAL:\n"
            "Analyze the submitted document pages and map each assignment task (by task_code) "
            "to the PDF page numbers that contain evidence of that task being executed or documented.\n\n"
            "RULES:\n"
            f"1. HARD PAGE LIMIT: The document provided has EXACTLY {total_pages} pages. You MUST NOT map any page number higher than {total_pages}.\n"
            "2. MULTI-TASK PAGES: A single page CAN contain evidence for multiple tasks. Map every task independently.\n"
            "3. SEMANTIC MATCHING: Task instructions are generic (e.g., 'Handle blank and null values'), while student submissions contain specific implementation details (e.g., 'replaced nulls with 0'). Count these as a MATCH.\n"
            "4. UNRELATED DOCUMENTS: If the document is completely unrelated to the subject matter (e.g., a recipe or invoice), set 'is_unrelated_document': true and leave mapped pages empty.\n"
            "5. MISSING TASKS: If a task was not attempted in the submission, set 'is_relevant': false and 'mapped_page_numbers': []."
        )

        try:
            # Explicit httpx client to prevent transport/proxy errors
            http_client = httpx.Client()
            client = OpenAI(
                api_key=settings.OPENAI_API_KEY,
                http_client=http_client
            )

            # OpenAI Structured Outputs call
            completion = client.beta.chat.completions.parse(
                model=settings.OPENAI_API_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                response_format=PDFTaskMappingResponseSchema,
                temperature=0.0,
            )

            mapping_data = completion.choices[0].message.parsed

            # 5. Backend Sanitization & Database Persistence
            saved_records = []
            for item in mapping_data.task_mappings:
                # Filter out hallucinated page numbers exceeding total_pages
                valid_pages = [
                    page_num
                    for page_num in item.mapped_page_numbers
                    if 1 <= page_num <= total_pages
                ]

                is_valid = item.is_relevant and len(valid_pages) > 0

                record, _ = SubmissionTaskMapping.objects.update_or_create(
                    submission=submission,
                    task_id=item.task_id,
                    defaults={
                        "task_description": item.task_description,
                        "mapped_page_numbers": valid_pages if is_valid else [],
                        "confidence_score": item.confidence_score if is_valid else 0.0,
                        "justification": item.justification,
                    },
                )
                saved_records.append(record.id)

            return DRFResponse(
                {
                    "submission_id": str(submission.id),
                    "assignment_level": str(assignment_level.id),
                    "total_pdf_pages": total_pages,
                    "tasks_processed": len(task_definitions),
                    "saved_mappings_count": len(saved_records),
                    "mapping_data": mapping_data.model_dump(),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return DRFResponse(
                {"error": "Task mapping process failed", "details": str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class Gpt4oDispatchView(APIView):
    """
    Step 2: Grades submission using TaskCriteriaMapping (weights & max_score) 
    and task evidence mapped in Step 1. Calculates mathematical totals in Python.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        submission_id = request.data.get("submission_id")

        if not submission_id:
            return DRFResponse(
                {"error": "submission_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        submission = get_object_or_404(LearnerSubmission, id=submission_id)

        # Fetch Task-to-Page mappings (Step 1 output)
        task_mappings = SubmissionTaskMapping.objects.filter(submission=submission)
        if not task_mappings.exists():
            return DRFResponse(
                {
                    "error": (
                        f"No task mappings found for submission {submission_id}. "
                        "Run /task-mapping/ first."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fetch Task-to-Criteria mappings (Weights and Maximum Score)
        assignment_level = submission.context.assignment_level
        criteria_mappings = TaskCriteriaMapping.objects.filter(
            assignment_level=assignment_level
        ).select_related("task", "rubric_criterion")

        if not criteria_mappings.exists():
            return DRFResponse(
                {"error": f"No task criteria mappings found for AssignmentLevel {assignment_level.id}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        submission_pages = {
            page.page_number: page
            for page in SubmissionPage.objects.filter(submission=submission)
        }

        task_pages_map = {m.task_id: m.mapped_page_numbers for m in task_mappings}

        user_content = [
            {
                "type": "text",
                "text": (
                    f"Grading Evaluation for Submission ID: {submission_id}.\n"
                    "Evaluate each task/criterion against its mapped page evidence and output a score_percentage (0 to 100).\n"
                ),
            }
        ]

        criteria_weight_map = {}

        for cm in criteria_mappings:
            task_code = cm.task.task_code
            criterion_id = str(cm.rubric_criterion.id)
            
            # Store maximum_score & inferred_weight for Python calculation
            criteria_weight_map[f"{task_code}_{criterion_id}"] = {
                "weight": float(cm.inferred_weight),
                "max_score": float(cm.rubric_criterion.maximum_score),
            }

            mapped_pages = task_pages_map.get(task_code, [])

            user_content.append(
                {
                    "type": "text",
                    "text": (
                        f"\n=== CRITERION EVALUATION TARGET ===\n"
                        f"Task Code: {task_code}\n"
                        f"Rubric Criterion ID: {criterion_id}\n"
                        f"Task Instruction: {cm.task.instructions}\n"
                        f"Mapped Evidence Pages: {mapped_pages if mapped_pages else 'NO EVIDENCE FOUND'}\n"
                    ),
                }
            )

            for page_num in mapped_pages:
                page_obj = submission_pages.get(page_num)
                if not page_obj:
                    continue

                if getattr(page_obj, "extracted_text", None):
                    user_content.append(
                        {
                            "type": "text",
                            "text": f"--- [Page {page_num} Text for {task_code}] ---\n{page_obj.extracted_text}",
                        }
                    )

                if getattr(page_obj, "image_data", None):
                    b64_image = base64.b64encode(page_obj.image_data).decode("utf-8")
                    mime_type = getattr(page_obj, "image_mime_type", "image/webp")
                    user_content.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{b64_image}"},
                        }
                    )

        system_prompt = (
            "You are an academic grader. Evaluate the evidence provided for each task/criterion. "
            "For each target, assign a score_percentage between 0.0 and 100.0 based on completion quality."
        )

        try:
            http_client = httpx.Client()
            client = OpenAI(api_key=settings.OPENAI_API_KEY, http_client=http_client)

            completion = client.beta.chat.completions.parse(
                model=settings.OPENAI_API_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                response_format=GradingResponseSchema,
                temperature=0.1,
            )

            grading_result = completion.choices[0].message.parsed

            # Mathematical Totaling in Python
            total_earned_points = 0.0
            total_max_possible_points = 0.0
            total_weighted_grade = 0.0

            evaluated_items = []
            for item in grading_result.criterion_evaluations:
                key = f"{item.task_code}_{item.rubric_criterion_id}"
                mapping_info = criteria_weight_map.get(key, {})

                weight = mapping_info.get("weight", 0.0)
                max_score = mapping_info.get("max_score", 0.0)

                # Points out of maximum_score
                earned_points = (item.score_percentage / 100.0) * max_score
                
                # Weighted contribution toward final overall mark
                weighted_contribution = earned_points * (weight / 100.0)

                total_earned_points += earned_points
                total_max_possible_points += max_score
                total_weighted_grade += weighted_contribution

                evaluated_items.append({
                    "task_code": item.task_code,
                    "rubric_criterion_id": item.rubric_criterion_id,
                    "score_percentage": item.score_percentage,
                    "maximum_score": max_score,
                    "earned_points": round(earned_points, 2),
                    "weight": weight,
                    "weighted_contribution": round(weighted_contribution, 2),
                    "passed": item.passed,
                    "feedback": item.feedback,
                })

            return DRFResponse(
                {
                    "submission_id": str(submission.id),
                    "total_earned_points": round(total_earned_points, 2),
                    "total_max_possible_points": round(total_max_possible_points, 2),
                    "final_weighted_grade": round(total_weighted_grade, 2),
                    "overall_summary": grading_result.overall_summary,
                    "criterion_results": evaluated_items,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return DRFResponse(
                {"error": "Grading dispatch failed", "details": str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
            
            
# Pydantic schema for structured output
class TaskCriterionPair(BaseModel):
    task_code: str = Field(description="The task_code (e.g. T-F-01)")
    rubric_criterion_id: str = Field(description="UUID of the best matching rubric criterion")
    inferred_weight: float = Field(description="Proportional weight percentage for this task")
    ai_explanation: str = Field(description="Justification for mapping this task to the criterion")


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

        # Calculate equal default weight per task
        default_weight = round(100.0 / len(tasks), 2)

        # Prompt instructing AI to evaluate task difficulty and split criteria weights logically
        user_prompt = (
            f"Assignment Tasks:\n{json.dumps(task_data, indent=2)}\n\n"
            f"Rubric Criteria:\n{json.dumps(criteria_data, indent=2)}\n\n"
            "INSTRUCTIONS:\n"
            "1. Map every task_code to the single most appropriate rubric_criterion_id.\n"
            "2. WEIGHT ADJUSTMENT RULE:\n"
            "   - Multiple tasks can map to the same Rubric Criterion.\n"
            "   - Evaluate the difficulty, scope, and technical depth of each task relative to its mapped criterion.\n"
            "   - Assign 'inferred_weight' for each task based on its difficulty (e.g., complex tasks get higher weightage, simple tasks get lower weightage).\n"
            "   - Ensure that across ALL tasks of a particular criteria, the sum of all 'inferred_weight' values equals exactly 100.0%.\n"
            "3. Provide a clear justification in 'ai_explanation' explaining why the task was mapped and how its difficulty influenced its assigned weight."
        )

        try:
            http_client = httpx.Client()
            client = OpenAI(api_key=settings.OPENAI_API_KEY, http_client=http_client)

            completion = client.beta.chat.completions.parse(
                model=settings.OPENAI_API_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a curriculum mapping expert. Align learning tasks to rubric criteria.",
                    },
                    {"role": "user", "content": user_prompt},
                ],
                response_format=AutoMappingResponseSchema,
                temperature=0.0,
            )

            result = completion.choices[0].message.parsed

            # 3. Save mappings directly to PostgreSQL
            task_dict = {t.task_code: t for t in tasks}
            criteria_dict = {str(c.id): c for c in criteria}

            created_records = []
            detailed_mappings = []

            for item in result.mappings:
                task_obj = task_dict.get(item.task_code)
                criterion_obj = criteria_dict.get(item.rubric_criterion_id)

                if task_obj and criterion_obj:
                    record, _ = TaskCriteriaMapping.objects.update_or_create(
                        assignment_level_id=assignment_level_id,
                        task=task_obj,
                        defaults={
                            "rubric_criterion": criterion_obj,
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
            