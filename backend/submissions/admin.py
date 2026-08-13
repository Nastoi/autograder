from django.contrib import admin

from .models import LearnerSubmission, SubmissionContext


@admin.register(SubmissionContext)
class SubmissionContextAdmin(admin.ModelAdmin):
    list_display = (
        "learner",
        "cohort",
        "assignment_display",
        "is_active",
        "created_at",
    )

    list_filter = (
        "is_active",
        "cohort",
        "assignment_level",
    )

    search_fields = (
        "learner__username",
        "learner__email",
        "cohort__cohort_code",
        "assignment_level__assignment__assignment_code",
    )

    @admin.display(description="Assignment")
    def assignment_display(self, obj):
        return obj.assignment_level


@admin.register(LearnerSubmission)
class LearnerSubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "learner",
        "original_filename",
        "assignment_display",
        "attempt_number",
        "status",
        "submitted_at",
    )

    list_filter = (
        "status",
        "assignment_level",
    )

    search_fields = (
        "learner__username",
        "learner__email",
        "original_filename",
        "assignment_level__assignment__assignment_code",
    )

    readonly_fields = (
        "learner",
        "assignment_display",
        "original_filename",
        "submitted_at",
    )

    @admin.display(description="Assignment")
    def assignment_display(self, obj):
        return obj.assignment_level