import uuid

from django.conf import settings
from django.db import models


class Qualification(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    code = models.CharField(
        max_length=50,
        unique=True,
    )

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "qualification"
        managed = False
        ordering = ("code",)

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class Module(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    qualification = models.ForeignKey(
        Qualification,
        on_delete=models.PROTECT,
        related_name="modules",
        db_column="qualification_id",
    )

    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "module"
        managed = False
        ordering = ("code",)

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class Enrolment(models.Model):
    class Role(models.TextChoices):
        LEARNER = "learner", "Learner"
        INSTRUCTOR = "instructor", "Instructor"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrolments",
    )

    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name="enrolments",
    )

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
    )

    is_active = models.BooleanField(default=True)
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("module", "user")
        constraints = [
            models.UniqueConstraint(
                fields=("user", "module"),
                name="unique_user_module_enrolment",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.user.username} — "
            f"{self.module.code} — "
            f"{self.get_role_display()}"
        )


class ModuleAssignment(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    module = models.ForeignKey(
        Module,
        on_delete=models.PROTECT,
        related_name="assignments",
        db_column="module_id",
    )

    assignment_number = models.PositiveIntegerField()
    code = models.CharField(max_length=50)
    title = models.CharField(max_length=255)

    skill_statement_code = models.CharField(max_length=50)
    skill_statement = models.TextField()
    objective = models.TextField(blank=True)

    maximum_score = models.DecimalField(
        max_digits=7,
        decimal_places=2,
    )

    minimum_pass_score = models.DecimalField(
        max_digits=7,
        decimal_places=2,
    )

    is_summative = models.BooleanField(default=True)
    contributes_to_final_mark = models.BooleanField(default=True)

    final_mark_weight = models.DecimalField(
        max_digits=5,
        decimal_places=2,
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "module_assignment"
        managed = False
        ordering = ("module", "assignment_number")

    def __str__(self) -> str:
        return f"{self.code} — {self.title}"


class AssignmentLevel(models.Model):
    class Level(models.TextChoices):
        FOUNDATION = "foundation", "Foundation"
        PROFICIENT = "proficient", "Proficient"
        EXPERT = "expert", "Expert"

    class ConfigurationStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        READY = "ready", "Ready"
        RETIRED = "retired", "Retired"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    assignment = models.ForeignKey(
        ModuleAssignment,
        on_delete=models.CASCADE,
        related_name="levels",
        db_column="assignment_id",
    )

    grading_configuration = models.ForeignKey(
        "grading.GradingConfiguration",
        on_delete=models.PROTECT,
        related_name="assignment_levels",
        db_column="grading_configuration_id",
    )

    level_code = models.CharField(
        max_length=20,
        choices=Level.choices,
    )

    display_name = models.CharField(max_length=100)
    title = models.CharField(max_length=255)
    instructions = models.TextField(blank=True)

    tasks = models.JSONField(default=list)
    deliverables = models.JSONField(default=list)
    expected_outcome = models.TextField(blank=True)

    source_filename = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )

    version = models.PositiveIntegerField(default=1)

    configuration_status = models.CharField(
        max_length=20,
        choices=ConfigurationStatus.choices,
        default=ConfigurationStatus.DRAFT,
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "assignment_level"
        managed = False
        ordering = (
            "assignment__assignment_number",
            "level_code",
        )

    def __str__(self) -> str:
        return (
            f"{self.assignment.code} — "
            f"{self.get_level_code_display()}"
        )


class Cohort(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=100, unique=True)

    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name="cohorts",
    )

    start_date = models.DateField(
        blank=True,
        null=True,
    )

    end_date = models.DateField(
        blank=True,
        null=True,
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("code",)

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"   