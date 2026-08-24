import io
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
from grading.models import RubricBand
import zipfile
from pathlib import Path

from django.core.files.base import ContentFile

MAX_EXTRACTED_PDF_SIZE = 50 * 1024 * 1024


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
    submission.pages.all().delete()

    try:
        images = convert_from_path(pdf_path, dpi=200, fmt="webp")

        with pdfplumber.open(pdf_path) as pdf:
            for index, page_image in enumerate(images):
                page_number = index + 1
                extracted_text = ""

                if index < len(pdf.pages):
                    extracted_text = pdf.pages[index].extract_text() or ""

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
        submission.save(update_fields=["status"])

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