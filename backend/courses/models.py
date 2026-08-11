import uuid

from django.conf import settings
from django.db import models


class Qualification(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    qualification_code = models.CharField(
        max_length=50,
        unique=True,
    )

    qualification_name = models.CharField(
        max_length=255,
    )

    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("qualification_code",)

    def __str__(self) -> str:
        return (
            f"{self.qualification_code} — "
            f"{self.qualification_name}"
        )


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
    )

    module_code = models.CharField(max_length=50)
    module_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("module_code",)

    def __str__(self) -> str:
        return f"{self.module_code} — {self.module_name}"


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
        db_table = "enrolment"
        managed = False
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
            f"{self.module.module_code} — "
            f"{self.get_role_display()}"
        )


class ModuleAssignment(models.Model):
    class Level(models.TextChoices):
        BASIC = "basic", "Basic"
        ADVANCED = "advanced", "Advanced"

    level = models.CharField(
        max_length=20,
        choices=Level.choices,
        default=Level.BASIC,
    )

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    module = models.ForeignKey(
        Module,
        on_delete=models.PROTECT,
        related_name="assignments",
    )

    grading_configuration = models.ForeignKey(
        "grading.GradingConfiguration",
        on_delete=models.PROTECT,
        related_name="assignment_levels",
        blank=True,
        null=True,
    )

    assignment_code = models.CharField(max_length=50)
    assignment_title = models.CharField(max_length=255)

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
        ordering = ("module", "level", "assignment_code")

    def __str__(self) -> str:
        return (
            f"{self.assignment_code} — "
            f"{self.assignment_title}"
        )


# class AssignmentLevel(models.Model):
#     class Level(models.TextChoices):
#         # FOUNDATION = "foundation", "Foundation"
#         # PROFICIENT = "proficient", "Proficient"
#         # EXPERT = "expert", "Expert"
#         BASIC = "basic", "BASIC"
#         ADVANCED = "advanced", "ADVANCED"

#     class ConfigurationStatus(models.TextChoices):
#         DRAFT = "draft", "Draft"
#         READY = "ready", "Ready"
#         RETIRED = "retired", "Retired"

#     id = models.UUIDField(
#         primary_key=True,
#         default=uuid.uuid4,
#         editable=False,
#     )

#     assignment = models.ForeignKey(
#         ModuleAssignment,
#         on_delete=models.CASCADE,
#         related_name="levels",
#     )

#     grading_configuration = models.ForeignKey(
#         "grading.GradingConfiguration",
#         on_delete=models.PROTECT,
#         related_name="assignment_levels",
#     )

#     level_code = models.CharField(
#         max_length=20,
#         choices=Level.choices,
#     )

#     display_name = models.CharField(max_length=100)
#     title = models.CharField(max_length=255)
#     instructions = models.TextField(blank=True)

#     tasks = models.JSONField(default=list)
#     deliverables = models.JSONField(default=list)
#     expected_outcome = models.TextField(blank=True)

#     source_filename = models.CharField(
#         max_length=255,
#         blank=True,
#         null=True,
#     )

#     version = models.PositiveIntegerField(default=1)

#     configuration_status = models.CharField(
#         max_length=20,
#         choices=ConfigurationStatus.choices,
#         default=ConfigurationStatus.DRAFT,
#     )

#     is_active = models.BooleanField(default=True)

#     created_at = models.DateTimeField(auto_now_add=True)
#     updated_at = models.DateTimeField(auto_now=True)

#     class Meta:
#         ordering = (
#             "assignment__assignment_number",
#             "level_code",
#         )

#     def __str__(self) -> str:
#         return (
#             f"{self.assignment.assignment_code} — "
#             f"{self.get_level_code_display()}"
#         )


class Cohort(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    cohort_name = models.CharField(max_length=255)

    cohort_code = models.CharField(
        max_length=100,
        unique=True,
    )

    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name="cohorts",
        db_column="module_id",
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
        db_table = "cohort"
        # managed = False
        ordering = ("cohort_code",)

    def __str__(self) -> str:
        return (
            f"{self.cohort_code} — "
            f"{self.cohort_name}"
        )
