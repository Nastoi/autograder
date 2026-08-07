import io
import pdfplumber
from django.utils import timezone
from grading.services.criterion_assessor import assess_criterion
from pdf2image import convert_from_path
from django.core.files.base import ContentFile
from .models import LearnerSubmission, SubmissionPage


def _get_assignment_type(assignment_level) -> str:
    level_code = getattr(assignment_level, "level_code", "").lower()
    return "ADVANCED" if level_code == "expert" else "BASIC"


def _build_assignment_payload(submission: LearnerSubmission) -> dict:
    assignment_level = submission.assignment_level
    assignment = assignment_level.assignment

    return {
        "assignment_id": str(assignment.id),
        "assignment_version": getattr(assignment, "version", "1.0"),
        "assignment_title": assignment.title,
        "assignment_type": _get_assignment_type(assignment_level),
        "confidence_threshold": 0.60,
        "assignment_score_boundaries": {
            "FAILED": [0, 49],
            "FOUNDATION": [50, 74],
            "PROFICIENT": [75, 100],
            "EXPERT": [90, 100],
        },
        "output_json_schema": {
            "type": "object",
            "properties": {},
        },
    }


def _build_task_payload(submission: LearnerSubmission) -> dict:
    assignment_level = submission.assignment_level

    return {
        "id": str(assignment_level.id),
        "title": assignment_level.display_name or assignment_level.level_code,
        "instructions": assignment_level.instructions
        or "Assess the submitted assignment evidence against the published rubric.",
    }


def _build_criterion_payload(submission: LearnerSubmission) -> dict:
    assignment_type = _get_assignment_type(submission.assignment_level)

    score_bands = {
        "BASIC": {
            "FAILED": {"minimum": 0, "maximum": 49},
            "FOUNDATION": {"minimum": 50, "maximum": 74},
            "PROFICIENT": {"minimum": 75, "maximum": 100},
        },
        "ADVANCED": {
            "FAILED": {"minimum": 0, "maximum": 49},
            "PROFICIENT": {"minimum": 50, "maximum": 89},
            "EXPERT": {"minimum": 90, "maximum": 100},
        },
    }

    return {
        "id": "AUTO-GRADE-OVERALL",
        "title": "Overall assignment assessment",
        "purpose": "Assess the submission against the published assignment requirements and rubric.",
        "maximum_marks": submission.maximum_score or 100,
        "mandatory_requirements": [
            {
                "requirement_id": "MR01",
                "description": "The submission demonstrates the required assignment deliverables and evidence.",
            }
        ],
        "optional_enhancements": [],
        "required_evidence": [
            {
                "evidence_id": "EV01",
                "description": "Submitted file metadata, page screenshots, and extracted text content.",
            }
        ],
        "performance_descriptors": [
            {
                "level": "FAILED",
                "description": "The submission does not demonstrate the required basic knowledge and skills.",
            },
            {
                "level": "FOUNDATION",
                "description": "The submission demonstrates the required basic knowledge and skills with minor limitations.",
            },
            {
                "level": "PROFICIENT",
                "description": "The submission applies the required skills accurately, independently, and consistently.",
            },
            {
                "level": "EXPERT",
                "description": "The submission demonstrates professional quality and advanced application.",
            },
        ],
        "score_bands": score_bands[assignment_type],
        "mandatory_outcome_rules": [],
        "assessor_guidance": [
            "Do not award a level that is not valid for the assignment type."
        ],
    }


def _build_evidence_payload(submission: LearnerSubmission) -> list[dict]:
    # 1. Base File Metadata Evidence
    evidence_list = [
        {
            "evidence_id": "EV-SUBMISSION-FILE",
            "evidence_type": "FILE_METADATA",
            "source_file": submission.original_filename,
            "description": "Submission file metadata and original filename.",
            "metadata": {
                "file_size": submission.submitted_file.size if submission.submitted_file else 0,
                "content_type": getattr(
                    submission.submitted_file.file, "content_type", None
                ),
            },
        }
    ]

    # 2. Append Extracted Page Text & Image Evidence
    pages = submission.pages.all().order_by("page_number")
    for page in pages:
        evidence_list.append(
            {
                "evidence_id": f"EV-PAGE-{page.page_number}",
                "evidence_type": "DOCUMENT_PAGE",
                "source_file": submission.original_filename,
                "page_number": page.page_number,
                "text_content": page.extracted_text,
                "image_url": page.page_image.url if page.page_image else None,
                "description": f"Extracted text and rendered page screenshot for Page {page.page_number}.",
            }
        )

    return evidence_list


def _build_deterministic_checks(submission: LearnerSubmission) -> list[dict]:
    checks = [
        {
            "check_id": "DC_FILE_EXISTS",
            "status": "PASSED" if submission.submitted_file else "FAILED",
            "description": "Submitted file is present on disk.",
        }
    ]

    has_pages = submission.pages.exists()
    checks.append(
        {
            "check_id": "DC_PAGES_EXTRACTED",
            "status": "PASSED" if has_pages else "FAILED",
            "description": "Submission pages and images were rendered successfully.",
        }
    )

    return checks


def extract_submission_pages(submission: LearnerSubmission) -> LearnerSubmission:
    """
    Renders PDF pages to WebP byte streams and extracts raw text.
    Saves both text and binary image data directly into the DB.
    """
    if not submission.submitted_file:
        raise ValueError("No file attached to this submission.")

    pdf_path = submission.submitted_file.path

    # Clean up old records if re-extracting
    submission.pages.all().delete()

    # 1. Render PDF pages to PIL images (in memory)
    images = convert_from_path(pdf_path, dpi=200, fmt="webp")

    # 2. Extract text per page using pdfplumber
    with pdfplumber.open(pdf_path) as pdf:
        for index, page_image in enumerate(images):
            page_number = index + 1
            extracted_text = ""

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

    submission.status = getattr(
        LearnerSubmission.Status, "EXTRACTED", "extracted"
    )
    submission.save(update_fields=["status"])

from .models import LearnerSubmission
from decimal import Decimal

def run_mock_grading(
    submission: LearnerSubmission,
) -> LearnerSubmission:
    submission.status = LearnerSubmission.Status.PROCESSING
    submission.save(update_fields=["status"])

    maximum_score = (
        submission.assignment_level.assignment.maximum_score
    )

    submission.maximum_score = maximum_score

    if (
        submission.submission_track
        == LearnerSubmission.SubmissionTrack.BASIC
    ):
        submission.final_score = maximum_score * Decimal("0.75")
        submission.achieved_band = "proficient"
        submission.feedback = (
            "Temporary Basic-track mock result. "
            "The submission achieved Proficient."
        )

    elif (
        submission.submission_track
        == LearnerSubmission.SubmissionTrack.ADVANCED
    ):
        submission.final_score = maximum_score * Decimal("0.90")
        submission.achieved_band = "expert"
        submission.feedback = (
            "Temporary Advanced-track mock result. "
            "The submission achieved Expert."
        )

    submission.status = LearnerSubmission.Status.COMPLETED
    submission.completed_at = timezone.now()

    submission.save(
        update_fields=[
            "final_score",
            "maximum_score",
            "achieved_band",
            "feedback",
            "status",
            "completed_at",
        ],
    )

    return submission


def run_ai_grading(submission: LearnerSubmission) -> LearnerSubmission:
    """
    Orchestrates the full grading pipeline: extract pages, then assess.
    """
    try:
        # Step 1: Extract pages from PDF
        submission = extract_submission_pages(submission)
        
        # Step 2: Assess using criterion assessor (if implemented)
        # For now, just mark as graded
        submission.status = getattr(
            LearnerSubmission.Status, "GRADED", "graded"
        )
        submission.save(update_fields=["status"])
        
        return submission
    except Exception as e:
        submission.status = getattr(
            LearnerSubmission.Status, "FAILED", "failed"
        )
        submission.save(update_fields=["status"])
        raise
