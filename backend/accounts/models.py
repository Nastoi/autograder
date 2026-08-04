from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    class Role(models.TextChoices):
        SYSTEM_ADMIN = "system_admin", "System administrator"
        MAPPING_ADMIN = "mapping_admin", "Mapping administrator"
        FACULTY = "faculty", "Faculty"
        LEARNER = "learner", "Learner"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.LEARNER,
    )

    lms_user_id = models.CharField(
        max_length=255,
        blank=True,
        db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.user.username} — {self.get_role_display()}"