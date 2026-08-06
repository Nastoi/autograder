from rest_framework import serializers

from .models import LearnerSubmission


class SubmissionContextSerializer(serializers.Serializer):
    context_id = serializers.UUIDField()

    learner = serializers.DictField()
    cohort = serializers.DictField()
    module = serializers.DictField()
    assignment = serializers.DictField()
    assignment_level = serializers.DictField()


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
            "context_id",
            "assignment_code",
            "assignment_title",
            "level",
            "submission_track",
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