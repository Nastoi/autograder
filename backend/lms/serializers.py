from rest_framework import serializers

from .models import AssessmentMapping


class AssessmentMappingSerializer(serializers.ModelSerializer):
    cohort_code = serializers.CharField(
        source="cohort.code",
        read_only=True,
    )

    cohort_name = serializers.CharField(
        source="cohort.name",
        read_only=True,
    )

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

    has_submissions = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = AssessmentMapping
        fields = (
            "id",
            "name",
            "cohort",
            "cohort_code",
            "cohort_name",
            "assignment_level",
            "assignment_code",
            "assignment_title",
            "level_code",
            "external_platform_id",
            "external_context_id",
            "external_resource_link_id",
            "is_active",
            "has_submissions",
            "can_delete",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "has_submissions",
            "can_delete",
        )

    def get_has_submissions(
        self,
        obj: AssessmentMapping,
    ) -> bool:
        return obj.submission_contexts.filter(
            submissions__isnull=False,
        ).exists()

    def get_can_delete(
        self,
        obj: AssessmentMapping,
    ) -> bool:
        return not self.get_has_submissions(obj)

    def validate(self, attrs):
        cohort = attrs.get(
            "cohort",
            getattr(self.instance, "cohort", None),
        )

        assignment_level = attrs.get(
            "assignment_level",
            getattr(self.instance, "assignment_level", None),
        )

        if cohort and assignment_level:
            if (
                cohort.module_id
                != assignment_level.assignment.module_id
            ):
                raise serializers.ValidationError(
                    {
                        "assignment_level": (
                            "The assignment level must belong to "
                            "the same module as the selected cohort."
                        )
                    }
                )

        return attrs