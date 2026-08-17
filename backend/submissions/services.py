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