import uuid

from django.conf import settings
from django.db import models


class SubmissionContext(models.Model):
    """
    Temporary local-development mapping.

    Later, an LMS/LTI launch will create or resolve this context
    automatically instead of an administrator creating it manually.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    learner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="submission_contexts",
    )

    cohort = models.ForeignKey(
        "courses.Cohort",
        on_delete=models.PROTECT,
        related_name="submission_contexts",
    )

    assignment_level = models.ForeignKey(
        "courses.ModuleAssignment",
        on_delete=models.PROTECT,
        related_name="submission_contexts",
    )

    assessment_mapping = models.ForeignKey(
        "lms.AssessmentMapping",
        on_delete=models.PROTECT,
        related_name="submission_contexts",
        blank=True,
        null=True,
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return (
            f"{self.learner.username} — "
            f"{self.assignment_level.assignment_code} — "
            f"{self.assignment_level.level}"
        )


class LearnerSubmission(models.Model):
    class Status(models.TextChoices):
        UPLOADED = "uploaded", "Uploaded"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        MANUAL_REVIEW = "manual_review", "Manual review"

    class SubmissionTrack(models.TextChoices):
        BASIC = "basic", "Basic"
        ADVANCED = "advanced", "Advanced"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    context = models.ForeignKey(
        SubmissionContext,
        on_delete=models.PROTECT,
        related_name="submissions",
    )

    learner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learner_submissions",
    )

    assignment_level = models.ForeignKey(
        "courses.ModuleAssignment",
        on_delete=models.PROTECT,
        related_name="learner_submissions",
    )

    submission_track = models.CharField(
        max_length=20,
        choices=SubmissionTrack.choices,
        default=SubmissionTrack.BASIC,
    )

    submitted_file = models.FileField(
        upload_to="submissions/%Y/%m/%d/",
    )

    original_filename = models.CharField(max_length=255)

    attempt_number = models.PositiveIntegerField(default=1)

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.UPLOADED,
    )

    # Temporary mock-result fields.
    final_score = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        blank=True,
        null=True,
    )

    maximum_score = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        blank=True,
        null=True,
    )

    achieved_band = models.CharField(
        max_length=30,
        blank=True,
    )

    feedback = models.TextField(blank=True)

    submitted_at = models.DateTimeField(auto_now_add=True)

    completed_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    class Meta:
        db_table = "learner_submission"
        ordering = ("-submitted_at",)

    def __str__(self) -> str:
        return (
            f"{self.learner.username} — "
            f"{self.original_filename}"
        )


class SubmissionPage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        LearnerSubmission, on_delete=models.CASCADE, related_name="pages"
    )
    page_number = models.PositiveIntegerField()

    # Store page text extracted via pdfplumber
    extracted_text = models.TextField(blank=True, default="")

    # Store binary WebP image directly in Postgres bytea column
    image_data = models.BinaryField(null=True, blank=True)
    image_mime_type = models.CharField(max_length=50, default="image/webp")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["page_number"]
        unique_together = ["submission", "page_number"]

    def __str__(self):
        return f"Submission {self.submission_id} - Page {self.page_number}"
