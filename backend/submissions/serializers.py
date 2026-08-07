from rest_framework import serializers
from .models import SubmissionContext, LearnerSubmission, SubmissionPage


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


class SubmissionPageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionPage
        fields = ("id", "page_number", "extracted_text", "image_url")

    def get_image_url(self, obj):
        request = self.context.get("request")
        url = f"/api/submissions/pages/{obj.id}/image/"
        return request.build_absolute_uri(url) if request else url


class LearnerSubmissionSerializer(serializers.ModelSerializer):
    context_id = serializers.UUIDField(
        source="context.id",
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

    level = serializers.CharField(
        source="assignment_level.level_code",
        read_only=True,
    )

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
        source="assignment_level.assignment.code",
        read_only=True,
    )

    assignment_title = serializers.CharField(
        source="assignment_level.assignment.title",
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
        source="assignment_level.assignment.code",
        read_only=True,
    )
    assignment_title = serializers.CharField(
        source="assignment_level.assignment.title",
        read_only=True,
    )
    module_id = serializers.UUIDField(
        source="assignment_level.assignment.module.id",
        read_only=True,
        default=None,
    )
    module_title = serializers.CharField(
        source="assignment_level.assignment.module.title",
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