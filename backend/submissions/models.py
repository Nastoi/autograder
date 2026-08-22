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
        "courses.AssignmentLevel",
        on_delete=models.PROTECT,
        related_name="submission_contexts_by_assignment",
        null=True,
        blank=True,
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
            f"{self.assignment_level.assignment.assignment_code} — "
            f"{self.assignment_level.level}"
        )


class LearnerSubmission(models.Model):
    class Status(models.TextChoices):
        UPLOADED = "uploaded", "Uploaded"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        ERROR = "error", "Error"
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
        "courses.AssignmentLevel",
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


class SubmissionGradingAudit(models.Model):
    """Structured AI grading evidence retained for one submission attempt."""

    class Status(models.TextChoices):
        STARTED = "started", "Started"
        COMPLETED = "completed", "Completed"
        ERROR = "error", "Error"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    submission = models.OneToOneField(
        LearnerSubmission,
        on_delete=models.CASCADE,
        related_name="grading_audit",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.STARTED,
    )
    model_name = models.CharField(max_length=100, blank=True)
    grader_version = models.CharField(
        max_length=100,
        default="submission_grader_v1",
    )

    task_mapping_snapshot = models.JSONField(default=dict, blank=True)
    raw_ai_response = models.JSONField(default=dict, blank=True)
    criterion_evaluations = models.JSONField(default=list, blank=True)
    scoring_snapshot = models.JSONField(default=dict, blank=True)

    overall_summary = models.TextField(blank=True)
    error_code = models.CharField(max_length=100, blank=True)
    error_message = models.TextField(blank=True)

    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "submission_grading_audit"
        ordering = ("-created_at",)

    def __str__(self):
        return f"Grading audit for {self.submission_id}"


class SubmissionProcessLog(models.Model):
    """Queryable technical lifecycle entry for one accepted attempt."""

    class EventStatus(models.TextChoices):
        STARTED = "started", "Started"
        SUCCESS = "success", "Success"
        WARNING = "warning", "Warning"
        ERROR = "error", "Error"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    submission = models.ForeignKey(
        LearnerSubmission,
        on_delete=models.CASCADE,
        related_name="process_logs",
    )

    # Searchable snapshots for exact cohort + assignment + learner + attempt.
    cohort_code = models.CharField(max_length=100, db_index=True)
    cohort_name = models.CharField(max_length=255, blank=True)
    assignment_code = models.CharField(max_length=100, db_index=True)
    assignment_title = models.CharField(max_length=255, blank=True)
    learner_email = models.EmailField(blank=True, db_index=True)
    learner_username = models.CharField(max_length=255, blank=True)
    attempt_number = models.PositiveIntegerField(db_index=True)

    stage = models.CharField(max_length=50, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=EventStatus.choices,
        db_index=True,
    )
    event_code = models.CharField(max_length=100, blank=True, db_index=True)
    message = models.TextField(blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "submission_process_log"
        ordering = ("created_at",)
        indexes = [
            models.Index(
                fields=[
                    "cohort_code",
                    "assignment_code",
                    "learner_email",
                    "attempt_number",
                ],
                name="sublog_attempt_lookup",
            ),
            models.Index(
                fields=["stage", "status", "created_at"],
                name="sublog_stage_status",
            ),
        ]

    def __str__(self):
        return (
            f"{self.cohort_code} / {self.assignment_code} / "
            f"{self.learner_email or self.learner_username} / "
            f"attempt {self.attempt_number} / {self.stage} / {self.status}"
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
