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

    assignment_context = {
        "title": assignment_level.title or "",
        "scenario": assignment_level.scenario or "",
        "objective": assignment_level.objective or "",
    }
        
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
            "required_evidence": task.instructions,
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
                f"Assignment Context:\n"
                f"{json.dumps(assignment_context, indent=2)}\n\n"
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
        "You are an expert academic evaluator and document structure mapper.\n\n"

        "IMPORTANT VISUAL CONTEXT:\n"
        "The images supplied to you are rendered images of the learner's PDF pages. "
        "The existence of a page image is NOT evidence by itself. "
        "Only content that is clearly visible inside the page may be treated as evidence.\n\n"

        "YOUR GOAL:\n"
        "Map each assignment task to ONLY the exact PDF pages that contain "
        "direct evidence of that task being performed or documented.\n\n"

        "RULES:\n"
        f"1. HARD PAGE LIMIT: The document has EXACTLY {total_pages} pages. "
        f"Never return a page greater than {total_pages}.\n"

        "2. MAP ONLY DIRECT EVIDENCE. Do not map a page merely because it "
        "mentions a related concept or contains general discussion.\n"

        "3. REQUIRED EVIDENCE: Only map pages to a task when the page "
        "contains evidence that reasonably satisfies that task's "
        "required_evidence. The task instructions describe what SHOULD be "
        "present; they are not evidence that it actually exists.\n"

        "4. For visual requirements such as screenshots, data connections, "
        "Queries panes, configuration screens, tables, outputs, dashboards, "
        "or interface states, map the page only when those elements are "
        "clearly visible in the learner's submitted page.\n"

        "5. Do not infer hidden or implied evidence from filenames, nearby text, "
        "expected workflow, page layout, task titles, or assignment instructions.\n"

        "6. If the required visual element cannot be clearly identified, "
        "treat it as not evidenced.\n"

        "7. BE SELECTIVE. Return the smallest set of pages needed to support "
        "the task. Do not map large page ranges unless every page contains "
        "specific evidence for that task.\n"

        "8. A single page may support multiple tasks only when it contains "
        "clear evidence for each task.\n"

        "9. If a task is not directly evidenced, set 'is_relevant': false "
        "and 'mapped_page_numbers': [].\n"

        "10. Do not infer completion from general statements, testing notes, "
        "descriptions, or references to what should be done.\n"

        "11. UNRELATED DOCUMENTS: If unrelated, set "
        "'is_unrelated_document': true and leave mapped pages empty.\n"

        "12. SCENARIO RELEVANCE: Evidence must reasonably relate to the "
        "supplied assignment scenario."
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
    print("GRADE SUBMISSION START:", submission.id, flush=True)

   

    task_mappings = SubmissionTaskMapping.objects.filter(
        submission=submission
    )

    if not task_mappings.exists():
        raise ValueError(
            f"No task mappings found for submission {submission.id}."
        )

    assignment_level = submission.context.assignment_level

    assignment_context = (
        f"Assignment Level Title: {assignment_level.title or '-'}\n"
        f"Scenario: {assignment_level.scenario or '-'}\n"
        f"Objective: {assignment_level.objective or '-'}"
    )

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
                f"{submission.id}.\n\n"
                f"{assignment_context}\n\n"
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

        rubric_bands = (
            RubricBand.objects
            .filter(
                rubric_criterion=mapping.rubric_criterion,
            )
            .order_by("sequence")
        )

        rubric_band_text = "\n".join(
            (
                f"- {band.display_name}: "
                f"{band.minimum_percentage}% to "
                f"{band.maximum_percentage}% — "
                f"{band.descriptor}"
            )
            for band in rubric_bands
        )

        if not rubric_band_text:
            rubric_band_text = "No rubric bands configured."
    
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
                    f"Task Title: {mapping.task.title}\n"
                    f"Required Evidence: {mapping.task.instructions or '-'}\n"
                    f"Rubric Criterion ID: {criterion_id}\n"
                    f"Criterion Code: "
                    f"{mapping.rubric_criterion.criterion_code}\n"
                    f"Criterion Title: "
                    f"{mapping.rubric_criterion.title}\n"
                    f"Criterion Description: "
                    f"{mapping.rubric_criterion.description or '-'}\n"
                    f"Criterion Maximum Score: "
                    f"{mapping.rubric_criterion.maximum_score}\n"
                    f"Rubric Bands:\n"
                    f"{rubric_band_text}\n"
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
        "Evaluate the evidence provided for each task/criterion against the "
        "assignment scenario, objective, task requirements, criterion description, "
        "and rubric bands. "

        "For each criterion evaluation, assign a score_percentage between "
        "0.0 and 100.0 based on completion quality. "
        "Do not award full credit merely because work is technically valid "
        "if it does not reasonably address the stated scenario or criterion. "
        "Use only the supplied evidence and requirements. "

        "CRITERION FEEDBACK:\n"
        "For each individual criterion, provide concise feedback specific to "
        "that task and criterion. Clearly explain what was demonstrated, "
        "what evidence was missing or incomplete, and what could be improved. "

        "OVERALL SUMMARY:\n"
        "The overall_summary MUST be a holistic evaluation of the learner's "
        "performance across the ENTIRE assignment. "
        "It must consider ALL task and criterion evaluations before forming "
        "the summary, not only the final task, lowest-scoring task, failed "
        "criterion, or most recently evaluated criterion. "

        "The overall_summary should identify the main strengths demonstrated "
        "across the assignment, the main areas that require improvement, and "
        "any significant missing or incomplete evidence. "
        "Describe the overall pattern of performance and how well the submission "
        "addresses the assignment objective and scenario. "

        "If one task or criterion failed, mention it only in proportion to its "
        "importance to the overall submission. Do not allow a single task or "
        "criterion to dominate the overall_summary unless it represents a "
        "substantial portion of the assignment. "

        "Do not write the overall_summary as feedback for one individual task. "
        "Do not simply repeat the feedback from the last criterion. "
        "Do not list every task one by one unless necessary. "
        "Instead, synthesise the results into a concise holistic academic summary. "

        "Write all feedback in a natural, concise academic tone. "
        "Vary sentence structure and wording between feedback items. "
        "Avoid repeatedly starting feedback with phrases such as "
        "'The submission demonstrates', 'The submission lacks', or 'However'. "
        "Do not use a fixed feedback template."
    )

    http_client = httpx.Client()

    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        http_client=http_client,
    )

    print(
        "SENDING GRADING REQUEST TO OPENAI",
        "content_items=",
        len(user_content),
        flush=True,
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

    print("GRADING RESPONSE RECEIVED", flush=True)
    
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