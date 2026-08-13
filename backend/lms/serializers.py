from rest_framework import serializers

from .models import AssessmentMapping


class AssessmentMappingSerializer(
    serializers.ModelSerializer,
):
    cohort_code = serializers.CharField(
        source="cohort.cohort_code",
        read_only=True,
    )

    cohort_name = serializers.CharField(
        source="cohort.cohort_name",
        read_only=True,
    )

    assignment_code = serializers.CharField(
        source="assignment.assignment_code",
        read_only=True,
    )

    assignment_title = serializers.CharField(
        source="assignment.assignment_title",
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
            "assignment",
            "assignment_code",
            "assignment_title",
            "lti_client_id",
            "lti_jwks_url",
            "lti_deployment_id",
            "is_active",
            "has_submissions",
            "can_delete",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "name",
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

        assignment = attrs.get(
            "assignment",
            getattr(self.instance, "assignment", None),
        )

        if cohort and assignment:
            if cohort.module_id != assignment.module_id:
                raise serializers.ValidationError(
                    {
                        "assignment": (
                            "The assignment must belong to the "
                            "same module as the selected cohort."
                        )
                    }
                )

        return attrs

    def create(self, validated_data):
        cohort = validated_data["cohort"]
        assignment = validated_data["assignment"]

        validated_data["name"] = (
            f"{cohort.cohort_code} - "
            f"{assignment.assignment_code}"
        )

        return super().create(validated_data)

    def update(self, instance, validated_data):
        cohort = validated_data.get(
            "cohort",
            instance.cohort,
        )

        assignment = validated_data.get(
            "assignment",
            instance.assignment,
        )

        validated_data["name"] = (
            f"{cohort.cohort_code} - "
            f"{assignment.assignment_code}"
        )

        return super().update(
            instance,
            validated_data,
        )
