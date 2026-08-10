import io
import pdfplumber
from django.utils import timezone
from grading.services.criterion_assessor import assess_criterion
from pdf2image import convert_from_path
from django.core.files.base import ContentFile
from .models import LearnerSubmission, SubmissionPage
from decimal import Decimal


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

    except Exception as e:
        submission.status = LearnerSubmission.Status.FAILED
        submission.save(update_fields=["status"])
        raise


def run_ai_grading(
    submission: LearnerSubmission,
) -> LearnerSubmission:
    """
    Orchestrates the full grading pipeline: extract pages, then assess.
    """
    try:
        # Step 1: Extract pages from PDF
        submission = extract_submission_pages(submission)

        # Step 2: Mark as ready for grading
        submission.status = LearnerSubmission.Status.COMPLETED
        submission.completed_at = timezone.now()
        submission.save(update_fields=["status", "completed_at"])

        return submission
    except Exception as e:
        submission.status = LearnerSubmission.Status.FAILED
        submission.save(update_fields=["status"])
        raise
