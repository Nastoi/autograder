from rest_framework import serializers
from django.db import transaction
from grading.models import (
    AIGradingProfile,
    GradingConfiguration,
)
from .models import (
    AssignmentLevel,
    Cohort,
    Module,
    ModuleAssignment,
    Qualification,
)

class QualificationSerializer(serializers.ModelSerializer):
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Qualification
        fields = (
            "id",
            "qualification_code",
            "qualification_name",
            "description",
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
        obj: Qualification,
    ) -> bool:
        return True

    def validate_qualification_code(self, value: str) -> str:
        normalized = value.strip().upper()

        queryset = Qualification.objects.filter(
            qualification_code__iexact=normalized,
        )

        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "A qualification with this code already exists."
            )

        return normalized


class ModuleSerializer(serializers.ModelSerializer):
    qualification_code = serializers.CharField(
        source="qualification.qualification_code",
        read_only=True,
    )
    qualification_name = serializers.CharField(
        source="qualification.qualification_name",
        read_only=True,
    )
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = (
            "id",
            "qualification",
            "qualification_code",
            "qualification_name",
            "module_code",
            "module_name",
            "description",
            "is_active",
            "can_delete",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "qualification_code",
            "qualification_name",
            "can_delete",
            "created_at",
            "updated_at",
        )

    def get_can_delete(self, obj):
        return True

    def validate_module_code(self, value):
        code = value.strip().upper()

        queryset = Module.objects.filter(
            module_code__iexact=code,
        )

        if self.instance:
            queryset = queryset.exclude(
                id=self.instance.id,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "A module with this code already exists."
            )

        return code

class CohortSerializer(serializers.ModelSerializer):
    module_code = serializers.CharField(
        source="module.module_code",
        read_only=True,
    )
    module_name = serializers.CharField(
        source="module.module_name",
        read_only=True,
    )
    qualification_id = serializers.UUIDField(
        source="module.qualification.id",
        read_only=True,
    )
    qualification_code = serializers.CharField(
        source="module.qualification.qualification_code",
        read_only=True,
    )

    qualification_name = serializers.CharField(
        source="module.qualification.qualification_name",
        read_only=True,
    )
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Cohort
        fields = (
            "id",
            "cohort_code",
            "cohort_name",
            "module",
            "module_code",
            "module_name",
            "qualification_id",
            "qualification_code",
            "qualification_name",
            "start_date",
            "end_date",
            "is_active",
            "can_delete",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "module_code",
            "module_name",
            "qualification_id",
            "qualification_code",
            "qualification_name",
            "can_delete",
            "created_at",
            "updated_at",
        )

    def get_can_delete(self, obj):
        return True

    def validate_cohort_code(self, value):
        cohort_code = value.strip().upper()

        queryset = Cohort.objects.filter(
            cohort_code__iexact=cohort_code,
        )

        if self.instance:
            queryset = queryset.exclude(
                id=self.instance.id,
            )

        if queryset.exists():
            raise serializers.ValidationError(
                "A cohort with this code already exists."
            )

        return cohort_code

    def validate(self, attrs):
        start_date = attrs.get(
            "start_date",
            getattr(self.instance, "start_date", None),
        )
        end_date = attrs.get(
            "end_date",
            getattr(self.instance, "end_date", None),
        )

        if (
            start_date is not None
            and end_date is not None
            and end_date < start_date
        ):
            raise serializers.ValidationError(
                {
                    "end_date": (
                        "End date cannot be earlier than start date."
                    )
                }
            )

        return attrs


class ModuleAssignmentSerializer(serializers.ModelSerializer):
    module_code = serializers.CharField(
        source="module.module_code",
        read_only=True,
    )
    module_name = serializers.CharField(
        source="module.module_name",
        read_only=True,
    )
    qualification_id = serializers.UUIDField(
        source="module.qualification.id",
        read_only=True,
    )
    qualification_code = serializers.CharField(
        source="module.qualification.qualification_code",
        read_only=True,
    )
    qualification_name = serializers.CharField(
        source="module.qualification.qualification_name",
        read_only=True,
    )
    grading_configuration_code = serializers.CharField(
        source="grading_configuration.grading_config_code",
        read_only=True,
    )
    grading_configuration_name = serializers.CharField(
        source="grading_configuration.grading_config_name",
        read_only=True,
    )
    level_display_name = serializers.CharField(
        source="get_level_display",
        read_only=True,
    )
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = ModuleAssignment
        fields = (
            "id",
            "module",
            "module_code",
            "module_name",
            "qualification_id",
            "qualification_code",
            "qualification_name",
            "grading_configuration",
            "grading_configuration_code",
            "grading_configuration_name",
            "level",
            "level_display_name",
            "assignment_code",
            "assignment_title",
            "skill_statement_code",
            "skill_statement",
            "objective",
            "maximum_score",
            "minimum_pass_score",
            "is_summative",
            "contributes_to_final_mark",
            "final_mark_weight",
            "is_active",
            "can_delete",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "module_code",
            "module_name",
            "qualification_id",
            "qualification_code",
            "qualification_name",
            "grading_configuration_code",
            "grading_configuration_name",
            "level_display_name",
            "can_delete",
            "created_at",
            "updated_at",
        )

    def get_can_delete(self, obj):
        return not obj.levels.filter(
            rubric_criteria__isnull=False,
        ).exists()

    def validate_assignment_code(self, value):
        return value.strip().upper()

    def validate(self, attrs):
        module = attrs.get(
            "module",
            getattr(self.instance, "module", None),
        )
        assignment_code = attrs.get(
            "assignment_code",
            getattr(self.instance, "assignment_code", None),
        )
        maximum_score = attrs.get(
            "maximum_score",
            getattr(self.instance, "maximum_score", None),
        )
        minimum_pass_score = attrs.get(
            "minimum_pass_score",
            getattr(self.instance, "minimum_pass_score", None),
        )
        contributes = attrs.get(
            "contributes_to_final_mark",
            getattr(
                self.instance,
                "contributes_to_final_mark",
                True,
            ),
        )
        weight = attrs.get(
            "final_mark_weight",
            getattr(self.instance, "final_mark_weight", None),
        )

        if module and assignment_code:
            queryset = ModuleAssignment.objects.filter(
                module=module,
                assignment_code__iexact=assignment_code,
            )

            if self.instance:
                queryset = queryset.exclude(
                    id=self.instance.id,
                )

            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "assignment_code": (
                            "An assignment with this code already "
                            "exists in the selected module."
                        )
                    }
                )

        if (
            maximum_score is not None
            and minimum_pass_score is not None
            and minimum_pass_score > maximum_score
        ):
            raise serializers.ValidationError(
                {
                    "minimum_pass_score": (
                        "Minimum pass score cannot exceed "
                        "maximum score."
                    )
                }
            )

        if contributes and weight is not None and weight <= 0:
            raise serializers.ValidationError(
                {
                    "final_mark_weight": (
                        "Final mark weight must be greater than zero "
                        "when the assignment contributes to the final mark."
                    )
                }
            )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        assignment = super().create(validated_data)

        level_definitions = (
            (
                "basic",
                "Basic",
                1,
            ),
            (
                "advanced",
                "Advanced",
                2,
            ),
        )

        for (level_code,display_name,sequence,) in level_definitions:
            configuration_code = (
                f"{assignment.assignment_code}-{level_code.upper()}"
            )

            if GradingConfiguration.objects.filter(
                grading_config_code=configuration_code,
            ).exists():
                configuration_code = (
                    f"{assignment.module.module_code}-"
                    f"{assignment.assignment_code}-"
                    f"{level_code.upper()}-"
                    f"{str(assignment.id)[:8]}"
                )

            grading_configuration = (
                GradingConfiguration.objects.create(
                    grading_config_code=configuration_code,
                    grading_config_name=(
                        f"{assignment.assignment_title} - "
                        f"{display_name}"
                    ),
                    grading_type=(
                        GradingConfiguration
                        .GradingType
                        .HYBRID
                    ),
                    structural_check_enabled=True,
                    automated_testing_enabled=False,
                    rag_enabled=True,
                    ai_grading_enabled=True,
                    manual_review_required=True,
                    confidence_review_threshold="0.700",
                    version=1,
                    configuration={
                        "score_source": (
                            "backend_calculation"
                        ),
                        "attempt_level": level_code,
                        "assignment_code": (
                            assignment.assignment_code
                        ),
                        "manual_review_on_mapping_mismatch": True,
                        "ai_may_not_exceed_criterion_maximum": True,
                    },
                    is_active=True,
                )
            )

            if level_code == "basic":
                band_definitions = [
                    {
                        "band_code": "failed",
                        "display_name": "Failed",
                        "minimum_percentage": 0,
                        "maximum_percentage": 69.99,
                    },
                    {
                        "band_code": "foundation",
                        "display_name": "Foundation",
                        "minimum_percentage": 70,
                        "maximum_percentage": 79.99,
                    },
                    {
                        "band_code": "proficient",
                        "display_name": "Proficient",
                        "minimum_percentage": 80,
                        "maximum_percentage": 100,
                    },
                ]
            else:
                band_definitions = [
                    {
                        "band_code": "failed",
                        "display_name": "Failed",
                        "minimum_percentage": 0,
                        "maximum_percentage": 69.99,
                    },
                    {
                        "band_code": "proficient",
                        "display_name": "Proficient",
                        "minimum_percentage": 70,
                        "maximum_percentage": 79.99,
                    },
                    {
                        "band_code": "expert",
                        "display_name": "Expert",
                        "minimum_percentage": 80,
                        "maximum_percentage": 100,
                    },
                ]


            assignment_level = AssignmentLevel.objects.create(
                band_definitions=band_definitions,
                assignment=assignment,
                grading_configuration=(
                    grading_configuration
                ),
                level_code=level_code,
                display_name=display_name,
                sequence=sequence,
                title=(
                    f"{assignment.assignment_title} - "
                    f"{display_name}"
                ),
                # Seed the new per-level fields from legacy assignment-wide
                # values so existing create calls remain backward compatible.
                skill_statement_code=assignment.skill_statement_code,
                skill_statement=assignment.skill_statement,
                objective=assignment.objective,
                instructions="",
                tasks=[],
                deliverables=[],
                expected_outcome="",
                source_filename=None,
                version=1,
                configuration_status=(
                    AssignmentLevel
                    .ConfigurationStatus
                    .DRAFT
                ),
                is_active=True,
            )

            allowed_bands = [
                band["band_code"]
                for band in (assignment_level.band_definitions or [])
            ]

            AIGradingProfile.objects.create(
                assignment_level=assignment_level,
                profile_name=(
                    f"{assignment.assignment_code} "
                    f"{display_name} AI Grading Profile"
                ),
                system_prompt=(
                    "Grade only against the supplied assignment, "
                    "rubric, retrieved context, and learner evidence. "
                    f"The selected grading level is {level_code}. "
                    "Do not invent requirements. "
                    "Score every criterion independently, cite concrete "
                    "evidence, and never exceed its maximum. "
                    "Return low confidence and request manual review when "
                    "evidence is missing, ambiguous, contradictory, or "
                    "inaccessible."
                ),
                output_schema={
                    "type": "object",
                    "required": [
                        "criteria",
                        "overall_feedback",
                        "confidence",
                        "requires_manual_review",
                    ],
                    "properties": {
                        "criteria": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "required": [
                                    "criterion_code",
                                    "score",
                                    "maximum_score",
                                    "achieved_band",
                                    "evidence",
                                    "feedback",
                                    "confidence",
                                ],
                                "properties": {
                                    "criterion_code": {
                                        "type": "string",
                                    },
                                    "score": {
                                        "type": "number",
                                    },
                                    "maximum_score": {
                                        "type": "number",
                                    },
                                    "achieved_band": {
                                        "enum": allowed_bands,
                                    },
                                    "evidence": {
                                        "type": "array",
                                        "items": {
                                            "type": "string",
                                        },
                                    },
                                    "feedback": {
                                        "type": "string",
                                    },
                                    "confidence": {
                                        "type": "number",
                                        "minimum": 0,
                                        "maximum": 1,
                                    },
                                },
                            },
                        },
                        "overall_feedback": {
                            "type": "string",
                        },
                        "confidence": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1,
                        },
                        "requires_manual_review": {
                            "type": "boolean",
                        },
                        "review_reason": {
                            "type": "string",
                        },
                    },
                },
                temperature="0.10",
                model_provider="openai",
                model_name="configure-in-environment",
                is_active=True,
            )

        return assignment



class AssignmentLevelSerializer(serializers.ModelSerializer):
    assignment_code = serializers.CharField(
        source="assignment.assignment_code",
        read_only=True,
    )
    assignment_title = serializers.CharField(
        source="assignment.assignment_title",
        read_only=True,
    )
    module_id = serializers.UUIDField(
        source="assignment.module.id",
        read_only=True,
    )
    module_code = serializers.CharField(
        source="assignment.module.module_code",
        read_only=True,
    )
    module_name = serializers.CharField(
        source="assignment.module.module_name",
        read_only=True,
    )
    qualification_id = serializers.UUIDField(
        source="assignment.module.qualification.id",
        read_only=True,
    )
    qualification_code = serializers.CharField(
        source="assignment.module.qualification.qualification_code",
        read_only=True,
    )
    grading_configuration_code = serializers.CharField(
        source="grading_configuration.grading_config_code",
        read_only=True,
    )
    grading_configuration_name = serializers.CharField(
        source="grading_configuration.grading_config_name",
        read_only=True,
    )

    can_delete = serializers.SerializerMethodField()

    

    class Meta:
        model = AssignmentLevel
        fields = (
            "id",
            "assignment",
            "assignment_code",
            "assignment_title",
            "module_id",
            "module_code",
            "module_name",
            "qualification_id",
            "qualification_code",
            "grading_configuration",
            "grading_configuration_code",
            "grading_configuration_name",
            "level_code",
            "display_name",
            "sequence",
            "band_definitions",
            "title",
            "skill_statement_code",
            "skill_statement",
            "objective",
            "scenario",
            "instructions",
            "tasks",
            "deliverables",
            "expected_outcome",
            "source_filename",
            "version",
            "configuration_status",
            "is_active",
            "can_delete",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "assignment_code",
            "assignment_title",
            "module_id",
            "module_code",
            "module_name",
            "qualification_id",
            "qualification_code",
            "grading_configuration_code",
            "grading_configuration_name",
            "can_delete",
            "created_at",
            "updated_at",
        )

    def get_can_delete(self, obj):
        return True

    def validate(self, attrs):
        assignment = attrs.get(
            "assignment",
            getattr(self.instance, "assignment", None),
        )

        level_code = attrs.get(
            "level_code",
            getattr(self.instance, "level_code", None),
        )

        version = attrs.get(
            "version",
            getattr(self.instance, "version", None),
        )

        if assignment and level_code and version is not None:
            queryset = AssignmentLevel.objects.filter(
                assignment=assignment,
                level_code__iexact=level_code,
                version=version,
            )

            if self.instance:
                queryset = queryset.exclude(
                    id=self.instance.id,
                )

            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "level_code": (
                            "This assignment already has this "
                            "level and version."
                        )
                    }
                )

        return attrs


    def validate_level_code(self, value):
        normalized = value.strip().lower().replace(" ", "_")

        if not normalized:
            raise serializers.ValidationError(
                "Track code is required."
            )

        return normalized


    def validate_display_name(self, value):
        normalized = value.strip()

        if not normalized:
            raise serializers.ValidationError(
                "Track name is required."
            )

        return normalized
