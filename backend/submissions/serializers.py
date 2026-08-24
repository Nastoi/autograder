from rest_framework import serializers
from .models import SubmissionContext, LearnerSubmission, SubmissionPage
from grading.serializers import CriterionResultSerializer

class SubmissionContextSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionContext
        fields = (
            "id",
            "learner",
            "cohort",
            "assignment_level",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "learner", "created_at", "updated_at")

    def validate(self, attrs):
        """Ensure cohort and assignment level belong to the same module."""
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
                    "Cohort and assignment level must belong to the same module."
                )

        return attrs


class SubmissionPageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionPage
        fields = ("id", "page_number", "extracted_text", "image_url")

    def get_image_url(self, obj):
        """
        Build absolute URL to the page image endpoint.
        Falls back gracefully if request is not in context.
        """
        request = self.context.get("request")
        url = f"/api/submissions/pages/{obj.id}/image/"
        return request.build_absolute_uri(url) if request else url


class LearnerSubmissionSerializer(serializers.ModelSerializer):
    is_manual_override = serializers.SerializerMethodField()
    manual_override_by = serializers.SerializerMethodField()

    context_id = serializers.UUIDField(
        source="context.id",
        read_only=True,
    )

    assignment_code = serializers.CharField(
        source="assignment_level.assignment.assignment_code",
        read_only=True,
    )

    assignment_title = serializers.CharField(
        source="assignment_level.assignment.assignment_title",
        read_only=True,
    )

    level = serializers.CharField(
        source="assignment_level.level_code",
        read_only=True,
    )   

    criterion_results = CriterionResultSerializer(
        many=True,
        read_only=True,
    )

    def _manual_override_log(self, obj):
        return next(
            (
                log
                for log in obj.process_logs.all()
                if log.event_code == "FACULTY_OVERRIDE_CREATED"
            ),
            None,
        )

    def get_is_manual_override(self, obj):
        return self._manual_override_log(obj) is not None

    def get_manual_override_by(self, obj):
        log = self._manual_override_log(obj)
        if log is None or not isinstance(log.details, dict):
            return None
        return log.details.get("faculty_name") or None

    class Meta:
        model = LearnerSubmission
        fields = (
            "id",
            "context",
            "context_id",
            "learner",
            "assignment_level",
            "assignment_code",
            "assignment_title",
            "level",
            "submission_track",
            "submitted_file",
            "original_filename",
            "attempt_number",
            "status",
            "final_score",
            "maximum_score",
            "achieved_band",
            "feedback",
            "is_manual_override",
            "manual_override_by",
            "criterion_results",
            "submitted_at",
            "completed_at",
        )
        read_only_fields = (
            "original_filename",
            "status",
            "final_score",
            "maximum_score",
            "achieved_band",
            "feedback",
            "submitted_at",
            "completed_at",
        )


class LearnerSubmissionDetailSerializer(serializers.ModelSerializer):
    pages = SubmissionPageSerializer(many=True, read_only=True)

    context_id = serializers.UUIDField(
        source="context.id",
        read_only=True,
    )

    assignment_code = serializers.CharField(
        source="assignment_level.assignment.assignment_code",
        read_only=True,
    )

    assignment_title = serializers.CharField(
        source="assignment_level.assignment.assignment_title",
        read_only=True,
    )

    level = serializers.CharField(
        source="assignment_level.level_code",
        read_only=True,
    )

    class Meta:
        model = LearnerSubmission
        fields = "__all__"


class LearnerSubmissionListSerializer(serializers.ModelSerializer):
    assignment_code = serializers.CharField(
        source="assignment_level.assignment.assignment_code",
        read_only=True,
    )
    assignment_title = serializers.CharField(
        source="assignment_level.assignment.assignment_title",
        read_only=True,
    )
    module_id = serializers.UUIDField(
        source="assignment_level.assignment.module.id",
        read_only=True,
        default=None,
    )
    module_title = serializers.CharField(
        source="assignment_level.assignment.module.module_name",
        read_only=True,
        default="",
    )

    class Meta:
        model = LearnerSubmission
        fields = (
            "id",
            "status",
            "attempt_number",
            "submitted_at",
            "assignment_code",
            "assignment_title",
            "module_id",
            "module_title",
        )
