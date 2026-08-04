import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class AssessmentMapping(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    name = models.CharField(
        max_length=255,
    )

    cohort = models.ForeignKey(
        "courses.Cohort",
        on_delete=models.PROTECT,
        related_name="assessment_mappings",
    )

    assignment_level = models.ForeignKey(
        "courses.AssignmentLevel",
        on_delete=models.PROTECT,
        related_name="assessment_mappings",
    )

    external_platform_id = models.CharField(
        max_length=255,
        blank=True,
    )

    external_context_id = models.CharField(
        max_length=255,
        blank=True,
    )

    external_resource_link_id = models.CharField(
        max_length=255,
        blank=True,
    )

    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_assessment_mappings",
        blank=True,
        null=True,
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="updated_assessment_mappings",
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def clean(self) -> None:
        super().clean()

        cohort_module_id = self.cohort.module_id
        assignment_module_id = (
            self.assignment_level.assignment.module_id
        )

        if cohort_module_id != assignment_module_id:
            raise ValidationError(
                {
                    "assignment_level": (
                        "The assignment level must belong to the "
                        "same module as the selected cohort."
                    )
                }
            )

    def __str__(self) -> str:
        return self.name