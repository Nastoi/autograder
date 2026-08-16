import io
import pdfplumber

from pdf2image import convert_from_path
from django.core.files.base import ContentFile
from .models import LearnerSubmission, SubmissionPage
from grading.services.submission_grader import (
    grade_submission,
    map_submission_tasks,
)
from grading.models import RubricBand

# def _get_assignment_type(submission) -> str:
#     return submission.submission_track


# def _build_assignment_payload(submission: LearnerSubmission) -> dict:
#     assignment = submission.assignment

#     return {
#         "assignment_id": str(assignment.id),
#         "assignment_version": getattr(assignment, "version", "1.0"),
#         "assignment_title": assignment.title,
#         "assignment_type": _get_assignment_type(submission),
#         "confidence_threshold": 0.60,
#         "assignment_score_boundaries": {
#             "FAILED": [0, 49],
#             "FOUNDATION": [50, 74],
#             "PROFICIENT": [75, 100],
#             "EXPERT": [90, 100],
#         },
#         "output_json_schema": {
#             "type": "object",
#             "properties": {},
#         },
#     }


# def _build_task_payload(submission: LearnerSubmission) -> dict:
#     assignment = submission.assignment

#     return {
#         "id": str(assignment.id),
#         "title": assignment.title,
#         "instructions": (
#             assignment.objective
#             or "Assess the submitted assignment evidence against the published rubric."
#         ),
#         "submission_track": submission.submission_track,
#     }


# def _build_criterion_payload(submission: LearnerSubmission) -> dict:
#     assignment_type = _get_assignment_type(submission)

#     score_bands = {
#         "BASIC": {
#             "FAILED": {"minimum": 0, "maximum": 49},
#             "FOUNDATION": {"minimum": 50, "maximum": 74},
#             "PROFICIENT": {"minimum": 75, "maximum": 100},
#         },
#         "ADVANCED": {
#             "FAILED": {"minimum": 0, "maximum": 49},
#             "PROFICIENT": {"minimum": 50, "maximum": 89},
#             "EXPERT": {"minimum": 90, "maximum": 100},
#         },
#     }

#     return {
#         "id": "AUTO-GRADE-OVERALL",
#         "title": "Overall assignment assessment",
#         "purpose": "Assess the submission against the published assignment requirements and rubric.",
#         "maximum_marks": submission.maximum_score or 100,
#         "mandatory_requirements": [
#             {
#                 "requirement_id": "MR01",
#                 "description": "The submission demonstrates the required assignment deliverables and evidence.",
#             }
#         ],
#         "optional_enhancements": [],
#         "required_evidence": [
#             {
#                 "evidence_id": "EV01",
#                 "description": "Submitted file metadata, page screenshots, and extracted text content.",
#             }
#         ],
#         "performance_descriptors": [
#             {
#                 "level": "FAILED",
#                 "description": "The submission does not demonstrate the required basic knowledge and skills.",
#             },
#             {
#                 "level": "FOUNDATION",
#                 "description": "The submission demonstrates the required basic knowledge and skills with minor limitations.",
#             },
#             {
#                 "level": "PROFICIENT",
#                 "description": "The submission applies the required skills accurately, independently, and consistently.",
#             },
#             {
#                 "level": "EXPERT",
#                 "description": "The submission demonstrates professional quality and advanced application.",
#             },
#         ],
#         "score_bands": score_bands[assignment_type],
#         "mandatory_outcome_rules": [],
#         "assessor_guidance": [
#             "Do not award a level that is not valid for the assignment type."
#         ],
#     }


# def _build_evidence_payload(submission: LearnerSubmission) -> list[dict]:
#     # 1. Base File Metadata Evidence
#     evidence_list = [
#         {
#             "evidence_id": "EV-SUBMISSION-FILE",
#             "evidence_type": "FILE_METADATA",
#             "source_file": submission.original_filename,
#             "description": "Submission file metadata and original filename.",
#             "metadata": {
#                 "file_size": submission.submitted_file.size if submission.submitted_file else 0,
#                 "content_type": getattr(
#                     submission.submitted_file.file, "content_type", None
#                 ),
#             },
#         }
#     ]

#     # 2. Append Extracted Page Text & Image Evidence
#     pages = submission.pages.all().order_by("page_number")
#     for page in pages:
#         evidence_list.append(
#             {
#                 "evidence_id": f"EV-PAGE-{page.page_number}",
#                 "evidence_type": "DOCUMENT_PAGE",
#                 "source_file": submission.original_filename,
#                 "page_number": page.page_number,
#                 "text_content": page.extracted_text,
#                 "has_image": bool(page.image_data),
#                 "image_mime_type": page.image_mime_type,
#                 "description": f"Extracted text and rendered page screenshot for Page {page.page_number}.",
#             }
#         )

#     return evidence_list


# def _build_deterministic_checks(submission: LearnerSubmission) -> list[dict]:
#     checks = [
#         {
#             "check_id": "DC_FILE_EXISTS",
#             "status": "PASSED" if submission.submitted_file else "FAILED",
#             "description": "Submitted file is present on disk.",
#         }
#     ]

#     has_pages = submission.pages.exists()
#     checks.append(
#         {
#             "check_id": "DC_PAGES_EXTRACTED",
#             "status": "PASSED" if has_pages else "FAILED",
#             "description": "Submission pages and images were rendered successfully.",
#         }
#     )

#     return checks
# =======
# from decimal import Decimal


def extract_submission_pages(submission: LearnerSubmission) -> LearnerSubmission:
    """
    Renders PDF pages to WebP byte streams and extracts raw text.
    Saves both text and binary image data directly into the DB.
    Includes bounds checking to prevent IndexError if page counts differ.
    """
    if not submission.submitted_file:
        raise ValueError("No file attached to this submission.")

    pdf_path = submission.submitted_file.path

    # Clean up old records if re-extracting
    submission.pages.all().delete()

    try:
        # 1. Render PDF pages to PIL images (in memory)
        images = convert_from_path(pdf_path, dpi=200, fmt="webp")

        # 2. Extract text per page using pdfplumber with bounds checking
        with pdfplumber.open(pdf_path) as pdf:
            for index, page_image in enumerate(images):
                page_number = index + 1
                extracted_text = ""

                # ✓ FIXED: Bounds check to prevent IndexError
                if index < len(pdf.pages):
                    extracted_text = pdf.pages[index].extract_text() or ""

                # Convert PIL Image to raw binary bytes
                image_buffer = io.BytesIO()
                page_image.save(image_buffer, format="WEBP")
                raw_image_bytes = image_buffer.getvalue()

                # Save directly into Database table
                SubmissionPage.objects.create(
                    submission=submission,
                    page_number=page_number,
                    extracted_text=extracted_text.strip(),
                    image_data=raw_image_bytes,  # Saved into BinaryField
                    image_mime_type="image/webp",
                )

        submission.status = LearnerSubmission.Status.PROCESSING
        submission.save(update_fields=["status"])
        return submission
    except Exception as e:
        submission.status = LearnerSubmission.Status.ERROR
        submission.save(update_fields=["status"])
        raise


def run_ai_grading(submission):
    try:
        submission = extract_submission_pages(submission)

        mapping_result = map_submission_tasks(submission)

        if mapping_result.get("is_unrelated_document"):
            submission.status = LearnerSubmission.Status.ERROR
            submission.feedback = (
                "We detected that the submitted file does not "
                "appear to be related to this assignment. "
                "Please check that you uploaded the correct "
                "document and submit again."
            )
            submission.save(
                update_fields=[
                    "status",
                    "feedback",
                ]
            )

            return submission

        grade_submission(submission)

        submission.refresh_from_db()
        return submission

    except Exception:
        submission.status = LearnerSubmission.Status.ERROR
        submission.save(update_fields=["status"])
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