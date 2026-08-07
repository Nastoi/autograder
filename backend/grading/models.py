import uuid

from django.db import models
from pgvector.django import VectorField


class GradingConfiguration(models.Model):
    class GradingType(models.TextChoices):
        RULES_ONLY = "rules_only", "Rules only"
        AUTOMATED_TESTS = "automated_tests", "Automated tests"
        AI_RUBRIC = "ai_rubric", "AI rubric"
        HYBRID = "hybrid", "Hybrid"
        MANUAL = "manual", "Manual"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    code = models.CharField(
        max_length=100,
        unique=True,
    )

    name = models.CharField(max_length=255)

    grading_type = models.CharField(
        max_length=30,
        choices=GradingType.choices,
        default=GradingType.HYBRID,
    )

    structural_check_enabled = models.BooleanField(default=True)
    automated_testing_enabled = models.BooleanField(default=False)
    rag_enabled = models.BooleanField(default=True)
    ai_grading_enabled = models.BooleanField(default=True)
    manual_review_required = models.BooleanField(default=True)

    confidence_review_threshold = models.DecimalField(
        max_digits=4,
        decimal_places=3,
        default=0.700,
    )

    version = models.PositiveIntegerField(default=1)
    configuration = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "grading_configuration"
        ordering = ("code",)

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class RubricCriterion(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    assignment_level = models.ForeignKey(
        "courses.AssignmentLevel",
        on_delete=models.CASCADE,
        related_name="rubric_criteria",
        db_column="assignment_level_id",
        null=True,
        blank=True,
    )

    criterion_code = models.CharField(max_length=80)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    maximum_score = models.DecimalField(
        max_digits=7,
        decimal_places=2,
    )

    sequence = models.PositiveIntegerField()
    ai_gradable = models.BooleanField(default=True)
    deterministic = models.BooleanField(default=False)

    created_at = models.DateTimeField()

    class Meta:
        db_table = "rubric_criterion"
        # managed = False
        ordering = (
            "assignment_level",
            "sequence",
        )

    def __str__(self) -> str:
        return (
            f"{self.assignment_level} — "
            f"{self.title}"
        )


class RubricBand(models.Model):
    class Band(models.TextChoices):
        FAILED = "failed", "Failed"
        FOUNDATION = "foundation", "Foundation"
        PROFICIENT = "proficient", "Proficient"
        EXPERT = "expert", "Expert"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    rubric_criterion = models.ForeignKey(
        RubricCriterion,
        on_delete=models.CASCADE,
        related_name="bands",
        db_column="rubric_criterion_id",
        null=True,
        blank=True,
    )

    band_code = models.CharField(
        max_length=30,
        choices=Band.choices,
    )

    display_name = models.CharField(max_length=100)

    minimum_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
    )

    maximum_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
    )

    descriptor = models.TextField()
    sequence = models.PositiveIntegerField()

    class Meta:
        db_table = "rubric_band"
        # managed = False
        ordering = (
            "rubric_criterion",
            "sequence",
        )

    def __str__(self) -> str:
        return (
            f"{self.rubric_criterion.title} — "
            f"{self.display_name}"
        )


class RagSource(models.Model):
    class SourceType(models.TextChoices):
        ASSIGNMENT_DOCUMENT = (
            "assignment_document",
            "Assignment document",
        )
        RUBRIC = "rubric", "Rubric"
        MODEL_ANSWER = "model_answer", "Model answer"
        LECTURE_NOTE = "lecture_note", "Lecture note"
        POLICY = "policy", "Policy"
        EXAMPLE = "example", "Example"

    class IngestionStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    assignment_level = models.ForeignKey(
        "courses.AssignmentLevel",
        on_delete=models.CASCADE,
        related_name="rag_sources",
        db_column="assignment_level_id",
        null=True,
        blank=True,
    )

    source_type = models.CharField(
        max_length=30,
        choices=SourceType.choices,
    )

    title = models.CharField(max_length=255)

    source_filename = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )

    storage_uri = models.TextField(
        blank=True,
        null=True,
    )

    source_text = models.TextField(
        blank=True,
        null=True,
    )

    metadata = models.JSONField(default=dict)

    ingestion_status = models.CharField(
        max_length=20,
        choices=IngestionStatus.choices,
        default=IngestionStatus.PENDING,
    )

    created_at = models.DateTimeField()

    class Meta:
        db_table = "rag_source"
        # managed = False
        ordering = ("assignment_level", "title")

    def __str__(self) -> str:
        return self.title


class RagChunk(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    rag_source = models.ForeignKey(
        RagSource,
        on_delete=models.CASCADE,
        related_name="chunks",
        db_column="rag_source_id",
        null=True,
        blank=True,
    )

    chunk_index = models.PositiveIntegerField()
    content = models.TextField()

    token_count = models.IntegerField(
        blank=True,
        null=True,
    )

    metadata = models.JSONField(default=dict)

    embedding = VectorField(
        dimensions=1536,
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField()

    class Meta:
        db_table = "rag_chunk"
        # managed = False
        ordering = (
            "rag_source",
            "chunk_index",
        )

    def __str__(self) -> str:
        return (
            f"{self.rag_source.title} — "
            f"Chunk {self.chunk_index}"
        )


class AIGradingProfile(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    assignment_level = models.OneToOneField(
        "courses.AssignmentLevel",
        on_delete=models.CASCADE,
        related_name="ai_grading_profile",
        db_column="assignment_level_id",
        null=True,  # Allow nulls for existing/new rows during migration
        blank=True,
    )

    profile_name = models.CharField(max_length=255)
    system_prompt = models.TextField()
    output_schema = models.JSONField()

    temperature = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0.10,
    )

    model_provider = models.CharField(
        max_length=50,
        default="openai",
    )

    model_name = models.CharField(
        max_length=100,
        default="configure-in-environment",
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ai_grading_profile"
        # managed = False

    def __str__(self) -> str:
        return self.profile_name
