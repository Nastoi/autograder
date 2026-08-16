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

    must_change_password = models.BooleanField(
        default=False,
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.user.username} — {self.get_role_display()}"



class PortalActivity(models.Model):
        class Action(models.TextChoices):
            CREATED = "created", "Created"
            UPDATED = "updated", "Updated"
            DELETED = "deleted", "Deleted"

        user = models.ForeignKey(
            settings.AUTH_USER_MODEL,
            on_delete=models.SET_NULL,
            null=True,
            blank=True,
            related_name="portal_activities",
        )

        action = models.CharField(
            max_length=20,
            choices=Action.choices,
        )

        object_type = models.CharField(max_length=50)
        object_id = models.CharField(max_length=255)
        object_label = models.CharField(max_length=255)

        created_at = models.DateTimeField(auto_now_add=True)

        class Meta:
            ordering = ("-created_at",)

        def __str__(self):
            username = self.user.username if self.user else "Deleted user"
            return (
                f"{self.object_type} {self.object_label} "
                f"{self.action} by {username}"
            )