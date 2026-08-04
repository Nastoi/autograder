from django.contrib import admin

from .models import LearnerSubmission, SubmissionContext


@admin.register(SubmissionContext)
class SubmissionContextAdmin(admin.ModelAdmin):
    list_display = (
        "learner",
        "cohort",
        "assignment_level",
        "is_active",
        "created_at",
    )

    list_filter = (
        "is_active",
        "cohort",
        "assignment_level__level_code",
    )

    search_fields = (
        "learner__username",
        "learner__email",
        "cohort__code",
        "assignment_level__assignment__code",
    )


@admin.register(LearnerSubmission)
class LearnerSubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "learner",
        "original_filename",
        "assignment_level",
        "attempt_number",
        "status",
        "submitted_at",
    )

    list_filter = (
        "status",
        "assignment_level__level_code",
    )

    search_fields = (
        "learner__username",
        "learner__email",
        "original_filename",
        "assignment_level__assignment__code",
    )

    readonly_fields = (
        "learner",
        "assignment_level",
        "original_filename",
        "submitted_at",
    )