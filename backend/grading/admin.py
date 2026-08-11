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
        "grading_config_code",
        "grading_config_name",
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
    
from .models import (
    AIGradingProfile,
    CriterionResult,
    ExtractedEvidence,
    GradingConfiguration,
    Prompt,
    RagChunk,
    RagSource,
    Response,
    RubricBand,
    RubricCriterion,
    Task,
    TaskCriteriaMapping,
    TaskCriterionWeight,
    TaskEvidenceMap,
)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        "task_code",
        "title",
        "assignment_level",
        "sequence",
    )
    list_filter = ("assignment_level",)
    search_fields = ("task_code", "title")
    ordering = ("assignment_level", "sequence")


@admin.register(TaskCriterionWeight)
class TaskCriterionWeightAdmin(admin.ModelAdmin):
    list_display = (
        "task",
        "rubric_criterion",
        "weight_percentage",
        "band",
    )
    list_filter = ("band",)
    search_fields = (
        "task__task_code",
        "rubric_criterion__criterion_code",
    )


@admin.register(TaskCriteriaMapping)
class TaskCriteriaMappingAdmin(admin.ModelAdmin):
    list_display = (
        "task",
        "rubric_criterion",
        "inferred_weight",
        "created_at",
    )
    search_fields = (
        "task__task_code",
        "rubric_criterion__criterion_code",
    )
    readonly_fields = ("created_at",)


# grading/admin.py

@admin.register(ExtractedEvidence)
class ExtractedEvidenceAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "submission",
        "page_number",        # <--- Replaced evidence_type
        "extraction_confidence",
        "created_at",
    )
    list_filter = (
        "page_number",        # <--- Replaced evidence_type
        "created_at",
    )
    search_fields = (
        "id",
        "submission__id",
        "content_text",
    )


@admin.register(TaskEvidenceMap)
class TaskEvidenceMapAdmin(admin.ModelAdmin):
    list_display = (
        "task",
        "evidence",
        "mapping_role",
        "confidence_score",
    )
    list_filter = ("mapping_role",)
    search_fields = ("task__task_code",)


@admin.register(Prompt)
class PromptAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "submission",
        "stage",
        "created_at",
    )
    list_filter = ("stage",)
    search_fields = (
        "submission__original_filename",
        "prompt_text",
    )
    readonly_fields = ("created_at",)


@admin.register(Response)
class ResponseAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "prompt",
        "model_name",
        "confidence_score",
        "created_at",
    )
    search_fields = ("model_name",)
    readonly_fields = ("created_at",)


@admin.register(CriterionResult)
class CriterionResultAdmin(admin.ModelAdmin):
    list_display = (
        "submission",
        "rubric_criterion",
        "awarded_marks",
        "achievement_band",
        "created_at",
    )
    list_filter = ("achievement_band",)
    search_fields = (
        "submission__original_filename",
        "rubric_criterion__criterion_code",
    )
    readonly_fields = ("created_at",)
