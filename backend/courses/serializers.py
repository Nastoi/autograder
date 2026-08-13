from rest_framework import serializers

from .models import (
    Cohort,
    Module,
    ModuleAssignment,
    Qualification,
)
from grading.models import TaskCriteriaMapping

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
        return not obj.modules.exists()

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
        return (
            not obj.cohorts.exists()
            and not obj.assignments.exists()
        )

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
        # Check if the relation exists before calling .exists()
        if hasattr(obj, "enrolments"):
            return not obj.assessment_mappings.exists()
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
            # Query by primary key ID instead of passing the model instance directly
            has_task_criteria_mappings = TaskCriteriaMapping.objects.filter(
                assignment_level_id=obj.id
            ).exists()

            return (
                not obj.rubric_criteria.exists()
                and not obj.rag_sources.exists()
                and not obj.grading_tasks.exists()
                and not has_task_criteria_mappings  # <-- Uses safe ID lookup
                and not hasattr(obj, "ai_grading_profile")
            )

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



# class AssignmentLevelSerializer(serializers.ModelSerializer):
#     assignment_code = serializers.CharField(
#         source="assignment.assignment_code",
#         read_only=True,
#     )
#     assignment_title = serializers.CharField(
#         source="assignment.assignment_title",
#         read_only=True,
#     )
#     module_id = serializers.UUIDField(
#         source="assignment.module.id",
#         read_only=True,
#     )
#     module_code = serializers.CharField(
#         source="assignment.module.module_code",
#         read_only=True,
#     )
#     qualification_id = serializers.UUIDField(
#         source="assignment.module.qualification.id",
#         read_only=True,
#     )
#     qualification_code = serializers.CharField(
#         source="assignment.module.qualification.qualification_code",
#         read_only=True,
#     )
#     grading_configuration_code = serializers.CharField(
#         source="grading_configuration.grading_config_code",
#         read_only=True,
#     )
#     grading_configuration_name = serializers.CharField(
#         source="grading_configuration.grading_config_name",
#         read_only=True,
#     )
#     can_delete = serializers.SerializerMethodField()

#     class Meta:
#         model = AssignmentLevel
#         fields = (
#             "id",
#             "assignment",
#             "assignment_code",
#             "assignment_title",
#             "module_id",
#             "module_code",
#             "qualification_id",
#             "qualification_code",
#             "grading_configuration",
#             "grading_configuration_code",
#             "grading_configuration_name",
#             "level_code",
#             "display_name",
#             "title",
#             "instructions",
#             "tasks",
#             "deliverables",
#             "expected_outcome",
#             "source_filename",
#             "version",
#             "configuration_status",
#             "is_active",
#             "can_delete",
#             "created_at",
#             "updated_at",
#         )

#         read_only_fields = (
#             "id",
#             "assignment_code",
#             "assignment_title",
#             "module_id",
#             "module_code",
#             "qualification_id",
#             "qualification_code",
#             "grading_configuration_code",
#             "grading_configuration_name",
#             "can_delete",
#             "created_at",
#             "updated_at",
#         )

#     def get_can_delete(self, obj):
#         return (
#             not obj.rubric_criteria.exists()
#             and not obj.rag_sources.exists()
#             and not hasattr(obj, "ai_grading_profile")
#         )

#     def validate(self, attrs):
#         assignment = attrs.get(
#             "assignment",
#             getattr(self.instance, "assignment", None),
#         )
#         level_code = attrs.get(
#             "level_code",
#             getattr(self.instance, "level_code", None),
#         )
#         version = attrs.get(
#             "version",
#             getattr(self.instance, "version", None),
#         )

#         if assignment and level_code and version is not None:
#             queryset = AssignmentLevel.objects.filter(
#                 assignment=assignment,
#                 level_code=level_code,
#                 version=version,
#             )

#             if self.instance:
#                 queryset = queryset.exclude(
#                     id=self.instance.id,
#                 )

#             if queryset.exists():
#                 raise serializers.ValidationError(
#                     {
#                         "level_code": (
#                             "This assignment already has this "
#                             "level and version."
#                         )
#                     }
#                 )

#         return attrs
