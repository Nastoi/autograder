from django.contrib import admin

from .models import (
    AIGradingProfile,
    GradingConfiguration,
    RagChunk,
    RagSource,
    RubricBand,
    RubricCriterion,
)


@admin.register(GradingConfiguration)
class GradingConfigurationAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "grading_type",
        "rag_enabled",
        "ai_grading_enabled",
        "is_active",
    )

    list_filter = (
        "grading_type",
        "rag_enabled",
        "ai_grading_enabled",
        "manual_review_required",
        "is_active",
    )

    search_fields = ("code", "name")


@admin.register(RubricCriterion)
class RubricCriterionAdmin(admin.ModelAdmin):
    list_display = (
        "assignment_level",
        "sequence",
        "title",
        "maximum_score",
        "ai_gradable",
    )

    list_filter = (
        "ai_gradable",
        "deterministic",
    )

    search_fields = (
        "criterion_code",
        "title",
        "assignment_level__assignment__code",
    )


@admin.register(RubricBand)
class RubricBandAdmin(admin.ModelAdmin):
    list_display = (
        "rubric_criterion",
        "display_name",
        "minimum_percentage",
        "maximum_percentage",
    )

    list_filter = ("band_code",)

    search_fields = (
        "rubric_criterion__title",
        "descriptor",
    )


@admin.register(RagSource)
class RagSourceAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "assignment_level",
        "source_type",
        "ingestion_status",
    )

    list_filter = (
        "source_type",
        "ingestion_status",
    )

    search_fields = (
        "title",
        "source_filename",
        "assignment_level__assignment__code",
    )


@admin.register(RagChunk)
class RagChunkAdmin(admin.ModelAdmin):
    list_display = (
        "rag_source",
        "chunk_index",
        "token_count",
        "created_at",
    )

    search_fields = (
        "rag_source__title",
        "content",
    )


@admin.register(AIGradingProfile)
class AIGradingProfileAdmin(admin.ModelAdmin):
    list_display = (
        "profile_name",
        "assignment_level",
        "model_provider",
        "model_name",
        "is_active",
    )

    list_filter = (
        "model_provider",
        "is_active",
    )

    search_fields = (
        "profile_name",
        "assignment_level__assignment__code",
    )