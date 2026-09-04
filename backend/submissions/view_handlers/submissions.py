from pathlib import Path
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.viewsets import ModelViewSet
from ..models import LearnerSubmission, SubmissionContext
from ..serializers import (
    LearnerSubmissionSerializer,
    LearnerSubmissionDetailSerializer,
    LearnerSubmissionListSerializer,
)
from ..services import (
    extract_submission_pages,
    prepare_submission_file,
)

from ..attempt_policy import (
    clean_up_submission_files,
    get_attempt_policy,
)

from rest_framework.permissions import IsAuthenticated

from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from ..audit import record_submission_event
from config.celery import app as celery_app
import logging

from rest_framework.authentication import SessionAuthentication
from lms.authentication import LtiSessionAuthentication


logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".zip",
}

MAX_FILE_SIZE = 50 * 1024 * 1024

class SubmissionCreateView(APIView):
    authentication_classes = [
        LtiSessionAuthentication,
        SessionAuthentication,
    ]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, context_id):
        

        context = get_object_or_404(
            SubmissionContext.objects.select_related(
                "assignment_level__assignment",
                "assignment_level__assignment__module",
                "assessment_mapping",
            ),
            id=context_id,
            learner=request.user,
            is_active=True,
        )

        mapping = context.assessment_mapping
        lms_due_date = (
            mapping.due_date
            if mapping is not None
            else None
        )

        if (
            lms_due_date is not None
            and timezone.now() > lms_due_date
        ):
            return Response(
                {
                    "detail": (
                        "The submission deadline has passed. "
                        "Please contact your instructor if "
                        "you need an extension."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        uploaded_file = request.FILES.get("submitted_file")

        if uploaded_file is None:
            return Response(
                {"detail": "Please select a file to submit."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # AssignmentLevel is the single source of truth for Basic/Advanced.
        # The frontend may still send submission_track for compatibility, but
        # it must match the level selected when the context was created.
        selected_track = context.assignment_level.level_code
        requested_track = request.data.get("submission_track")

        if requested_track and requested_track != selected_track:
            return Response(
                {
                    "detail": (
                        "The selected submission track does not match "
                        "the assignment level for this submission context."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if uploaded_file.size == 0:
            return Response(
                {
                    "detail": (
                        "The selected file is empty. "
                        "Please upload a valid file."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        extension = Path(uploaded_file.name).suffix.lower()

        if extension not in ALLOWED_EXTENSIONS:
            return Response(
                {
                    "detail": (
                        "Unsupported file type. Allowed types: "
                        + ", ".join(sorted(ALLOWED_EXTENSIONS))
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if uploaded_file.size > MAX_FILE_SIZE:
            return Response(
                {"detail": "The file cannot exceed 50 MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            grading_file, original_filename = prepare_submission_file(
                uploaded_file
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pending_submission = LearnerSubmission.objects.filter(
            learner=request.user,
            assignment_level__assignment=context.assignment_level.assignment,
            context__cohort=context.cohort,
            status__in=[
                LearnerSubmission.Status.UPLOADED,
                LearnerSubmission.Status.PROCESSING,
            ],
        ).exists()

        if pending_submission:
            return Response(
                {
                    "detail": (
                        "Your previous attempt is still being processed. "
                        "Please wait for grading to finish before "
                        "submitting another attempt."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        assignment_level = context.assignment_level
        assignment = assignment_level.assignment

        attempt_policy = get_attempt_policy(
            learner=request.user,
            cohort=context.cohort,
            assignment=assignment,
        )

        previous_attempts = LearnerSubmission.objects.filter(
            learner=request.user,
            assignment_level__assignment=context.assignment_level.assignment,
            context__cohort=context.cohort,
        ).count()


        submission = LearnerSubmission.objects.create(
            context=context,
            learner=request.user,
            assignment_level=assignment_level,
            submission_track=selected_track,
            submitted_file=grading_file,
            original_filename=original_filename,
            attempt_number=previous_attempts + 1,
            status=LearnerSubmission.Status.UPLOADED,
            maximum_score=assignment.maximum_score,
        )

        record_submission_event(
            submission,
            stage="submission",
            status="success",
            event_code="SUBMISSION_ACCEPTED",
            message="Submission attempt accepted and queued for background grading.",
            details={
                "original_filename": original_filename,
                "submission_track": selected_track,
            },
        )

        # Once the submission row exists, this is the learner's latest
        # accepted attempt. Queue grading in Celery so the HTTP request
        # does not wait for extraction/AI grading to finish.
        try:
            celery_app.send_task(
                "submissions.tasks.grade_submission_task",
                args=[str(submission.id)],
            )
        except Exception as exc:
            logger.exception(
                "Unable to queue grading for submission %s",
                submission.id,
            )
            submission.status = LearnerSubmission.Status.ERROR
            submission.save(update_fields=["status"])
            record_submission_event(
                submission,
                stage="queue",
                status="error",
                event_code="GRADING_QUEUE_ERROR",
                message="The submission was accepted but background grading could not be queued.",
                details={
                    "error_type": type(exc).__name__,
                    "error_message": str(exc),
                },
            )

        # Latest attempt is authoritative regardless of grading outcome.
        # Keep its source/generated data and remove source/generated data
        # belonging to older attempts while retaining their DB history.
        try:
            clean_up_submission_files(
                learner=request.user,
                cohort=context.cohort,
                assignment=assignment,
            )
        except Exception:
            logger.exception(
                "Unable to clean older files for submission %s",
                submission.id,
            )

        return Response(
            LearnerSubmissionSerializer(submission).data,
            status=status.HTTP_202_ACCEPTED,
        )


class SubmissionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, submission_id):
        queryset = LearnerSubmission.objects.prefetch_related(
            "pages"
        ).select_related(
            "assignment_level__assignment",
            "assignment_level__assignment__module",
            "context",
        )

        filters = {"id": submission_id}
        if not request.user.is_superuser:
            filters["learner"] = request.user

        submission = get_object_or_404(queryset, **filters)

        return Response(
            LearnerSubmissionDetailSerializer(
                submission, context={"request": request}
            ).data,
            status=status.HTTP_200_OK,
        )


class LearnerSubmissionViewSet(ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "id"
    parser_classes = (MultiPartParser, FormParser)

    def get_queryset(self):
        user = self.request.user
        queryset = LearnerSubmission.objects.select_related(
            "assignment_level__assignment__module"
        ).order_by("-submitted_at")

        if not user.is_superuser:
            queryset = queryset.filter(learner=user)

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return LearnerSubmissionListSerializer
        elif self.action in ["retrieve", "update", "partial_update"]:
            return LearnerSubmissionDetailSerializer
        return LearnerSubmissionSerializer

    def perform_create(self, serializer):
        uploaded_file = self.request.FILES.get("submitted_file")
        original_name = uploaded_file.name if uploaded_file else ""

        submission = serializer.save(
            learner=self.request.user,
            original_filename=original_name,
        )

        extract_submission_pages(submission)

