import io
import hashlib
import json
import logging
import pdfplumber

from django.conf import settings
from django.utils import timezone

from pdf2image import convert_from_path
from django.core.files.base import ContentFile
from .models import LearnerSubmission, SubmissionPage
from .audit import record_submission_event, update_grading_audit
from grading.services.submission_grader import (
    grade_submission,
    map_submission_tasks,
)

from grading.models import (
    CriterionResult,
    RubricBand,
    RubricCriterion,
    SubmissionTaskMapping,
    Task,
    TaskCriteriaMapping,
)

import zipfile
from pathlib import Path

from django.core.files.base import ContentFile

MAX_EXTRACTED_PDF_SIZE = 50 * 1024 * 1024

SCORE_CONSISTENCY_THRESHOLD = 5.0
GRADING_POLICY_VERSION = "submission_grader_v1_authenticity_20261121"

logger = logging.getLogger(__name__)

def _sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def _sha256_uploaded_file(uploaded_file) -> str:
    digest = hashlib.sha256()

    uploaded_file.seek(0)

    for chunk in iter(lambda: uploaded_file.read(1024 * 1024), b""):
        digest.update(chunk)

    uploaded_file.seek(0)

    return digest.hexdigest()

def build_grading_config_sha256_for_level(assignment_level) -> str:
    """Create a stable snapshot hash of configuration that can affect grading."""

    criteria = list(
        RubricCriterion.objects
        .filter(assignment_level=assignment_level)
        .order_by("sequence", "id")
    )
    criteria_ids = [criterion.id for criterion in criteria]

    bands = list(
        RubricBand.objects
        .filter(rubric_criterion_id__in=criteria_ids)
        .select_related("rubric_criterion")
        .order_by("rubric_criterion__sequence", "sequence", "id")
    )

    tasks = list(
        Task.objects
        .filter(assignment_level=assignment_level)
        .order_by("sequence", "id")
    )

    mappings = list(
        TaskCriteriaMapping.objects
        .filter(assignment_level=assignment_level)
        .select_related("task", "rubric_criterion")
        .order_by("task__sequence", "rubric_criterion__sequence", "id")
    )

    payload = {
        "policy_version": GRADING_POLICY_VERSION,
        "model_name": getattr(settings, "OPENAI_API_MODEL", ""),
        "assignment_level": {
            "id": str(assignment_level.id),
            "level_code": getattr(assignment_level, "level_code", ""),
            "title": getattr(assignment_level, "title", "") or "",
            "skill_statement": getattr(assignment_level, "skill_statement", "") or "",
            "objective": getattr(assignment_level, "objective", "") or "",
            "scenario": getattr(assignment_level, "scenario", "") or "",
            "expected_outcome": getattr(assignment_level, "expected_outcome", "") or "",
        },
        "criteria": [
            {
                "id": str(item.id),
                "criterion_code": item.criterion_code,
                "title": item.title,
                "description": item.description or "",
                "maximum_score": str(item.maximum_score),
                "sequence": item.sequence,
            }
            for item in criteria
        ],
        "bands": [
            {
                "criterion_id": str(item.rubric_criterion_id),
                "band_code": item.band_code,
                "display_name": item.display_name,
                "minimum_percentage": str(item.minimum_percentage),
                "maximum_percentage": str(item.maximum_percentage),
                "descriptor": item.descriptor or "",
                "sequence": item.sequence,
            }
            for item in bands
        ],
        "tasks": [
            {
                "id": str(item.id),
                "task_code": item.task_code,
                "title": item.title,
                "evidence_required": item.evidence_required or "",
                "sequence": item.sequence,
            }
            for item in tasks
        ],
        "task_criteria_mappings": [
            {
                "task_id": str(item.task_id),
                "rubric_criterion_id": str(item.rubric_criterion_id),
                "inferred_weight": str(item.inferred_weight),
            }
            for item in mappings
        ],
    }

    canonical = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()

def build_grading_config_sha256(
    submission: LearnerSubmission,
) -> str:
    return build_grading_config_sha256_for_level(
        submission.assignment_level
    )


def copy_previous_grading_result(
    source_submission,
    target_submission,
):
    target_submission.final_score = source_submission.final_score
    target_submission.maximum_score = source_submission.maximum_score
    target_submission.achieved_band = source_submission.achieved_band
    target_submission.feedback = source_submission.feedback
    target_submission.status = LearnerSubmission.Status.COMPLETED
    target_submission.completed_at = timezone.now()
    target_submission.page_count = source_submission.page_count

    target_submission.save(
        update_fields=[
            "final_score",
            "maximum_score",
            "achieved_band",
            "feedback",
            "status",
            "completed_at",
            "page_count",
        ]
    )

    CriterionResult.objects.bulk_create(
        [
            CriterionResult(
                submission=target_submission,
                rubric_criterion=result.rubric_criterion,
                awarded_marks=result.awarded_marks,
                achievement_band=result.achievement_band,
                feedback=result.feedback,
            )
            for result in source_submission.criterion_results.all()
        ]
    )

    SubmissionTaskMapping.objects.bulk_create(
        [
            SubmissionTaskMapping(
                submission=target_submission,
                task_id=mapping.task_id,
                task_description=mapping.task_description,
                mapped_page_numbers=mapping.mapped_page_numbers,
                confidence_score=mapping.confidence_score,
                justification=mapping.justification,
            )
            for mapping in source_submission.task_mappings.all()
        ]
    )

    if hasattr(source_submission, "grading_audit"):
        source_audit = source_submission.grading_audit

        update_grading_audit(
            target_submission,
            status="completed",
            model_name=source_audit.model_name,
            grader_version=source_audit.grader_version,
            task_mapping_snapshot=source_audit.task_mapping_snapshot,
            raw_ai_response=source_audit.raw_ai_response,
            criterion_evaluations=source_audit.criterion_evaluations,
            scoring_snapshot=source_audit.scoring_snapshot,
            overall_summary=source_audit.overall_summary,
            completed_at=timezone.now(),
            error_code="",
            error_message="",
        )

    record_submission_event(
        target_submission,
        stage="grading_reuse",
        status="success",
        event_code="GRADING_RESULT_REUSED",
        message=(
            "The grading result was reused from an earlier attempt "
            "with identical file content and grading configuration."
        ),
        details={
            "source_submission_id": str(source_submission.id),
            "source_attempt_number": source_submission.attempt_number,
        },
    )

    return target_submission

def prepare_submission_file(uploaded_file):
    """
    Accept:
    - PDF directly
    - ZIP containing exactly one PDF

    ZIP may contain other files such as PBIX, but only the PDF
    is extracted and passed to the grading pipeline.
    """

    original_filename = uploaded_file.name
    extension = Path(original_filename).suffix.lower()

    if extension == ".pdf":
        return uploaded_file, original_filename

    if extension != ".zip":
        raise ValueError(
            "Unsupported file type. Please upload a PDF or "
            "a ZIP file containing one PDF."
        )

    try:
        uploaded_file.seek(0)

        with zipfile.ZipFile(uploaded_file) as archive:
            pdf_entries = [
                entry
                for entry in archive.infolist()
                if (
                    not entry.is_dir()
                    and Path(entry.filename).suffix.lower() == ".pdf"
                )
            ]

            if len(pdf_entries) == 0:
                raise ValueError(
                    "The ZIP file does not contain a PDF."
                )

            if len(pdf_entries) > 1:
                raise ValueError(
                    "The ZIP file contains more than one PDF. "
                    "Please submit a ZIP containing exactly one PDF."
                )

            pdf_entry = pdf_entries[0]

            if pdf_entry.file_size > MAX_EXTRACTED_PDF_SIZE:
                raise ValueError(
                    "The PDF inside the ZIP cannot exceed 50 MB."
                )

            pdf_bytes = archive.read(pdf_entry)

            if not pdf_bytes.startswith(b"%PDF"):
                raise ValueError(
                    "The PDF inside the ZIP is not a valid PDF file."
                )

            extracted_name = Path(pdf_entry.filename).name

            grading_file = ContentFile(
                pdf_bytes,
                name=extracted_name,
            )

            return grading_file, original_filename

    except zipfile.BadZipFile:
        raise ValueError(
            "The uploaded ZIP file is invalid or corrupted."
        )

def extract_submission_pages(submission: LearnerSubmission) -> LearnerSubmission:
    """
    Renders PDF pages to WebP byte streams and extracts raw text.
    Saves both text and binary image data directly into the DB.
    Includes bounds checking to prevent IndexError if page counts differ.
    """
    if not submission.submitted_file:
        record_submission_event(
            submission,
            stage="extraction",
            status="error",
            event_code="NO_SUBMISSION_FILE",
            message="No file was attached to the accepted submission attempt.",
        )
        raise ValueError("No file attached to this submission.")

    record_submission_event(
        submission,
        stage="extraction",
        status="started",
        event_code="PDF_EXTRACTION_STARTED",
        message="PDF page rendering and text extraction started.",
    )

    pdf_path = submission.submitted_file.path

    content_sha256 = _sha256_file(pdf_path)
    if submission.content_sha256 != content_sha256:
        submission.content_sha256 = content_sha256
        submission.save(update_fields=["content_sha256"])

    submission.pages.all().delete()

    try:
        images = convert_from_path(pdf_path, dpi=200, fmt="webp")

        with pdfplumber.open(pdf_path) as pdf:
            for index, page_image in enumerate(images):
                page_number = index + 1
                extracted_text = ""

                if index < len(pdf.pages):
                    extracted_text = pdf.pages[index].extract_text() or ""
                    extracted_text = extracted_text.replace("\x00", "")

                image_buffer = io.BytesIO()
                page_image.save(image_buffer, format="WEBP")
                raw_image_bytes = image_buffer.getvalue()

                SubmissionPage.objects.create(
                    submission=submission,
                    page_number=page_number,
                    extracted_text=extracted_text.strip(),
                    image_data=raw_image_bytes,
                    image_mime_type="image/webp",
                )

        submission.status = LearnerSubmission.Status.PROCESSING
        submission.page_count = len(images)
        submission.save(update_fields=["status", "page_count"])

        record_submission_event(
            submission,
            stage="extraction",
            status="success",
            event_code="PDF_EXTRACTION_COMPLETED",
            message="PDF pages were rendered and extracted successfully.",
            details={"pages_extracted": len(images)},
        )
        return submission
    except Exception as exc:
        submission.status = LearnerSubmission.Status.ERROR
        submission.save(update_fields=["status"])
        record_submission_event(
            submission,
            stage="extraction",
            status="error",
            event_code="PDF_EXTRACTION_ERROR",
            message="The submitted PDF could not be fully prepared for grading.",
            details={
                "error_type": type(exc).__name__,
                "error_message": str(exc),
            },
        )
        raise

def run_ai_grading(submission):
    update_grading_audit(
        submission,
        status="started",
        model_name=getattr(settings, "OPENAI_API_MODEL", ""),
        grader_version="submission_grader_v1",
        started_at=timezone.now(),
        error_code="",
        error_message="",
    )

    try:
        submission = extract_submission_pages(submission)

        grading_config_sha256 = build_grading_config_sha256(submission)
        if submission.grading_config_sha256 != grading_config_sha256:
            submission.grading_config_sha256 = grading_config_sha256
            submission.save(update_fields=["grading_config_sha256"])

        record_submission_event(
            submission,
            stage="task_mapping",
            status="started",
            event_code="TASK_MAPPING_STARTED",
            message="AI evidence-to-task mapping started.",
        )

        try:
            mapping_result = map_submission_tasks(submission)
        except Exception as exc:
            record_submission_event(
                submission,
                stage="task_mapping",
                status="error",
                event_code="TASK_MAPPING_ERROR",
                message="AI evidence-to-task mapping failed.",
                details={
                    "error_type": type(exc).__name__,
                    "error_message": str(exc),
                },
            )
            raise

        update_grading_audit(
            submission,
            task_mapping_snapshot=mapping_result,
        )

        record_submission_event(
            submission,
            stage="task_mapping",
            status="success",
            event_code="TASK_MAPPING_COMPLETED",
            message="AI evidence-to-task mapping completed.",
            details={
                "tasks_processed": mapping_result.get("tasks_processed"),
                "saved_mappings_count": mapping_result.get("saved_mappings_count"),
                "is_unrelated_document": mapping_result.get("is_unrelated_document"),
            },
        )

        if mapping_result.get("is_unrelated_document"):
            submission.status = LearnerSubmission.Status.ERROR
            submission.feedback = (
                "We detected that the submitted file does not "
                "appear to be related to this assignment. "
                "Please check that you uploaded the correct "
                "document and submit again."
            )
            submission.save(update_fields=["status", "feedback"])

            update_grading_audit(
                submission,
                status="error",
                error_code="UNRELATED_DOCUMENT",
                error_message=submission.feedback,
                completed_at=timezone.now(),
            )
            record_submission_event(
                submission,
                stage="task_mapping",
                status="error",
                event_code="UNRELATED_DOCUMENT",
                message="The submitted document was assessed as unrelated to the assignment.",
            )
            return submission

        record_submission_event(
            submission,
            stage="ai_grading",
            status="started",
            event_code="AI_GRADING_STARTED",
            message="AI criterion grading started.",
        )

        try:
            grading_result = grade_submission(submission)
        except Exception as exc:
            update_grading_audit(
                submission,
                status="error",
                error_code=type(exc).__name__.upper(),
                error_message=str(exc),
                completed_at=timezone.now(),
            )
            record_submission_event(
                submission,
                stage="ai_grading",
                status="error",
                event_code="AI_OR_SCORING_ERROR",
                message="AI grading or score calculation did not complete.",
                details={
                    "error_type": type(exc).__name__,
                    "error_message": str(exc),
                },
            )
            raise

        update_grading_audit(
            submission,
            status="completed",
            criterion_evaluations=grading_result.get("criterion_results", []),
            scoring_snapshot={
                "total_earned_points": grading_result.get("total_earned_points"),
                "total_max_possible_points": grading_result.get("total_max_possible_points"),
                "overall_percentage": grading_result.get("overall_percentage"),
                "achieved_band": submission.achieved_band,
                "token_usage": {
                    "task_mapping": mapping_result.get("token_usage", {}),
                    "grading": grading_result.get("token_usage", {}),
                    "total": {
                        key: (
                            int(mapping_result.get("token_usage", {}).get(key, 0) or 0)
                            + int(
                                grading_result.get("token_usage", {})
                                .get("total", {})
                                .get(key, 0)
                                or 0
                            )
                        )
                        for key in (
                            "input_tokens",
                            "cached_input_tokens",
                            "output_tokens",
                            "reasoning_tokens",
                            "total_tokens",
                        )
                    },
                },
            },
            overall_summary=grading_result.get("overall_summary", ""),
            completed_at=timezone.now(),
            error_code="",
            error_message="",
        )

        record_submission_event(
            submission,
            stage="scoring",
            status="success",
            event_code="SCORING_COMPLETED",
            message="Criterion marks and final result were calculated successfully.",
            details={
                "total_earned_points": grading_result.get("total_earned_points"),
                "total_max_possible_points": grading_result.get("total_max_possible_points"),
                "overall_percentage": grading_result.get("overall_percentage"),
                "achieved_band": submission.achieved_band,
            },
        )

        submission.refresh_from_db()
        return submission

    except Exception as exc:
        submission.status = LearnerSubmission.Status.ERROR
        submission.save(update_fields=["status"])
        update_grading_audit(
            submission,
            status="error",
            error_code=type(exc).__name__.upper(),
            error_message=str(exc),
            completed_at=timezone.now(),
        )
        raise

def maybe_recheck_grading_consistency(submission):
    """
    Re-grade once only when this completed attempt is an exact PDF/config
    match for one or more earlier completed attempts and its score is more
    than SCORE_CONSISTENCY_THRESHOLD percentage points away from every
    matching historical score.

    The closest historical score is used only to decide whether a recheck
    is needed. Historical scores are never copied, averaged, or forced onto
    the current attempt. The one recheck result becomes final.
    """
    if (
        submission.status != LearnerSubmission.Status.COMPLETED
        or not submission.content_sha256
        or not submission.grading_config_sha256
        or submission.final_score is None
        or submission.maximum_score is None
        or float(submission.maximum_score) <= 0
    ):
        return submission

    assignment = submission.assignment_level.assignment
    cohort = submission.context.cohort

    previous_matches = list(
        LearnerSubmission.objects
        .filter(
            learner=submission.learner,
            context__cohort=cohort,
            assignment_level__assignment=assignment,
            status=LearnerSubmission.Status.COMPLETED,
            content_sha256=submission.content_sha256,
            grading_config_sha256=submission.grading_config_sha256,
            final_score__isnull=False,
            maximum_score__isnull=False,
            submitted_at__lt=submission.submitted_at,
        )
        .exclude(id=submission.id)
        .order_by("-submitted_at")
    )

    historical_scores = []
    for previous in previous_matches:
        previous_maximum = float(previous.maximum_score or 0)
        if previous_maximum <= 0:
            continue

        previous_percentage = (
            float(previous.final_score)
            / previous_maximum
        ) * 100.0

        historical_scores.append(
            {
                "submission": previous,
                "percentage": previous_percentage,
            }
        )

    if not historical_scores:
        return submission

    current_percentage = (
        float(submission.final_score)
        / float(submission.maximum_score)
    ) * 100.0

    closest_match = min(
        historical_scores,
        key=lambda item: abs(
            current_percentage - item["percentage"]
        ),
    )
    closest_delta = abs(
        current_percentage - closest_match["percentage"]
    )

    history_details = [
        {
            "submission_id": str(item["submission"].id),
            "attempt_number": item["submission"].attempt_number,
            "percentage": round(item["percentage"], 2),
        }
        for item in historical_scores
    ]

    if closest_delta <= SCORE_CONSISTENCY_THRESHOLD:
        record_submission_event(
            submission,
            stage="consistency_check",
            status="success",
            event_code="CONSISTENCY_CHECK_PASSED",
            message=(
                "Exact matching historical submission is within the allowed "
                "score difference."
            ),
            details={
                "closest_submission_id": str(
                    closest_match["submission"].id
                ),
                "closest_previous_percentage": round(
                    closest_match["percentage"], 2
                ),
                "current_percentage": round(current_percentage, 2),
                "closest_score_delta": round(closest_delta, 2),
                "threshold": SCORE_CONSISTENCY_THRESHOLD,
                "matching_history": history_details,
            },
        )
        return submission

    record_submission_event(
        submission,
        stage="consistency_check",
        status="warning",
        event_code="CONSISTENCY_RECHECK_STARTED",
        message=(
            "Exact matching historical submissions are all outside the "
            "score-difference threshold; grading is being rechecked once."
        ),
        details={
            "closest_submission_id": str(
                closest_match["submission"].id
            ),
            "closest_previous_percentage": round(
                closest_match["percentage"], 2
            ),
            "initial_percentage": round(current_percentage, 2),
            "closest_score_delta": round(closest_delta, 2),
            "threshold": SCORE_CONSISTENCY_THRESHOLD,
            "matching_history": history_details,
        },
    )

    try:
        recheck_result = grade_submission(submission)

    except ValueError as exc:
        if "AI returned incorrect evaluation pairs" not in str(exc):
            raise

        logger.warning(
            "Retrying consistency recheck for submission %s "
            "after invalid AI evaluation pairs.",
            submission.id,
        )

        record_submission_event(
            submission,
            stage="consistency_check",
            status="warning",
            event_code="CONSISTENCY_RECHECK_INVALID_AI_PAIRS_RETRY",
            message=(
                "The consistency recheck is being retried once because "
                "the AI returned an invalid evaluation structure."
            ),
            details={
                "error_message": str(exc),
            },
        )

        recheck_result = grade_submission(submission)

    submission.refresh_from_db()

    resolved_percentage = (
        float(submission.final_score)
        / float(submission.maximum_score)
    ) * 100.0

    resolved_closest_match = min(
        historical_scores,
        key=lambda item: abs(
            resolved_percentage - item["percentage"]
        ),
    )
    resolved_closest_delta = abs(
        resolved_percentage
        - resolved_closest_match["percentage"]
    )

    update_grading_audit(
        submission,
        status="completed",
        criterion_evaluations=recheck_result.get(
            "criterion_results", []
        ),
        scoring_snapshot={
            "total_earned_points": recheck_result.get(
                "total_earned_points"
            ),
            "total_max_possible_points": recheck_result.get(
                "total_max_possible_points"
            ),
            "overall_percentage": recheck_result.get(
                "overall_percentage"
            ),
            "achieved_band": submission.achieved_band,
            "consistency_recheck": {
                "initial_percentage": round(
                    current_percentage, 2
                ),
                "resolved_percentage": round(
                    resolved_percentage, 2
                ),
                "closest_historical_percentage_after_recheck": round(
                    resolved_closest_match["percentage"], 2
                ),
                "closest_delta_after_recheck": round(
                    resolved_closest_delta, 2
                ),
                "still_outside_threshold": (
                    resolved_closest_delta
                    > SCORE_CONSISTENCY_THRESHOLD
                ),
                "threshold": SCORE_CONSISTENCY_THRESHOLD,
                "matching_history": history_details,
            },
            "token_usage": {
                "grading": recheck_result.get(
                    "token_usage", {}
                ),
            },
        },
        overall_summary=recheck_result.get("overall_summary", ""),
        completed_at=timezone.now(),
        error_code="",
        error_message="",
    )

    record_submission_event(
        submission,
        stage="consistency_check",
        status="success",
        event_code="CONSISTENCY_RECHECK_COMPLETED",
        message=(
            "Automatic consistency recheck completed; the rechecked result "
            "is authoritative."
        ),
        details={
            "initial_percentage": round(current_percentage, 2),
            "resolved_percentage": round(resolved_percentage, 2),
            "closest_historical_percentage_after_recheck": round(
                resolved_closest_match["percentage"], 2
            ),
            "closest_delta_after_recheck": round(
                resolved_closest_delta, 2
            ),
            "still_outside_threshold": (
                resolved_closest_delta
                > SCORE_CONSISTENCY_THRESHOLD
            ),
            "threshold": SCORE_CONSISTENCY_THRESHOLD,
        },
    )

    return submission

def determine_overall_band(
    assignment_level,
    overall_percentage: float,
) -> str:
    bands = (
        RubricBand.objects
        .filter(
            rubric_criterion__assignment_level=assignment_level,
        )
        .order_by(
            "sequence",
        )
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

    # Multiple criteria can contain the same band,
    # so return the first distinct matching band code.
    band_codes = {
        band.band_code
        for band in matching_bands
    }

    if len(band_codes) > 1:
        raise ValueError(
            "Multiple grading bands match "
            f"{overall_percentage}%: "
            f"{sorted(band_codes)}. "
            "Check the configured band percentage ranges."
        )

    return matching_bands[0].band_code