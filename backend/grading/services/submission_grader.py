import json
import re

from pydantic import BaseModel, Field

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
from grading.services.image_payloads import (
    ImagePayloadBudget,
    append_page_image,
    enforce_message_image_budget,
)


class TaskEvidenceVerification(BaseModel):
    task_code: str
    verification_status: str = Field(
        description="One of: verified, partial, not_verified, uncertain"
    )
    evidence_type_required: str
    evidence_type_found: str
    visual_requirement_satisfied: bool | None = None
    quantity_requirement_satisfied: bool | None = None
    verified_facts: list[str] = Field(default_factory=list)
    missing_or_unverified: list[str] = Field(default_factory=list)
    reasoning: str


class EvidenceVerificationResponse(BaseModel):
    task_verifications: list[TaskEvidenceVerification]


def _setting_int(name: str, default: int) -> int:
    try:
        return int(getattr(settings, name, default))
    except (TypeError, ValueError):
        return default


def _sample_page_numbers(page_numbers, limit: int) -> list[int]:
    """Select deterministic document-wide visual coverage within a cap."""
    values = sorted({int(n) for n in page_numbers if n})
    limit = max(1, int(limit or 1))
    if len(values) <= limit:
        return values
    if limit == 1:
        return [values[0]]

    # Evenly sample across the full document so large submissions do not load
    # or encode every page image in one worker/request.
    indexes = {round(i * (len(values) - 1) / (limit - 1)) for i in range(limit)}
    return [values[i] for i in sorted(indexes)]


def _mapping_visual_page_numbers(submission) -> list[int]:
    """Choose bounded mapping visuals, prioritising pages with little text."""
    limit = _setting_int("OPENAI_MAPPING_MAX_IMAGES", 36)
    rows = list(
        SubmissionPage.objects
        .filter(submission=submission, image_data__isnull=False)
        .order_by("page_number")
        .values_list("page_number", "extracted_text")
    )
    if len(rows) <= limit:
        return [number for number, _ in rows]

    low_text = [
        number for number, text in rows
        if len((text or "").strip()) < 120
    ]
    selected = _sample_page_numbers(low_text, min(limit, len(low_text))) if low_text else []
    if len(selected) < limit:
        selected_set = set(selected)
        remaining = [number for number, _ in rows if number not in selected_set]
        selected.extend(_sample_page_numbers(remaining, limit - len(selected)))
    return sorted(set(selected))[:limit]

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


def _response_usage_snapshot(response):
    usage = getattr(response, "usage", None)

    if usage is None:
        return {
            "input_tokens": 0,
            "cached_input_tokens": 0,
            "output_tokens": 0,
            "reasoning_tokens": 0,
            "total_tokens": 0,
        }

    input_details = getattr(usage, "input_tokens_details", None)
    output_details = getattr(usage, "output_tokens_details", None)

    return {
        "input_tokens": int(getattr(usage, "input_tokens", 0) or 0),
        "cached_input_tokens": int(
            getattr(input_details, "cached_tokens", 0) or 0
        ),
        "output_tokens": int(getattr(usage, "output_tokens", 0) or 0),
        "reasoning_tokens": int(
            getattr(output_details, "reasoning_tokens", 0) or 0
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


class AuthenticityFinding(BaseModel):
    scope: str = Field(
        description=(
            "Section, page range, artefact type, or content category "
            "affected by the authenticity statement."
        )
    )
    validity: str = Field(
        description=(
            "One of: genuine, synthetic, placeholder, invalid, uncertain."
        )
    )
    reason: str = Field(
        description=(
            "Short explanation based only on explicit statements "
            "inside the learner submission."
        )
    )


class DocumentAuthenticitySchema(BaseModel):
    global_notice_present: bool
    genuine_scope: list[str] = Field(default_factory=list)
    invalid_scope: list[str] = Field(default_factory=list)
    findings: list[AuthenticityFinding] = Field(default_factory=list)
    summary: str



class OverallSummaryResponseSchema(BaseModel):
    overall_summary: str = Field(
        description=(
            "Short learner-facing overall assignment feedback."
        )
    )


def _collect_document_warnings(submission):
    warning_phrases = (
        "placeholder",
        "synthetic",
        "mock",
        "sample content",
        "test file",
        "test data",
        "not a real screenshot",
        "not evidence of completed work",
        "not genuine",
        "fabricated",
        "generated for testing",
    )

    page_texts = {}

    for page in SubmissionPage.objects.filter(
        submission=submission
    ).order_by("page_number"):
        text = getattr(page, "extracted_text", None) or ""
        if text:
            page_texts[page.page_number] = text

    for evidence in ExtractedEvidence.objects.filter(
        submission=submission
    ):
        if evidence.content_text:
            page_texts[evidence.page_number] = evidence.content_text

    warnings = []

    for page_number, text in page_texts.items():
        lines = text.splitlines()
        for index, line in enumerate(lines):
            normalized = line.lower()
            if not any(phrase in normalized for phrase in warning_phrases):
                continue
            start = max(index - 1, 0)
            end = min(index + 3, len(lines))
            snippet = " ".join(
                part.strip()
                for part in lines[start:end]
                if part.strip()
            )
            warning = f"Page {page_number}: {snippet}"
            if warning not in warnings:
                warnings.append(warning)

    return warnings[:20]


def _neutral_overall_feedback():
    return (
        "Thank you for completing and submitting this assignment. "
        "Your submission has been reviewed against the assignment requirements. "
        "Please review the detailed criterion feedback for the evidence identified, "
        "the areas that need further attention, and the recommended next steps. "
        "Use this feedback to guide your next submission."
    )


def _is_task_requirement_assessable(task):
    title = (task.title or "").strip().lower()
    evidence_required = (
        task.evidence_required or ""
    ).strip().lower()

    if not evidence_required:
        return False

    title_words = set(
        re.findall(r"\b\w+\b", title)
    )

    evidence_words = set(
        re.findall(r"\b\w+\b", evidence_required)
    )

    if title == evidence_required:
        return False

    if (
        title_words
        and evidence_words
        and title_words == evidence_words
    ):
        return False

    return True

def analyze_document_authenticity(submission):
    pages = (
        SubmissionPage.objects
        .filter(submission=submission)
        .order_by("page_number")
    )

    evidence_text_map = {
        ev.page_number: ev.content_text
        for ev in ExtractedEvidence.objects.filter(
            submission=submission
        )
        if ev.content_text
    }

    content = []

    for page in pages:
        page_text = (
            evidence_text_map.get(page.page_number)
            or getattr(page, "extracted_text", None)
            or ""
        )

        if page_text.strip():
            content.append(
                {
                    "type": "text",
                    "text": (
                        f"=== PAGE {page.page_number} ===\n"
                        f"{page_text}"
                    ),
                }
            )

    system_prompt = (
        "You analyze authenticity declarations inside a learner submission.\n\n"

        "Your ONLY job is to identify explicit statements made by the "
        "submission about whether parts of its own content are genuine, "
        "synthetic, placeholder, mock, sample, test-only, fabricated, "
        "not real, or not evidence of completed work.\n\n"

        "RULES:\n"
        "1. Do not grade the assignment.\n"
        "2. Do not decide whether task requirements are met.\n"
        "3. Do not infer dishonesty or fabrication unless the submission "
        "explicitly says so.\n"
        "4. Pay special attention to document-wide notices that define "
        "the authenticity of later sections.\n"
        "5. If a notice says only certain sections are genuine and the "
        "remaining sections are synthetic, preserve that scope explicitly.\n"
        "6. A declaration that testing results, tables, reflections, "
        "screenshots, or configuration records are synthetic applies to "
        "those artefacts themselves, not only to their images.\n"
        "7. Return concise structured findings that can be used later "
        "by an academic grader.\n"
        "8. Follow the supplied Document Authenticity Analysis exactly. "
        "If relevant content is declared synthetic or invalid, it may still "
        "be mapped because it is relevant, but the justification must state "
        "that it cannot verify completion.\n"
    )

    http_client = httpx.Client()
    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        http_client=http_client,
    )

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
                    "content": content,
                },
            ],
            response_format=DocumentAuthenticitySchema,
            # temperature=0.0,
        )

        result = completion.choices[0].message.parsed

        return {
            "analysis": result.model_dump(),
            "token_usage":
                _completion_usage_snapshot(completion),
        }

    finally:
        http_client.close()

def map_submission_tasks(submission):
    assignment_level = submission.context.assignment_level

    assignment_context = {
        "title": assignment_level.title or "",
        "skill_statement": assignment_level.skill_statement or "",
        "objective": assignment_level.objective or "",
        "scenario": assignment_level.scenario or "",
        "expected_outcome": assignment_level.expected_outcome or "",
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
            "required_evidence": task.evidence_required,
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

    authenticity_result = (
        analyze_document_authenticity(submission)
    )

    document_authenticity = (
        authenticity_result["analysis"]
    )

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
                f"Document Authenticity Analysis:\n"
                f"{json.dumps(document_authenticity, indent=2)}\n\n"
                f"Target Assignment Tasks to Map:\n"
                f"{json.dumps(task_definitions, indent=2)}\n\n"
                "Examine the page text and images below and map "
                "relevant task_codes to exact page numbers."
            ),
        }
    ]

    page_rows = (
        submission_pages
        .values_list("page_number", "extracted_text")
        .iterator(chunk_size=20)
    )
    for page_num, extracted_text in page_rows:
        user_content.append(
            {
                "type": "text",
                "text": (
                    f"=== START OF PAGE {page_num} "
                    f"OF {total_pages} ==="
                ),
            }
        )

        page_text = evidence_text_map.get(page_num) or extracted_text
        if page_text:
            user_content.append(
                {
                    "type": "text",
                    "text": f"Page {page_num} Extracted Text:\n{page_text}",
                }
            )

    system_prompt = (
        "You map learner submission evidence to assignment tasks.\n\n"
        "For each task, identify only pages materially relevant to evaluating the required evidence.\n\n"
        "RULES:\n"
        "1. Never return a page outside the supplied document range.\n"
        "2. A page may support multiple tasks.\n"
        "3. Map direct evidence and materially relevant negative or contradictory evidence.\n"
        "4. Do not infer implementation from assignment instructions, captions, claims, filenames, or expected workflow.\n"
        "5. For observable requirements, distinguish written claims from what is visibly demonstrated in the rendered page.\n"
        "6. Written evidence is valid for genuinely written or reflective requirements when the task permits it.\n"
        "7. Evidence explicitly identified as placeholder, synthetic, mock, sample, test-only, fabricated, not genuine, or not evidence of completed work may still be relevant, but it does not verify completion. State this clearly in justification.\n"
        "8. Apply document-wide warnings according to their stated scope. "
        "A warning on an earlier page may invalidate evidence on later pages.\n"
        "9. If no materially relevant evidence exists, return "
        "is_relevant=false and no mapped pages.\n"
        "10. Keep mapped pages selective and explain what each mapped page "
        "actually demonstrates or fails to demonstrate.\n"
        "11. Never infer missing task requirements from the surrounding "
        "submission, assignment context, template structure, section names, "
        "screenshots, or the apparent purpose of the document. The configured "
        "task title and Required Evidence are authoritative.\n"
        "12. If the configured task is too vague, generic, circular, or "
        "non-specific to determine what must actually be demonstrated, do not "
        "invent a requirement from the submission. Return is_relevant=false "
        "with no mapped pages for that task.\n"
        "13. Matching words, task names, headings, copied requirements, or "
        "similar wording alone do not demonstrate task completion and are not "
        "sufficient reason to map evidence.\n"
        
    )

    http_client = httpx.Client()

    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        http_client=http_client,
    )

    if not submission.submitted_file:
        http_client.close()
        raise ValueError(
            f"Submission {submission.id} has no original PDF file for task mapping"
        )

    mapping_file = None
    file_handle = None

    try:
        file_handle = submission.submitted_file.open("rb")
        mapping_file = client.files.create(
            file=(
                submission.original_filename or "submission.pdf",
                file_handle,
                "application/pdf",
            ),
            purpose="user_data",
        )

        # Preserve the existing mapping prompt text exactly. Only the visual
        # transport changes: one original PDF replaces per-page image inputs.
        response_user_content = [
            {"type": "input_file", "file_id": mapping_file.id},
            *[
                {"type": "input_text", "text": item["text"]}
                for item in user_content
            ],
        ]

        completion = client.responses.parse(
            model=settings.OPENAI_API_MODEL,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": response_user_content},
            ],
            text_format=PDFTaskMappingResponseSchema,
        )

        mapping_data = completion.output_parsed
        mapping_usage = _response_usage_snapshot(completion)

    finally:
        if file_handle is not None:
            file_handle.close()

        if mapping_file is not None:
            try:
                client.files.delete(mapping_file.id)
            except Exception:
                # Mapping already has its response at this point. Failure to
                # delete the temporary OpenAI file must not alter the grade.
                pass

        http_client.close()

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


def verify_task_evidence(
    submission,
    task_mappings,
    assignment_context,
    document_authenticity,
):
    # Keep text/model metadata cached, but defer binary images so large
    # submissions do not materialise every page image in worker memory.
    submission_pages = {
        page.page_number: page
        for page in (
            SubmissionPage.objects
            .filter(submission=submission)
            .defer("image_data")
        )
    }
    image_page_numbers = set(
        SubmissionPage.objects
        .filter(submission=submission, image_data__isnull=False)
        .values_list("page_number", flat=True)
    )

    assignment_level = submission.context.assignment_level

    task_lookup = {
        task.task_code: task
        for task in Task.objects.filter(
            assignment_level=assignment_level
        )
    }

    system_prompt = (
        "You are an evidence verifier, not a grader.\n\n"
        "You will receive ONE assignment task and only the pages mapped "
        "as potentially relevant to that task.\n"
        "Determine what the supplied evidence actually demonstrates.\n\n"

        "RULES:\n"
        "1. Evaluate only the supplied task. Do not reason about other tasks.\n"
        "2. Use the task requirement dynamically. Do not assume a particular "
        "assignment type or software product.\n"
        "3. Do not award marks, percentages, or rubric bands.\n"
        "4. Do not assume an image is valid evidence merely because it appears "
        "near a screenshot instruction or inside the expected template section.\n"
        "5. Inspect the actual rendered visual content and determine whether it "
        "visibly demonstrates what the task requires.\n"
        "6. Written claims do not verify an observable setting, configuration, "
        "interface, screenshot, output, dashboard, test result, citation panel, "
        "or other visual requirement unless the task explicitly permits written "
        "evidence alone.\n"
        "7. Check required quantities explicitly. Count only independently "
        "demonstrated qualifying items.\n"
        "8. Follow the supplied Document Authenticity restrictions. Evidence "
        "declared synthetic, placeholder, mock, sample, test-only, fabricated, "
        "not genuine, or invalid cannot be verified as completed work.\n"
        "9. If the evidence is unrelated to the requirement, return "
        "verification_status='not_verified'.\n"
        "10. If some but not all requirements are demonstrated, return "
        "verification_status='partial'.\n"
        "11. If the supplied evidence is unclear or cannot be confidently "
        "verified, return verification_status='uncertain'.\n"
        "12. Ignore section headings, template prompts, captions, and expected "
        "placement as proof. For example, 'Paste screenshot here' does not prove "
        "that the following image is the requested screenshot.\n"
        "13. For every claimed visual fact, verify it directly from the rendered "
        "image. Do not infer visual content from nearby extracted text, table "
        "values, captions, or template labels.\n"
        "14. Never state that an image shows a setting, source, response, "
        "citation, configuration, interface, or status unless that specific "
        "information is visibly identifiable in the image.\n"
        "15. When a task requires a specific number of screenshots, tests, "
        "responses, sources, examples, or other items, count only the items "
        "actually demonstrated in the evidence.\n"
        "16. For written requirements such as reflections or explanations, "
        "compare the actual submitted writing against every requested point. "
        "Do not treat unrelated or repeated text as satisfying the requirement.\n"
        "17. verified_facts must contain only facts independently supported by "
        "the supplied evidence. Put anything required but not demonstrated into "
        "missing_or_unverified.\n"
        "18. Return exactly one task verification for the supplied task code.\n"
        "19. Matching words, task names, headings, copied requirements, or "
        "similar wording do not demonstrate task completion. Text that merely "
        "repeats or paraphrases the requirement must not be treated as evidence "
        "that the required work was completed.\n"
        "20. Verification requires substantive evidence of the action, output, "
        "artefact, explanation, result, or state required by the task. If the "
        "submission only mentions the requirement without demonstrating it, "
        "return verification_status='not_verified'.\n"
        "21. Never infer missing task requirements from the surrounding "
        "submission, assignment context, template structure, headings, images, "
        "or apparent purpose of the document."
    )

    all_verifications = []
    usage_snapshots = []

    http_client = httpx.Client()

    try:
        client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            http_client=http_client,
        )

        for mapping in task_mappings:
            task_code = mapping.task_id
            task = task_lookup.get(task_code)

            if not task:
                continue

            if not _is_task_requirement_assessable(task):
                all_verifications.append(
                    TaskEvidenceVerification(
                        task_code=task_code,
                        verification_status="not_verified",
                        evidence_type_required="unspecified",
                        evidence_type_found="unverifiable",
                        visual_requirement_satisfied=None,
                        quantity_requirement_satisfied=None,
                        verified_facts=[],
                        missing_or_unverified=[
                            (
                                "The configured task requirement does not "
                                "define specific evidence that can be "
                                "reliably verified."
                            )
                        ],
                        reasoning=(
                            "The configured task title and required evidence "
                            "are too vague or circular to determine what must "
                            "actually be demonstrated. No requirement was "
                            "inferred from the submitted document."
                        ),
                    )
                )
                continue

            user_content = [
                {
                    "type": "text",
                    "text": (
                        f"ASSIGNMENT CONTEXT:\n"
                        f"{assignment_context}\n\n"

                        f"DOCUMENT AUTHENTICITY:\n"
                        f"{json.dumps(document_authenticity, indent=2)}\n\n"

                        f"=== TASK TO VERIFY ===\n"
                        f"Task Code: {task_code}\n"
                        f"Task Title: {task.title}\n"
                        f"Required Evidence / Instructions:\n"
                        f"{task.evidence_required or '-'}\n\n"

                        f"Potentially Relevant Pages: "
                        f"{mapping.mapped_page_numbers}\n\n"

                        "Independently inspect the evidence below. "
                        "Do not assume the mapped pages satisfy the task."
                    ),
                }
            ]

            verification_visual_pages = set(
                _sample_page_numbers(
                    [
                        page_num
                        for page_num in mapping.mapped_page_numbers
                        if page_num in image_page_numbers
                    ],
                    _setting_int("OPENAI_VERIFICATION_MAX_IMAGES", 24),
                )
            )
            remaining_verification_images = len(verification_visual_pages)
            verification_image_budget = ImagePayloadBudget.for_stage(
                f"evidence_verification_{task_code}"
            )

            for page_num in mapping.mapped_page_numbers:
                page = submission_pages.get(page_num)

                if not page:
                    continue

                user_content.append(
                    {
                        "type": "text",
                        "text": (
                            f"=== PAGE {page_num} ==="
                        ),
                    }
                )

                if getattr(page, "extracted_text", None):
                    user_content.append(
                        {
                            "type": "text",
                            "text": (
                                f"--- PAGE {page_num} EXTRACTED TEXT ---\n"
                                f"{page.extracted_text}"
                            ),
                        }
                    )

                if page_num in verification_visual_pages:
                    user_content.append(
                        {
                            "type": "text",
                            "text": (
                                f"--- PAGE {page_num} RENDERED IMAGE ---\n"
                                "Inspect this image independently. "
                                "Do not infer its contents from the "
                                "surrounding extracted text."
                            ),
                        }
                    )
                    append_page_image(
                        user_content,
                        page,
                        verification_image_budget,
                        remaining_images=remaining_verification_images,
                    )
                    # Remove the lazily-loaded BinaryField from the model cache
                    # after base64 payload creation to keep worker RSS bounded.
                    page.__dict__.pop("image_data", None)
                    remaining_verification_images = max(
                        0, remaining_verification_images - 1
                    )

            verification_image_budget.log_summary()
            verification_messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ]
            enforce_message_image_budget(
                verification_messages,
                stage=f"evidence_verification_{task_code}",
            )

            completion = client.beta.chat.completions.parse(
                model=settings.OPENAI_API_MODEL,
                messages=verification_messages,
                response_format=EvidenceVerificationResponse,
                # temperature=0.0,
            )

            parsed = completion.choices[0].message.parsed

            returned = [
                item
                for item in parsed.task_verifications
                if item.task_code == task_code
            ]

            if len(returned) != 1:
                raise ValueError(
                    "Evidence verifier returned an invalid result for "
                    f"{task_code}. Expected exactly 1 verification, "
                    f"received {len(returned)}."
                )

            all_verifications.append(
                returned[0]
            )

            usage_snapshots.append(
                _completion_usage_snapshot(
                    completion
                )
            )

        return {
            "result": EvidenceVerificationResponse(
                task_verifications=all_verifications
            ),
            "usage": _sum_usage_snapshots(
                usage_snapshots
            ),
        }

    finally:
        http_client.close()
        

def grade_submission(submission):
    task_mappings = SubmissionTaskMapping.objects.filter(submission=submission)
    if not task_mappings.exists():
        raise ValueError(f"No task mappings found for submission {submission.id}.")

    assignment_level = submission.context.assignment_level
    assignment_context = (
        f"Assignment Level Title: {assignment_level.title or '-'}\n"
        f"Skill Statement: {assignment_level.skill_statement or '-'}\n"
        f"Objective: {assignment_level.objective or '-'}\n"
        f"Scenario: {assignment_level.scenario or '-'}\n"
        f"Expected Outcome: {assignment_level.expected_outcome or '-'}\n"
    )

    criteria_mappings = (
        TaskCriteriaMapping.objects
        .filter(assignment_level=assignment_level)
        .select_related("task", "rubric_criterion")
    )
    if not criteria_mappings.exists():
        raise ValueError(
            "No task criteria mappings found for "
            f"AssignmentLevel {assignment_level.id}."
        )

    all_criteria_ids = set(
        RubricCriterion.objects.filter(assignment_level=assignment_level)
        .values_list("id", flat=True)
    )
    mapped_criteria_ids = set(
        criteria_mappings.values_list("rubric_criterion_id", flat=True)
    )
    unmapped_criteria_ids = all_criteria_ids - mapped_criteria_ids
    if unmapped_criteria_ids:
        unmapped_codes = list(
            RubricCriterion.objects.filter(id__in=unmapped_criteria_ids)
            .values_list("criterion_code", flat=True)
        )
        raise ValueError(
            "All rubric criteria must be assigned to at least one task before grading. "
            f"Unmapped criteria: {', '.join(unmapped_codes)}"
        )

    # Cache page text/metadata but defer BinaryField image bytes.  Criterion
    # grading loads only the bounded visual subset selected below.
    submission_pages = {
        page.page_number: page
        for page in (
            SubmissionPage.objects
            .filter(submission=submission)
            .defer("image_data")
        )
    }
    image_page_numbers = set(
        SubmissionPage.objects
        .filter(submission=submission, image_data__isnull=False)
        .values_list("page_number", flat=True)
    )
    task_pages_map = {
        mapping.task_id: mapping.mapped_page_numbers
        for mapping in task_mappings
    }
    authenticity_result = (
        analyze_document_authenticity(submission)
    )

    document_authenticity = (
        authenticity_result["analysis"]
    )

    verification_result = verify_task_evidence(
        submission=submission,
        task_mappings=task_mappings,
        assignment_context=assignment_context,
        document_authenticity=document_authenticity,
    )

    task_verification_map = {
        item.task_code: item.model_dump()
        for item in verification_result[
            "result"
        ].task_verifications
    }

    expected_task_codes = {
        mapping.task_id
        for mapping in task_mappings
    }

    returned_task_codes = set(
        task_verification_map.keys()
    )

    missing_verifications = (
        expected_task_codes - returned_task_codes
    )

    if missing_verifications:
        raise ValueError(
            "Evidence verification missing tasks: "
            + ", ".join(
                sorted(missing_verifications)
            )
        )

    verification_usage = {
        "stage": "evidence_verification",
        **verification_result["usage"],
    }

    criteria_weight_map = {}
    criterion_mapping_groups = {}
    for mapping in criteria_mappings:
        task_code = mapping.task.task_code
        criterion_id = str(mapping.rubric_criterion.id)
        pair_key = f"{task_code}_{criterion_id}"
        criteria_weight_map[pair_key] = {
            "weight": float(mapping.inferred_weight),
            "max_score": float(mapping.rubric_criterion.maximum_score),
        }
        criterion_mapping_groups.setdefault(criterion_id, []).append(mapping)

    grading_system_prompt = (
        "You are an academic evidence grader.\n\n"
        "Evaluate ONLY the rubric criterion and tasks supplied in this request. "
        "Do not evaluate other assignment criteria.\n\n"
        "SCORING RULES:\n"
        "1. Use only the supplied task requirements, rubric criterion, rubric bands, document authenticity analysis, mapping information, and submitted evidence.\n"
        "2. Evidence must demonstrate the requirement. A learner claim does not by itself verify an observable implementation or configuration.\n"
        "3. SYNTHETIC EVIDENCE RULE: If the Document Authenticity "
        "Analysis identifies a section, screenshot, table, response, "
        "reflection, test result, configuration record, caption, summary, "
        "or other artefact as synthetic, placeholder, mock, sample, "
        "fabricated, test-only, not genuine, or not evidence of completed "
        "work, that affected content MUST NOT establish task completion. "
        "This restriction applies to ALL claims derived from that affected "
        "content, including written tables, captions, transcriptions, "
        "summaries, explanations, and screenshots. Do not award partial "
        "completion credit merely because synthetic content accurately "
        "describes what a correct submission would contain.\n"
        "4. Only separate genuine evidence may earn completion credit. "
        "If an affected task has no separate genuine evidence, score it "
        "according to the rubric as missing/unverified evidence.\n"
        "5. EVIDENCE VERIFICATION IS AUTHORITATIVE: The supplied Evidence "
        "Verification is the authoritative determination of what the submitted "
        "evidence actually demonstrates. Do not override it based on captions, "
        "tables, surrounding text, mapper justification, or assumptions about "
        "what an image should contain. If Evidence Verification says a required "
        "visual, quantity, configuration, response, or artefact is not_verified "
        "or partial, grade on that basis.\n"
        "If verification_status='not_verified', no required evidence for that "
        "task has been verified and score_percentage must be 0. Do not award "
        "credit for relevance, effort, keyword similarity, plausible claims, "
        "document quality, or content that resembles an expected solution.\n"
        "If verification_status='partial', award credit only for the specific "
        "facts listed in verified_facts and do not award credit for requirements "
        "listed in missing_or_unverified.\n"
        "6. For tasks requiring screenshots, configuration states, outputs, interfaces, testing results, dashboards, or other observable artefacts, written descriptions may support intent but cannot substitute for required genuine observable evidence.\n"
        "7. For reflective, explanatory, or written requirements, genuine written evidence may be sufficient unless the submission explicitly identifies that content as synthetic or invalid.\n"
        "8. If genuine evidence is incomplete, contradictory, or otherwise "
        "insufficient, reduce score_percentage according to the verified evidence "
        "and rubric. Do not use this rule to override the mandatory zero score "
        "for verification_status='not_verified'.\n"
        "9. Follow the supplied rubric descriptors. Do not automatically give high partial credit simply because some related text exists.\n"
        "10. Return exactly one criterion_evaluation for every Task Code + Rubric Criterion ID pair supplied in this request, and no other pairs.\n\n"
        "11. Do NOT mention grading band names, performance band labels, "
        "pass/fail labels, or statements such as 'Foundation', 'Proficient', "
        "'Expert', 'meets the band', or 'does not meet the band' in task-level "
        "feedback. Describe only what evidence was demonstrated, missing, "
        "incomplete, incorrect, or needs improvement. Band assignment is handled "
        "separately by the application.\n"
        "FEEDBACK:\n"
        "State what the verified evidence demonstrates. If the score is below "
        "100, identify the exact missing, invalid, incomplete, or incorrect "
        "evidence and finish with a concrete action the learner can take. "
        "Do not mention grading bands, band names, pass/fail status, score ranges, "
        "or scoring mechanics. Keep wording neutral, concise, evidence-based, "
        "and learner-facing."
    )

    http_client = httpx.Client()
    client = OpenAI(api_key=settings.OPENAI_API_KEY, http_client=http_client)
    grading_call_usage = [
        verification_usage,
    ]
    all_evaluations = []

    try:
        for criterion_id, group_mappings in criterion_mapping_groups.items():
            criterion = group_mappings[0].rubric_criterion
            rubric_bands = (
                RubricBand.objects.filter(rubric_criterion=criterion)
                .order_by("sequence")
            )
            rubric_band_text = "\n".join(
                f"- {band.display_name}: {band.minimum_percentage}% to {band.maximum_percentage}% — {band.descriptor}"
                for band in rubric_bands
            ) or "No rubric bands configured."

            criterion_user_content = [{
                "type": "text",
                "text": (
                    f"Submission ID: {submission.id}\n\n"
                    f"ASSIGNMENT CONTEXT:\n{assignment_context}\n\n"
                    f"DOCUMENT AUTHENTICITY ANALYSIS:\n"
                    f"{json.dumps(document_authenticity, indent=2)}\n\n"
                    "RUBRIC CRITERION:\n"
                    f"Criterion ID: {criterion_id}\n"
                    f"Criterion Code: {criterion.criterion_code}\n"
                    f"Title: {criterion.title}\n"
                    f"Description: {criterion.description or '-'}\n"
                    f"Maximum Score: {criterion.maximum_score}\n\n"
                    f"RUBRIC BANDS:\n{rubric_band_text}\n"
                ),
            }]

            required_pairs = []
            pages_already_added = set()
            criterion_page_numbers = {
                page_num
                for group_mapping in group_mappings
                for page_num in task_pages_map.get(
                    group_mapping.task.task_code, []
                )
            }
            criterion_visual_pages = set(
                _sample_page_numbers(
                    [
                        page_num
                        for page_num in criterion_page_numbers
                        if page_num in image_page_numbers
                    ],
                    _setting_int("OPENAI_CRITERION_MAX_IMAGES", 24),
                )
            )
            remaining_criterion_images = len(criterion_visual_pages)
            criterion_image_budget = ImagePayloadBudget.for_stage(
                f"criterion_grading_{criterion.criterion_code}"
            )

            for mapping in group_mappings:
                task_code = mapping.task.task_code

                verification = task_verification_map.get(
                    task_code,
                    {},
                )
                required_pairs.append(f"{task_code}_{criterion_id}")
                mapped_pages = task_pages_map.get(task_code, [])
                submission_task_mapping = next(
                    (item for item in task_mappings if item.task_id == task_code),
                    None,
                )
                criterion_user_content.append(
                    {
                        "type": "text",
                        "text": (
                            "\n=== TASK TO EVALUATE ===\n"
                            f"Task Code: {task_code}\n"
                            f"Task Title: {mapping.task.title}\n"
                            f"Required Evidence: {mapping.task.evidence_required or '-'}\n"
                            f"Task Weight Within Criterion: {mapping.inferred_weight}%\n"
                            f"Mapped Pages: {mapped_pages if mapped_pages else 'NO EVIDENCE FOUND'}\n"
                            f"Mapping Justification: "
                            f"{submission_task_mapping.justification if submission_task_mapping else '-'}\n\n"
                            f"EVIDENCE VERIFICATION:\n"
                            f"{json.dumps(verification, indent=2)}\n"
                        ),
                    }
                )

                for page_num in mapped_pages:
                    if page_num in pages_already_added:
                        continue
                    page_obj = submission_pages.get(page_num)
                    if not page_obj:
                        continue
                    pages_already_added.add(page_num)
                    if getattr(page_obj, "extracted_text", None):
                        criterion_user_content.append({
                            "type": "text",
                            "text": f"--- PAGE {page_num} TEXT ---\n{page_obj.extracted_text}",
                        })
                    if page_num in criterion_visual_pages:
                        criterion_user_content.append({
                            "type": "text",
                            "text": f"--- PAGE {page_num} RENDERED IMAGE ---",
                        })
                        append_page_image(
                            criterion_user_content,
                            page_obj,
                            criterion_image_budget,
                            remaining_images=remaining_criterion_images,
                        )
                        page_obj.__dict__.pop("image_data", None)
                        remaining_criterion_images = max(
                            0, remaining_criterion_images - 1
                        )

            criterion_user_content.append({
                "type": "text",
                "text": (
                    "\nREQUIRED OUTPUT PAIRS:\n"
                    + "\n".join(f"- {pair}" for pair in required_pairs)
                    + "\n\nReturn exactly these pairs."
                ),
            })

            criterion_image_budget.log_summary()

            criterion_messages = [
                {"role": "system", "content": grading_system_prompt},
                {"role": "user", "content": criterion_user_content},
            ]
            enforce_message_image_budget(
                criterion_messages,
                stage=f"criterion_grading_{criterion.criterion_code}",
            )
            completion = client.beta.chat.completions.parse(
                model=settings.OPENAI_API_MODEL,
                messages=criterion_messages,
                response_format=GradingResponseSchema,
                # temperature=0.0,
            )
            grading_call_usage.append({
                "stage": f"criterion_grading_{criterion.criterion_code}",
                **_completion_usage_snapshot(completion),
            })
            result = completion.choices[0].message.parsed
            expected_keys = set(required_pairs)
            returned_keys = [
                f"{item.task_code}_{item.rubric_criterion_id}"
                for item in result.criterion_evaluations
            ]
            if set(returned_keys) != expected_keys or len(returned_keys) != len(expected_keys):
                raise ValueError(
                    "AI returned incorrect evaluation pairs for criterion "
                    f"{criterion.criterion_code}. Expected: {sorted(expected_keys)}; "
                    f"received: {sorted(returned_keys)}."
                )
            
            for item in result.criterion_evaluations:
                verification = task_verification_map.get(
                    item.task_code,
                    {},
                )

                verification_status = verification.get(
                    "verification_status",
                    "",
                )

                if verification_status == "not_verified":
                    item.score_percentage = 0.0
                    item.passed = False


            all_evaluations.extend(result.criterion_evaluations)

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

    summary_input = "\n".join(
        f"- {item.task_code}: {item.score_percentage:.2f}% — {item.feedback}"
        for item in all_evaluations
    )
    summary_prompt = (
        "Write learner-facing overall assignment feedback. "
        "Use only the supplied task evaluation summaries. "
        "Write 3 to 5 natural sentences. Thank the learner for submitting the assignment, "
        "state that it was reviewed against the requirements, give one high-level evidence-based observation, "
        "direct them to detailed criterion feedback, and encourage them to use the feedback for improvement. "
        "Do not mention marks, percentages, task codes, criterion codes, grading bands, pass/fail labels, or scoring mechanics. "
        "Do not invent strengths or weaknesses."
    )
    summary_completion = client.beta.chat.completions.parse(
        model=settings.OPENAI_API_MODEL,
        messages=[
            {"role": "system", "content": summary_prompt},
            {"role": "user", "content": summary_input},
        ],
        response_format=OverallSummaryResponseSchema,
        # temperature=0.0,
    )
    grading_call_usage.append({
        "stage": "overall_summary",
        **_completion_usage_snapshot(summary_completion),
    })
    overall_feedback = summary_completion.choices[0].message.parsed.overall_summary.strip()
    if not overall_feedback:
        overall_feedback = _neutral_overall_feedback()

    aggregated_ai_response = {
        "submission_id": str(submission.id),
        "criterion_evaluations": [
            item.model_dump()
            for item in all_evaluations
        ],
        "overall_summary": overall_feedback,
        "document_authenticity": document_authenticity,
        "evidence_verification": task_verification_map,
    }
    update_grading_audit(submission, raw_ai_response=aggregated_ai_response)
    record_submission_event(
        submission,
        stage="ai_grading",
        status="success",
        event_code="AI_RESPONSE_RECEIVED",
        message="AI grading response received and retained for audit.",
        details={"criterion_evaluation_count": len(all_evaluations)},
    )

    criterion_groups = {}
    for item in all_evaluations:
        key = f"{item.task_code}_{item.rubric_criterion_id}"
        mapping_info = criteria_weight_map.get(key, {})
        criterion_id = item.rubric_criterion_id
        if criterion_id not in criterion_groups:
            criterion_groups[criterion_id] = {
                "max_score": mapping_info.get("max_score", 0.0),
                "task_evaluations": [],
            }
        criterion_groups[criterion_id]["task_evaluations"].append({
            "item": item,
            "weight": mapping_info.get("weight", 0.0),
        })

    total_earned_points = 0.0
    all_criteria = RubricCriterion.objects.filter(assignment_level=assignment_level)
    total_max_possible_points = sum(float(c.maximum_score) for c in all_criteria)
    evaluated_items = []
    CriterionResult.objects.filter(submission=submission).delete()

    for criterion_id, group_data in criterion_groups.items():
        criterion_max_score = group_data["max_score"]
        criterion_earned = 0.0
        criterion_feedback = []
        for task_eval in group_data["task_evaluations"]:
            item = task_eval["item"]
            weight = task_eval["weight"]
            task_earned = (
                (item.score_percentage / 100.0)
                * (weight / 100.0)
                * criterion_max_score
            )
            total_earned_points += task_earned
            criterion_earned += task_earned
            item_feedback = (item.feedback or "").strip()
            criterion_feedback.append(f"{item.task_code}: {item_feedback}")
            evaluated_items.append({
                "task_code": item.task_code,
                "rubric_criterion_id": item.rubric_criterion_id,
                "score_percentage": item.score_percentage,
                "inferred_weight": weight,
                "earned_points": round(task_earned, 2),
                "criterion_max_score": criterion_max_score,
                "passed": item.passed,
                "feedback": item_feedback,
                "mapped_page_numbers": task_pages_map.get(item.task_code, []),
                "mapping_confidence": next(
                    (mapped.confidence_score for mapped in task_mappings if mapped.task_id == item.task_code),
                    0.0,
                ),
                "mapping_justification": next(
                    (mapped.justification for mapped in task_mappings if mapped.task_id == item.task_code),
                    "",
                ),
            })

        CriterionResult.objects.create(
            submission=submission,
            rubric_criterion_id=criterion_id,
            awarded_marks=round(criterion_earned, 2),
            feedback="\n".join(criterion_feedback),
        )

    overall_percentage = (
        round((total_earned_points / total_max_possible_points) * 100.0, 2)
        if total_max_possible_points > 0 else 0.0
    )
    achieved_band = determine_overall_band(assignment_level, overall_percentage)
    submission.achieved_band = achieved_band
    submission.final_score = round(total_earned_points, 2)
    submission.maximum_score = round(total_max_possible_points, 2)
    submission.feedback = overall_feedback
    submission.status = submission.Status.COMPLETED
    submission.completed_at = timezone.now()
    submission.save(update_fields=[
        "final_score", "maximum_score", "feedback",
        "status", "completed_at", "achieved_band",
    ])

    return {
        "submission_id": str(submission.id),
        "total_earned_points": round(total_earned_points, 2),
        "total_max_possible_points": round(total_max_possible_points, 2),
        "overall_percentage": overall_percentage,
        "overall_summary": overall_feedback,
        "criterion_results": evaluated_items,
        "token_usage": {
            "calls": grading_call_usage,
            "total": _sum_usage_snapshots(grading_call_usage),
        },
    }
