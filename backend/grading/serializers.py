from rest_framework import serializers

from .models import (
    AIGradingProfile,
    CriterionResult,
    ExtractedEvidence,
    GradingConfiguration,
    Prompt,
    Response,
    RubricBand,
    RubricCriterion,
    Task,
    TaskCriterionWeight,
    TaskCriteriaMapping,
    TaskEvidenceMap,
)


class GradingConfigurationSerializer(
    serializers.ModelSerializer
):
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = GradingConfiguration
        fields = (
            "id",
            "grading_config_code",
            "grading_config_name",
            "grading_type",
            "structural_check_enabled",
            "automated_testing_enabled",
            "rag_enabled",
            "ai_grading_enabled",
            "manual_review_required",
            "confidence_review_threshold",
            "version",
            "configuration",
            "is_active",
            "can_delete",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "can_delete",
            "created_at",
            "updated_at",
        )

    def get_can_delete(
        self,
        obj: GradingConfiguration,
    ) -> bool:
        return not obj.assignment_levels.exists()

    def validate_code(self, value):
        code = value.strip().upper()

        queryset = GradingConfiguration.objects.filter(
            code__iexact=code,
        )

        if self.instance:
            queryset = queryset.exclude(
                id=self.instance.id,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "A grading configuration with this code "
                "already exists."
            )

        return code

    def validate_confidence_review_threshold(
        self,
        value,
    ):
        if value < 0 or value > 1:
            raise serializers.ValidationError(
                "Confidence threshold must be between "
                "0.000 and 1.000."
            )

        return value

    def validate_version(self, value):
        if value < 1:
            raise serializers.ValidationError(
                "Version must be at least 1."
            )

        return value

    def validate_configuration(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Configuration must be a JSON object."
            )

        return value



class RubricCriterionSerializer(
    serializers.ModelSerializer
):
    assignment_code = serializers.CharField(
        source="assignment_level.assignment.code",
        read_only=True,
    )

    assignment_title = serializers.CharField(
        source="assignment_level.assignment.title",
        read_only=True,
    )

    level_code = serializers.CharField(
        source="assignment_level.level_code",
        read_only=True,
    )

    level_display_name = serializers.CharField(
        source="assignment_level.display_name",
        read_only=True,
    )

    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = RubricCriterion
        fields = (
            "id",
            "assignment_level",
            "assignment_code",
            "assignment_title",
            "level_code",
            "level_display_name",
            "criterion_code",
            "title",
            "description",
            "maximum_score",
            "sequence",
            "ai_gradable",
            "deterministic",
            "can_delete",
            "created_at",
        )

        read_only_fields = (
            "id",
            "assignment_code",
            "assignment_title",
            "level_code",
            "level_display_name",
            "can_delete",
            "created_at",
        )

    def get_can_delete(
        self,
        obj: RubricCriterion,
    ) -> bool:
        return not obj.bands.exists()

    def validate_criterion_code(self, value):
        return value.strip().upper()

    def validate(self, attrs):
        assignment_level = attrs.get(
            "assignment_level",
            getattr(
                self.instance,
                "assignment_level",
                None,
            ),
        )

        criterion_code = attrs.get(
            "criterion_code",
            getattr(
                self.instance,
                "criterion_code",
                None,
            ),
        )

        sequence = attrs.get(
            "sequence",
            getattr(self.instance, "sequence", None),
        )

        maximum_score = attrs.get(
            "maximum_score",
            getattr(
                self.instance,
                "maximum_score",
                None,
            ),
        )

        if assignment_level and criterion_code:
            queryset = RubricCriterion.objects.filter(
                assignment_level=assignment_level,
                criterion_code__iexact=criterion_code,
            )

            if self.instance:
                queryset = queryset.exclude(
                    id=self.instance.id,
                )

            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "criterion_code": (
                            "This criterion code already exists "
                            "for the selected assignment level."
                        )
                    }
                )

        if assignment_level and sequence is not None:
            queryset = RubricCriterion.objects.filter(
                assignment_level=assignment_level,
                sequence=sequence,
            )

            if self.instance:
                queryset = queryset.exclude(
                    id=self.instance.id,
                )

            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "sequence": (
                            "This sequence number is already used "
                            "for the selected assignment level."
                        )
                    }
                )

        if maximum_score is not None and maximum_score <= 0:
            raise serializers.ValidationError(
                {
                    "maximum_score": (
                        "Maximum score must be greater than zero."
                    )
                }
            )

        return attrs

class RubricBandSerializer(serializers.ModelSerializer):
    criterion_code = serializers.CharField(
        source="rubric_criterion.criterion_code",
        read_only=True,
    )

    criterion_title = serializers.CharField(
        source="rubric_criterion.title",
        read_only=True,
    )

    assignment_level_id = serializers.UUIDField(
        source="rubric_criterion.assignment_level.id",
        read_only=True,
    )

    assignment_code = serializers.CharField(
        source=(
            "rubric_criterion."
            "assignment_level.assignment.code"
        ),
        read_only=True,
    )

    level_code = serializers.CharField(
        source=(
            "rubric_criterion."
            "assignment_level.level_code"
        ),
        read_only=True,
    )

    class Meta:
        model = RubricBand
        fields = (
            "id",
            "rubric_criterion",
            "criterion_code",
            "criterion_title",
            "assignment_level_id",
            "assignment_code",
            "level_code",
            "band_code",
            "display_name",
            "minimum_percentage",
            "maximum_percentage",
            "descriptor",
            "sequence",
        )

        read_only_fields = (
            "id",
            "criterion_code",
            "criterion_title",
            "assignment_level_id",
            "assignment_code",
            "level_code",
        )

    def validate(self, attrs):
        rubric_criterion = attrs.get(
            "rubric_criterion",
            getattr(
                self.instance,
                "rubric_criterion",
                None,
            ),
        )

        band_code = attrs.get(
            "band_code",
            getattr(self.instance, "band_code", None),
        )

        sequence = attrs.get(
            "sequence",
            getattr(self.instance, "sequence", None),
        )

        minimum_percentage = attrs.get(
            "minimum_percentage",
            getattr(
                self.instance,
                "minimum_percentage",
                None,
            ),
        )

        maximum_percentage = attrs.get(
            "maximum_percentage",
            getattr(
                self.instance,
                "maximum_percentage",
                None,
            ),
        )

        if rubric_criterion and band_code:
            queryset = RubricBand.objects.filter(
                rubric_criterion=rubric_criterion,
                band_code=band_code,
            )

            if self.instance:
                queryset = queryset.exclude(
                    id=self.instance.id,
                )

            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "band_code": (
                            "This band already exists for the "
                            "selected rubric criterion."
                        )
                    }
                )

        if rubric_criterion and sequence is not None:
            queryset = RubricBand.objects.filter(
                rubric_criterion=rubric_criterion,
                sequence=sequence,
            )

            if self.instance:
                queryset = queryset.exclude(
                    id=self.instance.id,
                )

            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "sequence": (
                            "This sequence number is already used "
                            "for the selected rubric criterion."
                        )
                    }
                )

        if (
            minimum_percentage is not None
            and maximum_percentage is not None
        ):
            if minimum_percentage < 0:
                raise serializers.ValidationError(
                    {
                        "minimum_percentage": (
                            "Minimum percentage cannot be negative."
                        )
                    }
                )

            if maximum_percentage > 100:
                raise serializers.ValidationError(
                    {
                        "maximum_percentage": (
                            "Maximum percentage cannot exceed 100."
                        )
                    }
                )

            if minimum_percentage > maximum_percentage:
                raise serializers.ValidationError(
                    {
                        "maximum_percentage": (
                            "Maximum percentage cannot be lower "
                            "than minimum percentage."
                        )
                    }
                )

        return attrs


class AIGradingProfileSerializer(
    serializers.ModelSerializer
):
    assignment_code = serializers.CharField(
        source="assignment_level.assignment.code",
        read_only=True,
    )

    assignment_title = serializers.CharField(
        source="assignment_level.assignment.title",
        read_only=True,
    )

    level_code = serializers.CharField(
        source="assignment_level.level_code",
        read_only=True,
    )

    level_display_name = serializers.CharField(
        source="assignment_level.display_name",
        read_only=True,
    )

    class Meta:
        model = AIGradingProfile
        fields = (
            "id",
            "assignment_level",
            "assignment_code",
            "assignment_title",
            "level_code",
            "level_display_name",
            "profile_name",
            "system_prompt",
            "output_schema",
            "temperature",
            "model_provider",
            "model_name",
            "is_active",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "assignment_code",
            "assignment_title",
            "level_code",
            "level_display_name",
            "created_at",
            "updated_at",
        )

    def validate_temperature(self, value):
        if value < 0 or value > 2:
            raise serializers.ValidationError(
                "Temperature must be between 0.00 and 2.00."
            )

        return value

    def validate_output_schema(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Output schema must be a JSON object."
            )

        return value

    def validate_assignment_level(self, value):
        queryset = AIGradingProfile.objects.filter(
            assignment_level=value,
        )

        if self.instance:
            queryset = queryset.exclude(
                id=self.instance.id,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "This assignment level already has an AI grading profile."
            )

        return value


class TaskSerializer(serializers.ModelSerializer):
    assignment_code = serializers.CharField(
        source="assignment_level.assignment.code",
        read_only=True,
    )
    level_code = serializers.CharField(
        source="assignment_level.level_code",
        read_only=True,
    )

    class Meta:
        model = Task
        fields = (
            "id",
            "assignment_level",
            "assignment_code",
            "level_code",
            "task_code",
            "title",
            "instructions",
            "sequence",
            "created_at",
        )
        read_only_fields = (
            "id",
            "assignment_code",
            "level_code",
            "created_at",
        )


class TaskCriterionWeightSerializer(serializers.ModelSerializer):
    task_code = serializers.CharField(
        source="task.task_code",
        read_only=True,
    )
    criterion_code = serializers.CharField(
        source="rubric_criterion.criterion_code",
        read_only=True,
    )

    class Meta:
        model = TaskCriterionWeight
        fields = (
            "id",
            "task",
            "task_code",
            "rubric_criterion",
            "criterion_code",
            "weight_percentage",
            "band",
        )
        read_only_fields = (
            "id",
            "task_code",
            "criterion_code",
        )


class TaskCriteriaMappingSerializer(serializers.ModelSerializer):
    task_code = serializers.CharField(
        source="task.task_code",
        read_only=True,
    )
    criterion_code = serializers.CharField(
        source="rubric_criterion.criterion_code",
        read_only=True,
    )
    assignment_level_id = serializers.UUIDField(
        source="assignment_level.id",
        read_only=True,
    )

    class Meta:
        model = TaskCriteriaMapping
        fields = (
            "id",
            "assignment_level",
            "assignment_level_id",
            "task",
            "task_code",
            "rubric_criterion",
            "criterion_code",
            "inferred_weight",
            "ai_explanation",
            "created_at",
        )
        read_only_fields = (
            "id",
            "task_code",
            "criterion_code",
            "assignment_level_id",
            "created_at",
        )


class ExtractedEvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtractedEvidence
        fields = (
            "id",
            "submission",
            "page_number",
            "content_text",
            "image_url",
            "extraction_confidence",
            "created_at",
        )
        read_only_fields = ("id", "created_at")
class TaskEvidenceMapSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskEvidenceMap
        fields = (
            "id",
            "task",
            "evidence",
            "mapping_role",
            "confidence_score",
        )
        read_only_fields = (
            "id",
        )


class PromptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prompt
        fields = (
            "id",
            "submission",
            "stage",
            "prompt_text",
            "prompt_payload",
            "created_at",
        )
        read_only_fields = (
            "id",
            "created_at",
        )


class ResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Response
        fields = (
            "id",
            "prompt",
            "model_name",
            "response_payload",
            "confidence_score",
            "created_at",
        )
        read_only_fields = (
            "id",
            "created_at",
        )


class CriterionResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = CriterionResult
        fields = (
            "id",
            "submission",
            "rubric_criterion",
            "awarded_marks",
            "achievement_band",
            "feedback",
            "created_at",
        )
        read_only_fields = (
            "id",
            "created_at",
        )

class AIDispatchRequestSerializer(serializers.Serializer):
    submission_id = serializers.UUIDField(required=True)
    ai_agent_url = serializers.URLField(
        required=False,
        default="https://api.your-ai-agent-service.com/v1/grade",
        help_text="Target URL of the external AI Agent API"
    )

class AIDispatchResponseSerializer(serializers.Serializer):
    submission_id = serializers.UUIDField()
    status = serializers.CharField()
    evidence_count = serializers.IntegerField()
    ai_response = serializers.JSONField()