from django.contrib import admin

from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "role",
        "lms_user_id",
        "created_at",
    )

    list_filter = ("role",)
    search_fields = (
        "user__username",
        "user__email",
        "lms_user_id",
    )