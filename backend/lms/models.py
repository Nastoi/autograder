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

    assignment = models.ForeignKey(
        "courses.ModuleAssignment",
        on_delete=models.PROTECT,
        related_name="assessment_mappings",
    )

    final_mark_weight = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
    )

    due_date = models.DateTimeField(
        null=True,
        blank=True,
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

    lti_client_id = models.CharField(
        max_length=255,
        blank=True,
    )

    lti_jwks_url = models.URLField(
        blank=True,
    )

    lti_deployment_id = models.CharField(
        max_length=255,
        blank=True,
    )

    lti_access_token_url = models.URLField(
        blank=True,
    )
    
    class Meta:
        ordering = ("name",)

        constraints = [
            models.UniqueConstraint(
                fields=("cohort", "assignment"),
                name="unique_cohort_assignment_mapping",
            ),
        ]

    def clean(self) -> None:
        super().clean()

        if self.cohort.module_id != self.assignment.module_id:
            raise ValidationError(
                {
                    "assignment": (
                        "The assignment must belong to the same "
                        "module as the selected cohort."
                    )
                }
            )

    def __str__(self) -> str:
        return self.name


class LtiUserIdentity(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lti_identities",
    )

    issuer = models.CharField(max_length=500)
    deployment_id = models.CharField(max_length=255)
    lti_user_id = models.CharField(max_length=255)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "issuer",
                    "deployment_id",
                    "lti_user_id",
                ],
                name="unique_lti_user_identity",
            ),
        ]