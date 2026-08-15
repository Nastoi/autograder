import base64
import json

import httpx
from django.conf import settings
from openai import OpenAI

from django.utils import timezone

from grading.models import (
    CriterionResult,
    ExtractedEvidence,
    SubmissionTaskMapping,
    Task,
    TaskCriteriaMapping,
    RubricBand,
    RubricCriterion,
)
from grading.schemas import (
    GradingResponseSchema,
    PDFTaskMappingResponseSchema,
)
from submissions.models import SubmissionPage

def map_submission_tasks(submission):
    assignment_level = submission.context.assignment_level

    tasks = Task.objects.filter(
        assignment_level=assignment_level
    ).order_by("sequence")

    if not tasks.exists():
        raise ValueError(
            f"No tasks found for AssignmentLevel {assignment_level.id}"
        )

    task_definitions = [
        {
            "task_code": task.task_code,
            "title": task.title,
            "instructions": task.instructions,
        }
        for task in tasks
    ]

    submission_pages = SubmissionPage.objects.filter(
        submission=submission
    ).order_by("page_number")

    total_pages = submission_pages.count()

    if total_pages == 0:
        raise ValueError(
            f"No submission pages found for submission {submission.id}"
        )

    evidence_text_map = {
        ev.page_number: ev.content_text
        for ev in ExtractedEvidence.objects.filter(
            submission=submission
        )
        if ev.content_text
    }

    user_content = [
        {
            "type": "text",
            "text": (
                f"CRITICAL DOCUMENT METADATA:\n"
                f"- THIS DOCUMENT HAS EXACTLY {total_pages} PAGES "
                f"(Pages 1 to {total_pages}).\n"
                f"- DO NOT MAP ANY PAGE NUMBER GREATER THAN "
                f"{total_pages}.\n"
                f"- A SINGLE PAGE CAN CONTAIN EVIDENCE FOR "
                f"MULTIPLE TASKS.\n\n"
                f"Target Assignment Tasks to Map:\n"
                f"{json.dumps(task_definitions, indent=2)}\n\n"
                "Examine the page text and images below and map "
                "relevant task_codes to exact page numbers."
            ),
        }
    ]

    for page in submission_pages:
        page_num = page.page_number

        user_content.append(
            {
                "type": "text",
                "text": (
                    f"=== START OF PAGE {page_num} "
                    f"OF {total_pages} ==="
                ),
            }
        )

        page_text = (
            evidence_text_map.get(page_num)
            or getattr(page, "extracted_text", None)
        )

        if page_text:
            user_content.append(
                {
                    "type": "text",
                    "text": (
                        f"Page {page_num} Extracted Text:\n"
                        f"{page_text}"
                    ),
                }
            )

        if getattr(page, "image_data", None):
            b64_image = base64.b64encode(
                page.image_data
            ).decode("utf-8")

            mime_type = getattr(
                page,
                "image_mime_type",
                "image/webp",
            )

            user_content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": (
                            f"data:{mime_type};base64,"
                            f"{b64_image}"
                        )
                    },
                }
            )

        elif getattr(page, "image_url", None):
            user_content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": page.image_url
                    },
                }
            )

    system_prompt = (
        "You are an expert academic evaluator and document "
        "structure mapper.\n\n"
        "YOUR GOAL:\n"
        "Analyze the submitted document pages and map each "
        "assignment task (by task_code) to the PDF page numbers "
        "that contain evidence of that task being executed or "
        "documented.\n\n"
        "RULES:\n"
        f"1. HARD PAGE LIMIT: The document provided has EXACTLY "
        f"{total_pages} pages. You MUST NOT map any page number "
        f"higher than {total_pages}.\n"
        "2. MULTI-TASK PAGES: A single page CAN contain evidence "
        "for multiple tasks. Map every task independently.\n"
        "3. SEMANTIC MATCHING: Match generic task instructions "
        "to specific learner implementation evidence.\n"
        "4. UNRELATED DOCUMENTS: If unrelated, set "
        "'is_unrelated_document': true and leave mapped pages "
        "empty.\n"
        "5. MISSING TASKS: If not attempted, set "
        "'is_relevant': false and 'mapped_page_numbers': []."
    )

    http_client = httpx.Client()

    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        http_client=http_client,
    )

    completion = client.beta.chat.completions.parse(
        model=settings.OPENAI_API_MODEL,
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_content,
            },
        ],
        response_format=PDFTaskMappingResponseSchema,
        temperature=0.0,
    )

    mapping_data = completion.choices[0].message.parsed

    print("SUBMISSION TASK MAPPING RESULT:", mapping_data.model_dump())
    print(
        "TASK MAPPINGS COUNT:",
        len(mapping_data.task_mappings),
    )

    saved_records = []

    for item in mapping_data.task_mappings:
        valid_pages = [
            page_num
            for page_num in item.mapped_page_numbers
            if 1 <= page_num <= total_pages
        ]

        is_valid = (
            item.is_relevant
            and len(valid_pages) > 0
        )

        record, _ = (
            SubmissionTaskMapping.objects.update_or_create(
                submission=submission,
                task_id=item.task_id,
                defaults={
                    "task_description":
                        item.task_description,
                    "mapped_page_numbers":
                        valid_pages if is_valid else [],
                    "confidence_score":
                        item.confidence_score
                        if is_valid
                        else 0.0,
                    "justification":
                        item.justification,
                },
            )
        )

        saved_records.append(record.id)

    return {
        "total_pdf_pages": total_pages,
        "tasks_processed": len(task_definitions),
        "saved_mappings_count": len(saved_records),
        "is_unrelated_document": mapping_data.is_unrelated_document,
        "mapping_data": mapping_data.model_dump(),
    }


def determine_overall_band(
    assignment_level,
    overall_percentage: float,
) -> str:
    bands = (
        RubricBand.objects
        .filter(
            rubric_criterion__assignment_level=assignment_level,
        )
        .order_by("sequence")
    )

    matching_bands = [
        band
        for band in bands
        if (
            float(band.minimum_percentage)
            <= overall_percentage
            <= float(band.maximum_percentage)
        )
    ]

    if not matching_bands:
        raise ValueError(
            f"No grading band configured for "
            f"{overall_percentage}%."
        )

    band_codes = {
        band.band_code
        for band in matching_bands
    }

    if len(band_codes) > 1:
        raise ValueError(
            "Multiple grading bands match "
            f"{overall_percentage}%: "
            f"{sorted(band_codes)}."
        )

    return matching_bands[0].band_code

def grade_submission(submission):

   

    task_mappings = SubmissionTaskMapping.objects.filter(
        submission=submission
    )

    if not task_mappings.exists():
        raise ValueError(
            f"No task mappings found for submission {submission.id}."
        )

    assignment_level = submission.context.assignment_level

    criteria_mappings = (
        TaskCriteriaMapping.objects
        .filter(
            assignment_level=assignment_level
        )
        .select_related(
            "task",
            "rubric_criterion",
        )
    )
    

    if not criteria_mappings.exists():
        raise ValueError(
            "No task criteria mappings found for "
            f"AssignmentLevel {assignment_level.id}."
        )

    all_criteria_ids = set(
        RubricCriterion.objects.filter(
            assignment_level=assignment_level
        ).values_list("id", flat=True)
    )

    mapped_criteria_ids = set(
        criteria_mappings.values_list(
            "rubric_criterion_id",
            flat=True,
        )
    )

    unmapped_criteria_ids = all_criteria_ids - mapped_criteria_ids

    if unmapped_criteria_ids:
        unmapped_codes = list(
            RubricCriterion.objects.filter(
                id__in=unmapped_criteria_ids
            ).values_list(
                "criterion_code",
                flat=True,
            )
        )

        raise ValueError(
            "All rubric criteria must be assigned to at least one task before grading. "
            f"Unmapped criteria: {', '.join(unmapped_codes)}"
        )

    submission_pages = {
        page.page_number: page
        for page in SubmissionPage.objects.filter(
            submission=submission
        )
    }

    task_pages_map = {
        mapping.task_id: mapping.mapped_page_numbers
        for mapping in task_mappings
    }

    user_content = [
        {
            "type": "text",
            "text": (
                f"Grading Evaluation for Submission ID: "
                f"{submission.id}.\n"
                "Evaluate each task/criterion against its "
                "mapped page evidence and output a "
                "score_percentage from 0 to 100.\n"
            ),
        }
    ]

    criteria_weight_map = {}

    for mapping in criteria_mappings:
        task_code = mapping.task.task_code
        criterion_id = str(
            mapping.rubric_criterion.id
        )

        criteria_weight_map[
            f"{task_code}_{criterion_id}"
        ] = {
            "weight": float(
                mapping.inferred_weight
            ),
            "max_score": float(
                mapping.rubric_criterion.maximum_score
            ),
        }

        mapped_pages = task_pages_map.get(
            task_code,
            [],
        )

        user_content.append(
            {
                "type": "text",
                "text": (
                    "\n=== CRITERION EVALUATION TARGET ===\n"
                    f"Task Code: {task_code}\n"
                    f"Rubric Criterion ID: {criterion_id}\n"
                    f"Task Instruction: "
                    f"{mapping.task.instructions}\n"
                    f"Mapped Evidence Pages: "
                    f"{mapped_pages if mapped_pages else 'NO EVIDENCE FOUND'}\n"
                ),
            }
        )

        for page_num in mapped_pages:
            page_obj = submission_pages.get(page_num)

            if not page_obj:
                continue

            if getattr(
                page_obj,
                "extracted_text",
                None,
            ):
                user_content.append(
                    {
                        "type": "text",
                        "text": (
                            f"--- [Page {page_num} Text "
                            f"for {task_code}] ---\n"
                            f"{page_obj.extracted_text}"
                        ),
                    }
                )

            if getattr(
                page_obj,
                "image_data",
                None,
            ):
                b64_image = base64.b64encode(
                    page_obj.image_data
                ).decode("utf-8")

                mime_type = getattr(
                    page_obj,
                    "image_mime_type",
                    "image/webp",
                )

                user_content.append(
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": (
                                f"data:{mime_type};base64,"
                                f"{b64_image}"
                            )
                        },
                    }
                )

    system_prompt = (
        "You are an academic grader. "
        "Evaluate the evidence provided for each "
        "task/criterion. For each target, assign a "
        "score_percentage between 0.0 and 100.0 "
        "based on completion quality."
    )

    http_client = httpx.Client()

    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        http_client=http_client,
    )

    completion = client.beta.chat.completions.parse(
        model=settings.OPENAI_API_MODEL,
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_content,
            },
        ],
        response_format=GradingResponseSchema,
        temperature=0.1,
    )

    grading_result = (
        completion.choices[0].message.parsed
    )

    criterion_groups = {}

    for item in grading_result.criterion_evaluations:
        key = (
            f"{item.task_code}_"
            f"{item.rubric_criterion_id}"
        )

        mapping_info = (
            criteria_weight_map.get(key, {})
        )

        criterion_id = (
            item.rubric_criterion_id
        )

        if criterion_id not in criterion_groups:
            criterion_groups[criterion_id] = {
                "max_score": mapping_info.get(
                    "max_score",
                    0.0,
                ),
                "task_evaluations": [],
            }

        criterion_groups[
            criterion_id
        ]["task_evaluations"].append(
            {
                "item": item,
                "weight": mapping_info.get(
                    "weight",
                    0.0,
                ),
            }
        )

    total_earned_points = 0.0

    all_criteria = RubricCriterion.objects.filter(
        assignment_level=assignment_level
    )

    total_max_possible_points = sum(
        float(c.maximum_score)
        for c in all_criteria
    )

    evaluated_items = []

    # Remove old criterion results if this
    # submission is being regraded.
    CriterionResult.objects.filter(
        submission=submission
    ).delete()

    for criterion_id, group_data in (
        criterion_groups.items()
    ):
        criterion_max_score = (
            group_data["max_score"]
        )

        criterion_earned = 0.0
        criterion_feedback = []

        for task_eval in (
            group_data["task_evaluations"]
        ):
            item = task_eval["item"]
            weight = task_eval["weight"]

            task_earned = (
                (item.score_percentage / 100.0)
                * (weight / 100.0)
                * criterion_max_score
            )

            total_earned_points += task_earned
            criterion_earned += task_earned

            criterion_feedback.append(
                f"{item.task_code}: {item.feedback}"
            )

            evaluated_items.append(
                {
                    "task_code":
                        item.task_code,
                    "rubric_criterion_id":
                        item.rubric_criterion_id,
                    "score_percentage":
                        item.score_percentage,
                    "inferred_weight":
                        weight,
                    "earned_points":
                        round(task_earned, 2),
                    "criterion_max_score":
                        criterion_max_score,
                    "passed":
                        item.passed,
                    "feedback":
                        item.feedback,
                }
            )

        CriterionResult.objects.create(
            submission=submission,
            rubric_criterion_id=criterion_id,
            awarded_marks=round(
                criterion_earned,
                2,
            ),
            feedback="\n".join(
                criterion_feedback
            ),
        )

    overall_percentage = (
        round(
            (
                total_earned_points
                / total_max_possible_points
            )
            * 100.0,
            2,
        )
        if total_max_possible_points > 0
        else 0.0
    )

    achieved_band = determine_overall_band(
        assignment_level,
        overall_percentage,
    )

    submission.achieved_band = achieved_band


    submission.final_score = round(
        total_earned_points,
        2,
    )
    submission.maximum_score = round(
        total_max_possible_points,
        2,
    )
    submission.feedback = (
        grading_result.overall_summary
    )
    submission.status = (
        submission.Status.COMPLETED
    )
    submission.completed_at = timezone.now()

    submission.save(
        update_fields=[
            "final_score",
            "maximum_score",
            "feedback",
            "status",
            "completed_at",
            "achieved_band",
        ]
    )

    return {
        "submission_id": str(submission.id),
        "total_earned_points": round(
            total_earned_points,
            2,
        ),
        "total_max_possible_points": round(
            total_max_possible_points,
            2,
        ),
        "overall_percentage": overall_percentage,
        "overall_summary":
            grading_result.overall_summary,
        "criterion_results": evaluated_items,
    }