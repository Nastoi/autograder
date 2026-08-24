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
from submissions.audit import record_submission_event, update_grading_audit


def _completion_usage_snapshot(completion):
    usage = getattr(completion, "usage", None)

    if usage is None:
        return {
            "input_tokens": 0,
            "cached_input_tokens": 0,
            "output_tokens": 0,
            "reasoning_tokens": 0,
            "total_tokens": 0,
        }

    prompt_details = getattr(usage, "prompt_tokens_details", None)
    completion_details = getattr(usage, "completion_tokens_details", None)

    return {
        "input_tokens": int(getattr(usage, "prompt_tokens", 0) or 0),
        "cached_input_tokens": int(
            getattr(prompt_details, "cached_tokens", 0) or 0
        ),
        "output_tokens": int(getattr(usage, "completion_tokens", 0) or 0),
        "reasoning_tokens": int(
            getattr(completion_details, "reasoning_tokens", 0) or 0
        ),
        "total_tokens": int(getattr(usage, "total_tokens", 0) or 0),
    }


def _sum_usage_snapshots(items):
    keys = (
        "input_tokens",
        "cached_input_tokens",
        "output_tokens",
        "reasoning_tokens",
        "total_tokens",
    )

    return {
        key: sum(int(item.get(key, 0) or 0) for item in items)
        for key in keys
    }


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
        "supplied assignment scenario.\n"

        "13. TASK-AWARE EVIDENCE: Use the task's required_evidence to decide "
        "what kinds of evidence are relevant. Not every task requires a "
        "screenshot or visual artefact. For text-based or explanatory tasks, "
        "relevant written evidence may be sufficient. For tasks requiring a "
        "visible implementation, configuration, screenshot, model state, "
        "output, validation, or interface state, include the relevant visual "
        "or technical evidence when present.\n"

        "14. NEGATIVE OR CONTRADICTORY EVIDENCE IS STILL RELEVANT: A page can "
        "be relevant even when it appears to show that a required feature is "
        "missing, incomplete, incorrect, or inconsistent with another page. "
        "Do not exclude such evidence merely because it does not prove "
        "successful completion.\n"

        "15. PRESERVE MULTIPLE EVIDENCE SOURCES: When both written and visual "
        "evidence relate materially to the same task, map both so the grading "
        "stage can compare whether they communicate the same underlying result "
        "or implementation state. Do not decide which source is correct during "
        "mapping.\n"

        "16. NO UNNECESSARY SCREENSHOT REQUIREMENT: Do not require or invent "
        "visual evidence for a task whose instructions do not call for an "
        "observable implementation, screenshot, output, configuration state, "
        "or similar direct artefact."
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
    mapping_usage = _completion_usage_snapshot(completion)

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
        "token_usage": mapping_usage,
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

        submission_task_mapping = next(
            (
                item
                for item in task_mappings
                if item.task_id == task_code
            ),
            None,
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

    required_evaluation_pairs = sorted(
        criteria_weight_map.keys()
    )

    user_content.append(
        {
            "type": "text",
            "text": (
                "\n=== REQUIRED EVALUATION PAIRS ===\n"
                "Return exactly one criterion_evaluation "
                "for EVERY Task Code + Rubric Criterion ID "
                "pair below.\n"
                "Do not omit any pair.\n"
                "Do not add any pair that is not listed.\n"
                "Do not substitute one Rubric Criterion ID "
                "for another.\n\n"
                + "\n".join(
                    f"- {pair}"
                    for pair in required_evaluation_pairs
                )
            ),
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

        "EVIDENCE CONSISTENCY AND TASK-AWARE GRADING RULES:\n"
        "Evaluate the evidence according to what the task actually requires. "
        "Not every task requires screenshot or visual evidence. "

        "For text-based, explanatory, reflective, descriptive, or knowledge "
        "tasks, relevant written evidence may be sufficient when it satisfies "
        "the task and rubric. Do not penalise a learner for not providing a "
        "screenshot when the task does not require observable visual evidence. "

        "For tasks requiring implementation, configuration, model state, "
        "relationships, screenshots, outputs, dashboards, validation results, "
        "or another observable artefact, use the relevant direct evidence "
        "together with the learner's written explanation. "

        "When multiple evidence sources are supplied for the same task, compare "
        "their meaning and determine whether they are consistent. If the written "
        "response and the visual or technical evidence support the same result, "
        "treat them as mutually reinforcing evidence. "

        "If the evidence sources conflict, do not automatically prefer one "
        "source merely because it is visual or written. Instead, determine what "
        "can actually be verified against the task requirement and rubric. "
        "A written claim cannot by itself verify an observable implementation "
        "when the supplied artefact visibly fails to demonstrate that feature. "
        "Likewise, do not disregard correct written evidence for a task that "
        "does not require visual proof. "

        "If required evidence is absent or the supplied sources cannot be "
        "reconciled, award credit only for what is supported by the available "
        "evidence and rubric. Partial credit may be appropriate where genuine "
        "understanding or partial completion is demonstrated. "

        "When evidence conflicts materially, explain the discrepancy clearly "
        "and neutrally in the criterion feedback. "

        "CRITERION FEEDBACK:\n"
        "For each individual task/criterion evaluation, provide learner-facing "
        "feedback that is calm, appreciative, encouraging, factual, and specific "
        "to the evidence that was actually supplied. "

        "Use neutral wording. Do NOT use exaggerated praise or evaluative adjectives "
        "such as 'solid', 'strong', 'excellent', 'outstanding', 'impressive', "
        "'exceptional', 'very good', 'high-quality', 'robust', or similar wording. "
        "Do not describe the learner's work as better or worse than the evidence "
        "directly supports. "

        "Acknowledge the learner's effort or the evidence they provided in a simple "
        "and sincere way. State what is visible or demonstrated without inflating it. "
        "Examples of suitable tone include 'Thank you for providing this evidence', "
        "'You have included evidence showing...', or 'This demonstrates...'. "

        "Whenever score_percentage is below 100, give constructive next-step guidance "
        "using supportive wording such as 'You could strengthen this by...', "
        "'For the next attempt, consider...', 'It would help to include...', or "
        "'You may wish to check...'. Do not use harsh, judgmental, absolute, or "
        "discouraging language. "

        "Do not discuss scoring mechanics, lost marks, full credit, deductions, "
        "or why a particular score was awarded. Do not mention the numerical score "
        "inside criterion feedback unless the task explicitly requires a number. "

        "If evidence is missing, simply explain what evidence would help demonstrate "
        "the requirement. If implementation appears incorrect or incomplete, explain "
        "what the learner could check, revise, add, or show next. If evidence conflicts, "
        "state the discrepancy neutrally and suggest what could be clarified. "

        "All recommendations must be grounded only in the assignment instructions, "
        "criterion description, rubric bands, and supplied evidence. Do not invent "
        "extra requirements just to create improvement advice. "

        "If score_percentage is 100, do not invent a deficiency and do not exaggerate "
        "the praise. Briefly acknowledge what was demonstrated and, if useful, offer "
        "an optional next step framed as further development rather than a missing "
        "requirement. "

        "OVERALL SUMMARY:\n"
        "The overall_summary is learner-facing GENERAL overall feedback. "
        "It MUST consider the learner's work across the entire assignment, "
        "but it must stay high-level rather than repeating detailed rubric feedback. "

        "Write 2 to 4 natural sentences with an appreciative and encouraging tone. "
        "Thank or acknowledge the learner's effort, briefly note that their submission "
        "has been reviewed, and encourage them to use the criterion feedback to guide "
        "their next steps. Keep the wording measured and factual. "

        "Do NOT use exaggerated praise or evaluative adjectives such as 'solid', "
        "'strong', 'excellent', 'outstanding', 'impressive', 'exceptional', "
        "'very good', 'high-quality', or 'robust'. Do not make broad claims about "
        "the overall quality of the work unless they are strictly necessary. "

        "IMPORTANT: Do NOT mention criterion numbers, criterion codes, task codes, "
        "individual task details, individual criterion findings, awarded marks, total "
        "marks, percentages, calculated scores, or grading-band names such as Failed, "
        "Foundation, Proficient, or Expert in overall_summary. "

        "Do NOT state or imply a different grade or achievement level using grading "
        "language such as 'proficient', 'expert', 'failed', 'pass', 'foundation', "
        "'achieved the required standard', or similar phrases. The application's own "
        "calculation determines the final score and band separately. "

        "Do NOT include headings, separators, markdown titles, '=' characters, bullet "
        "lists, or a fixed template in overall_summary. Return only the feedback prose. "
        "Keep the tone appreciative, supportive, professional, and encouraging without "
        "exaggeration. Use varied wording so feedback does not sound identical across submissions. "

        "CRITICAL COMPLETENESS RULE:\n"
        "Return exactly one criterion_evaluation for EVERY task/criterion evaluation "
        "target supplied in the user message. Do not omit a target even when evidence "
        "is weak, missing, duplicated across tasks, or the same task is mapped to more "
        "than one rubric criterion. Each Task Code + Rubric Criterion ID pair is a "
        "distinct required evaluation. "

        "Use the Task Code and Rubric Criterion ID EXACTLY as supplied. "
        "Do not substitute a Rubric Criterion ID from another task or criterion. "
        "Do not merge evaluations when the same task belongs to multiple rubric "
        "criteria. For example, if T03 is mapped to two criteria, return two separate "
        "criterion_evaluation objects for T03, one for each required Rubric Criterion ID. "

        "The REQUIRED EVALUATION PAIRS list in the user message is authoritative. "
        "Your response must contain every listed pair exactly once and must not contain "
        "any pair that is not listed."
    )

    http_client = httpx.Client()

    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        http_client=http_client,
    )

        
    grading_call_usage = []

    try:
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
    except Exception as exc:
        record_submission_event(
            submission,
            stage="ai_grading",
            status="error",
            event_code="AI_REQUEST_ERROR",
            message="The AI grading request failed before a grading response was received.",
            details={
                "error_type": type(exc).__name__,
                "error_message": str(exc),
            },
        )
        raise

    grading_call_usage.append(
        {
            "stage": "criterion_grading",
            **_completion_usage_snapshot(completion),
        }
    )

    grading_result = (
        completion.choices[0].message.parsed
    )

    raw_ai_response = grading_result.model_dump()
    update_grading_audit(
        submission,
        raw_ai_response=raw_ai_response,
    )
    record_submission_event(
        submission,
        stage="ai_grading",
        status="success",
        event_code="AI_RESPONSE_RECEIVED",
        message="AI grading response received and retained for audit.",
        details={
            "criterion_evaluation_count": len(
                grading_result.criterion_evaluations
            ),
        },
    )

    # The AI must return exactly one evaluation for every configured
    # task/criterion target. Never save a completed grade with a
    # missing criterion or silently treat an omitted evaluation as zero.
    expected_evaluation_keys = set(criteria_weight_map.keys())
    received_evaluation_keys = [
        f"{item.task_code}_{item.rubric_criterion_id}"
        for item in grading_result.criterion_evaluations
    ]
    received_evaluation_key_set = set(received_evaluation_keys)

    duplicate_evaluation_keys = sorted({
        key
        for key in received_evaluation_keys
        if received_evaluation_keys.count(key) > 1
    })
    missing_evaluation_keys = sorted(
        expected_evaluation_keys - received_evaluation_key_set
    )
    unexpected_evaluation_keys = sorted(
        received_evaluation_key_set - expected_evaluation_keys
    )

    if (
        duplicate_evaluation_keys
        or missing_evaluation_keys
        or unexpected_evaluation_keys
    ):
        correction_prompt = (
            "Your previous grading response did not contain "
            "the exact required Task Code + Rubric Criterion ID pairs.\n\n"

            f"Missing evaluations:\n"
            + (
                "\n".join(
                    f"- {key}"
                    for key in missing_evaluation_keys
                )
                if missing_evaluation_keys
                else "- none"
            )
            + "\n\n"

            f"Duplicate evaluations:\n"
            + (
                "\n".join(
                    f"- {key}"
                    for key in duplicate_evaluation_keys
                )
                if duplicate_evaluation_keys
                else "- none"
            )
            + "\n\n"

            f"Unexpected evaluations:\n"
            + (
                "\n".join(
                    f"- {key}"
                    for key in unexpected_evaluation_keys
                )
                if unexpected_evaluation_keys
                else "- none"
            )
            + "\n\n"

            "Return a COMPLETE REPLACEMENT grading response. "
            "Do not return only the missing items.\n\n"

            "The response must contain exactly one "
            "criterion_evaluation for each of these required pairs:\n"
            + "\n".join(
                f"- {key}"
                for key in sorted(
                    expected_evaluation_keys
                )
            )
            + "\n\n"

            "Do not omit any required pair. "
            "Do not include any other pair. "
            "Use the Task Code and Rubric Criterion ID exactly as supplied."
        )

        retry_completion = (
            client.beta.chat.completions.parse(
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
                    {
                        "role": "assistant",
                        "content": json.dumps(
                            grading_result.model_dump(),
                            default=str,
                        ),
                    },
                    {
                        "role": "user",
                        "content": correction_prompt,
                    },
                ],
                response_format=GradingResponseSchema,
                temperature=0.0,
            )
        )

        grading_call_usage.append(
            {
                "stage": "criterion_grading_retry",
                **_completion_usage_snapshot(retry_completion),
            }
        )

        grading_result = (
            retry_completion.choices[0].message.parsed
        )

        received_evaluation_keys = [
            f"{item.task_code}_{item.rubric_criterion_id}"
            for item in grading_result.criterion_evaluations
        ]

        received_evaluation_key_set = set(
            received_evaluation_keys
        )

        duplicate_evaluation_keys = sorted({
            key
            for key in received_evaluation_keys
            if received_evaluation_keys.count(key) > 1
        })

        missing_evaluation_keys = sorted(
            expected_evaluation_keys
            - received_evaluation_key_set
        )

        unexpected_evaluation_keys = sorted(
            received_evaluation_key_set
            - expected_evaluation_keys
        )

        if (
            duplicate_evaluation_keys
            or unexpected_evaluation_keys
        ):
            raise ValueError(
                "Incomplete grading response after retry. "
                f"Missing evaluations: "
                f"{missing_evaluation_keys or 'none'}; "
                f"Duplicate evaluations: "
                f"{duplicate_evaluation_keys or 'none'}; "
                f"Unexpected evaluations: "
                f"{unexpected_evaluation_keys or 'none'}."
            )

        if missing_evaluation_keys:
            missing_key_set = set(missing_evaluation_keys)

            recovery_user_content = [
                {
                    "type": "text",
                    "text": (
                        f"Submission ID: {submission.id}\n\n"
                        f"{assignment_context}\n\n"
                        "RECOVERY MODE: evaluate ONLY the missing "
                        "Task Code + Rubric Criterion ID pairs below.\n\n"
                        "=== REQUIRED RECOVERY PAIRS ===\n"
                        + "\n".join(
                            f"- {key}"
                            for key in sorted(missing_key_set)
                        )
                        + "\n\n"
                        "Return exactly one criterion_evaluation for each "
                        "listed pair and no other pairs. Do not omit, "
                        "duplicate, substitute, or add a pair."
                    ),
                }
            ]

            for mapping in criteria_mappings:
                task_code = mapping.task.task_code
                criterion_id = str(mapping.rubric_criterion.id)
                pair_key = f"{task_code}_{criterion_id}"

                if pair_key not in missing_key_set:
                    continue

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
                ) or "No rubric bands configured."

                mapped_pages = task_pages_map.get(task_code, [])

                recovery_user_content.append(
                    {
                        "type": "text",
                        "text": (
                            "\n=== RECOVERY EVALUATION TARGET ===\n"
                            f"Task Code: {task_code}\n"
                            f"Task Title: {mapping.task.title}\n"
                            f"Required Evidence: "
                            f"{mapping.task.instructions or '-'}\n"
                            f"Rubric Criterion ID: {criterion_id}\n"
                            f"Criterion Code: "
                            f"{mapping.rubric_criterion.criterion_code}\n"
                            f"Criterion Title: "
                            f"{mapping.rubric_criterion.title}\n"
                            f"Criterion Description: "
                            f"{mapping.rubric_criterion.description or '-'}\n"
                            f"Criterion Maximum Score: "
                            f"{mapping.rubric_criterion.maximum_score}\n"
                            f"Rubric Bands:\n{rubric_band_text}\n"
                            f"Mapped Evidence Pages: "
                            f"{mapped_pages if mapped_pages else 'NO EVIDENCE FOUND'}\n"
                        ),
                    }
                )

                for page_num in mapped_pages:
                    page_obj = submission_pages.get(page_num)

                    if not page_obj:
                        continue

                    if getattr(page_obj, "extracted_text", None):
                        recovery_user_content.append(
                            {
                                "type": "text",
                                "text": (
                                    f"--- [Page {page_num} Text "
                                    f"for {task_code}] ---\n"
                                    f"{page_obj.extracted_text}"
                                ),
                            }
                        )

                    if getattr(page_obj, "image_data", None):
                        b64_image = base64.b64encode(
                            page_obj.image_data
                        ).decode("utf-8")
                        mime_type = getattr(
                            page_obj,
                            "image_mime_type",
                            "image/webp",
                        )
                        recovery_user_content.append(
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

            recovery_prompt = (
                system_prompt
                + "\n\nRECOVERY MODE:\n"
                "Return only the REQUIRED RECOVERY PAIRS. "
                "Do not omit any listed pair even when evidence is weak "
                "or missing; evaluate the available evidence and assign "
                "an appropriate score_percentage."
            )

            recovery_completion = (
                client.beta.chat.completions.parse(
                    model=settings.OPENAI_API_MODEL,
                    messages=[
                        {
                            "role": "system",
                            "content": recovery_prompt,
                        },
                        {
                            "role": "user",
                            "content": recovery_user_content,
                        },
                    ],
                    response_format=GradingResponseSchema,
                    temperature=0.0,
                )
            )

            grading_call_usage.append(
                {
                    "stage": "criterion_grading_recovery",
                    **_completion_usage_snapshot(recovery_completion),
                }
            )

            recovery_result = (
                recovery_completion.choices[0].message.parsed
            )

            recovery_keys = [
                f"{item.task_code}_{item.rubric_criterion_id}"
                for item in recovery_result.criterion_evaluations
            ]
            recovery_key_set = set(recovery_keys)

            recovery_duplicate_keys = sorted({
                key
                for key in recovery_keys
                if recovery_keys.count(key) > 1
            })
            recovery_missing_keys = sorted(
                missing_key_set - recovery_key_set
            )
            recovery_unexpected_keys = sorted(
                recovery_key_set - missing_key_set
            )

            if (
                recovery_duplicate_keys
                or recovery_missing_keys
                or recovery_unexpected_keys
            ):
                raise ValueError(
                    "Incomplete grading recovery response. "
                    f"Missing evaluations: "
                    f"{recovery_missing_keys or 'none'}; "
                    f"Duplicate evaluations: "
                    f"{recovery_duplicate_keys or 'none'}; "
                    f"Unexpected evaluations: "
                    f"{recovery_unexpected_keys or 'none'}."
                )

            grading_result.criterion_evaluations.extend(
                recovery_result.criterion_evaluations
            )

            record_submission_event(
                submission,
                stage="ai_grading",
                status="success",
                event_code="AI_MISSING_EVALUATIONS_RECOVERED",
                message=(
                    "Missing Task + Criterion grading evaluations "
                    "were recovered successfully."
                ),
                details={
                    "recovered_evaluations":
                        sorted(recovery_key_set),
                },
            )

            received_evaluation_keys = [
                f"{item.task_code}_{item.rubric_criterion_id}"
                for item in grading_result.criterion_evaluations
            ]
            received_evaluation_key_set = set(
                received_evaluation_keys
            )

            duplicate_evaluation_keys = sorted({
                key
                for key in received_evaluation_keys
                if received_evaluation_keys.count(key) > 1
            })
            missing_evaluation_keys = sorted(
                expected_evaluation_keys
                - received_evaluation_key_set
            )
            unexpected_evaluation_keys = sorted(
                received_evaluation_key_set
                - expected_evaluation_keys
            )

            if (
                duplicate_evaluation_keys
                or missing_evaluation_keys
                or unexpected_evaluation_keys
            ):
                raise ValueError(
                    "Incomplete grading response after recovery. "
                    f"Missing evaluations: "
                    f"{missing_evaluation_keys or 'none'}; "
                    f"Duplicate evaluations: "
                    f"{duplicate_evaluation_keys or 'none'}; "
                    f"Unexpected evaluations: "
                    f"{unexpected_evaluation_keys or 'none'}."
                )

            update_grading_audit(
                submission,
                raw_ai_response=
                    grading_result.model_dump(),
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
                    "mapped_page_numbers":
                        task_pages_map.get(item.task_code, []),
                    "mapping_confidence":
                        next(
                            (
                                mapped.confidence_score
                                for mapped in task_mappings
                                if mapped.task_id == item.task_code
                            ),
                            0.0,
                        ),
                    "mapping_justification":
                        next(
                            (
                                mapped.justification
                                for mapped in task_mappings
                                if mapped.task_id == item.task_code
                            ),
                            "",
                        ),
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
    overall_feedback = (
        grading_result.overall_summary or ""
    ).strip()

    if not overall_feedback:
        overall_feedback = (
            "Thank you for completing and submitting this assignment. "
            "Please review the detailed criterion feedback below for guidance "
            "on what you have demonstrated and what you can consider next."
        )

    submission.feedback = overall_feedback
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
        "overall_summary": overall_feedback,
        "criterion_results": evaluated_items,
    }