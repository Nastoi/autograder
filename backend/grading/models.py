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

    grading_config_code = models.CharField(
        max_length=100,
        unique=True,
    )

    grading_config_name = models.CharField(max_length=255)

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
        ordering = ("grading_config_code",)

    def __str__(self) -> str:
        return (
            f"{self.grading_config_code} — "
            f"{self.grading_config_name}"
        )


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

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rubric_criterion"
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
        null=True,
        blank=True,
    )

    band_code = models.CharField(
        max_length=30,
        choices=Band.choices,
    )

    display_name = models.CharField(max_length=300)

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

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rag_source"
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

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "rag_chunk"
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
        null=True,
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

    def __str__(self) -> str:
        return self.profile_name


class Task(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    assignment_level = models.ForeignKey(
        "courses.AssignmentLevel",
        on_delete=models.CASCADE,
        related_name="grading_tasks",
        db_column="assignment_level_id",
        null=True,  # Add null=True
        blank=True, # Add blank=True
    )

    task_code = models.CharField(max_length=80)
    title = models.CharField(max_length=255)
    evidence_required = models.TextField(blank=True)
    sequence = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "task"
        # managed = False
        ordering = ("assignment_level", "sequence")

    def __str__(self) -> str:
        return f"{self.assignment_level} — {self.title}"


class TaskCriterionWeight(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="criterion_weights",
        db_column="task_id",
        null=True,  # Add null=True
        blank=True, # Add blank=True        
    )

    rubric_criterion = models.ForeignKey(
        RubricCriterion,
        on_delete=models.CASCADE,
        related_name="task_weights",
        db_column="rubric_criterion_id",
        null=True,  # Add null=True
        blank=True, # Add blank=True        
    )

    weight_percentage = models.DecimalField(max_digits=5, decimal_places=2)

    class Band(models.TextChoices):
        FAILED = "failed", "Failed"
        FOUNDATION = "foundation", "Foundation"
        PROFICIENT = "proficient", "Proficient"
        EXPERT = "expert", "Expert"

    band = models.CharField(max_length=30, choices=Band.choices, blank=True)

    class Meta:
        db_table = "task_criterion_weight"
        # managed = False

    def __str__(self) -> str:
        return f"{self.task} — {self.rubric_criterion} ({self.weight_percentage}%)"


class TaskCriteriaMapping(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    assignment_level = models.ForeignKey(
        "courses.AssignmentLevel",
        on_delete=models.CASCADE,
        related_name="task_criteria_mappings",
        db_column="assignment_level_id",
        null=True,  # Add null=True
        blank=True, # Add blank=True
    )

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="criteria_mappings",
        db_column="task_id",
        null=True,  # Add null=True
        blank=True, # Add blank=True        
    )

    rubric_criterion = models.ForeignKey(
        RubricCriterion,
        on_delete=models.CASCADE,
        related_name="task_mappings",
        db_column="rubric_criterion_id",
        null=True,  # Add null=True
        blank=True, # Add blank=True
    )

    inferred_weight = models.DecimalField(max_digits=5, decimal_places=2)
    ai_explanation = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "task_criteria_mapping"
        # managed = False

    def __str__(self) -> str:
        return f"AI mapping {self.task} → {self.rubric_criterion} ({self.inferred_weight}%)"


class ExtractedEvidence(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    submission = models.ForeignKey(
        "submissions.LearnerSubmission",
        on_delete=models.CASCADE,
        related_name="extracted_evidences",
        db_column="submission_id",
        null=True,
        blank=True,
    )

    page_number = models.PositiveIntegerField(null=True, blank=True)
    content_text = models.TextField(blank=True, default="")
    image_url = models.CharField(max_length=1024, blank=True, default="")

    extraction_confidence = models.DecimalField(
        max_digits=5, decimal_places=2, blank=True, null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "extracted_evidence"
        ordering = ("submission", "page_number", "created_at")

    def __str__(self) -> str:
        return f"Evidence {self.id} — Page {self.page_number} (Submission {self.submission_id})"


class TaskEvidenceMap(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="evidence_maps",
        db_column="task_id",
        null=True,  # Add null=True
        blank=True, # Add blank=True        
    )

    evidence = models.ForeignKey(
        ExtractedEvidence,
        on_delete=models.CASCADE,
        related_name="task_maps",
        db_column="evidence_id",
        null=True,  # Add null=True
        blank=True, # Add blank=True        
    )

    class MappingRole(models.TextChoices):
        PRIMARY = "primary", "Primary"
        SUPPORTING = "supporting", "Supporting"

    mapping_role = models.CharField(
        max_length=20,
        choices=MappingRole.choices,
        default=MappingRole.SUPPORTING,
    )
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)

    class Meta:
        db_table = "task_evidence_map"
        # managed = False

    def __str__(self) -> str:
        return f"{self.task} ≤ {self.evidence} ({self.mapping_role})"


class Prompt(models.Model):
    class Stage(models.TextChoices):
        MAP_TASKS_CRITERIA = "map_tasks_criteria", "Map tasks to criteria"
        MAP_EVIDENCE_TASKS = "map_evidence_tasks", "Map evidence to tasks"
        FINAL_ASSESSMENT = "final_assessment", "Final assessment"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    submission = models.ForeignKey(
        "submissions.LearnerSubmission",
        on_delete=models.CASCADE,
        related_name="prompts",
        db_column="submission_id",
        null=True,  # Add null=True
        blank=True, # Add blank=True
    )

    stage = models.CharField(max_length=50, choices=Stage.choices)
    prompt_text = models.TextField()
    prompt_payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "prompt"
        # managed = False

    def __str__(self) -> str:
        return f"Prompt {self.stage} for {self.submission_id}"


class Response(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    prompt = models.ForeignKey(
        Prompt,
        on_delete=models.CASCADE,
        related_name="responses",
        db_column="prompt_id",
        null=True,  # Add null=True
        blank=True, # Add blank=True
    )

    model_name = models.CharField(max_length=100)
    response_payload = models.JSONField(default=dict)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=4, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "response"
        # managed = False

    def __str__(self) -> str:
        return f"Response {self.model_name} for prompt {self.prompt_id}"


class CriterionResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    submission = models.ForeignKey(
        "submissions.LearnerSubmission",
        on_delete=models.CASCADE,
        related_name="criterion_results",
        db_column="submission_id",
        null=True,  # Add null=True
        blank=True, # Add blank=True

    )

    rubric_criterion = models.ForeignKey(
        RubricCriterion,
        on_delete=models.CASCADE,
        related_name="criterion_results",
        db_column="rubric_criterion_id",
        null=True,  # Add null=True
        blank=True, # Add blank=True
    )

    awarded_marks = models.DecimalField(max_digits=8, decimal_places=2)
    class AchievementBand(models.TextChoices):
        FAILED = "failed", "Failed"
        FOUNDATION = "foundation", "Foundation"
        PROFICIENT = "proficient", "Proficient"
        EXPERT = "expert", "Expert"

    achievement_band = models.CharField(
        max_length=30,
        choices=AchievementBand.choices,
        blank=True,
    )
    feedback = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "criterion_result"
        # managed = False

    def __str__(self) -> str:
        return f"{self.rubric_criterion} — {self.awarded_marks}"


class SubmissionTaskMapping(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        "submissions.LearnerSubmission",
        on_delete=models.CASCADE,
        related_name="task_mappings",
    )
    task_id = models.CharField(max_length=100)
    task_description = models.TextField(blank=True)
    mapped_page_numbers = models.JSONField(default=list)  # e.g. [1, 2]
    confidence_score = models.DecimalField(max_digits=4, decimal_places=3, default=1.0)
    justification = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "submission_task_mapping"
        unique_together = ("submission", "task_id")