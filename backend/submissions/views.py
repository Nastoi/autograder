from pathlib import Path

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from .tasks import grade_submission_task
from .models import LearnerSubmission, SubmissionContext, SubmissionPage
from .serializers import (
    LearnerSubmissionSerializer,
    LearnerSubmissionDetailSerializer,
    LearnerSubmissionListSerializer,
    SubmissionContextSerializer,
)
from .services import (
    extract_submission_pages,
    run_ai_grading,
    prepare_submission_file,
)
from .attempt_policy import (
    clean_up_submission_files,
    get_attempt_policy,
)
from lms.models import AssessmentMapping
from courses.models import AssignmentLevel
from .services import (
    extract_submission_pages,
    run_ai_grading,
    prepare_submission_file,
)
import logging

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {
    # ".doc",
    # ".docx",
    ".pdf",
    # ".pbix",
    ".zip",
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def get_learner_role(user) -> str | None:
    try:
        return user.profile.role
    except AttributeError:
        return None


class SubmissionContextView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        serializer = SubmissionContextSerializer(data=request.data)

        if serializer.is_valid():
            # Automatically assign authenticated user as the learner
            context = serializer.save(learner=request.user)

            assignment = context.assignment_level.assignment
            module = assignment.module

            return Response(
                {
                    "message": "Submission context created successfully.",
                    "context_id": context.id,
                    "learner": {
                        "id": request.user.id,
                        "username": request.user.username,
                        "name": request.user.get_full_name() or request.user.username,
                        "email": request.user.email,
                    },
                    "cohort": {
                        "id": context.cohort.id,
                        "code": context.cohort.cohort_code,
                        "name": context.cohort.cohort_name,
                    },
                    "module": {
                        "id": module.id,
                        "code": module.module_code,
                        "name": module.module_name,
                    },
                    "assignment": {
                        "id": assignment.id,
                        "code": assignment.assignment_code,
                        "title": assignment.assignment_title,
                        "maximum_score": assignment.maximum_score,
                    },
                    "assignment_level": {
                        "id": context.assignment_level.id,
                        "level_code": context.assignment_level.level_code,
                        "display_name": context.assignment_level.display_name,
                    },
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request, context_id):
        context = get_object_or_404(
            SubmissionContext.objects.select_related(
                "learner",
                "cohort",
                "cohort__module",
                "assignment_level__assignment",
                "assignment_level__assignment__module",
            ),
            id=context_id,
            learner=request.user,
            is_active=True,
        )

        assignment_level = context.assignment_level
        assignment = assignment_level.assignment
        module = assignment.module

        return Response(
            {
                "context_id": context.id,
                "learner": {
                    "id": request.user.id,
                    "username": request.user.username,
                    "name": request.user.get_full_name() or request.user.username,
                    "email": request.user.email,
                },
                "cohort": {
                    "id": context.cohort.id,
                    "code": context.cohort.cohort_code,
                    "name": context.cohort.cohort_name,
                },
                "module": {
                    "id": module.id,
                    "code": module.module_code,
                    "name": module.module_name,
                },
                "assignment": {
                    "id": assignment.id,
                    "code": assignment.assignment_code,
                    "title": assignment.assignment_title,
                    "maximum_score": assignment.maximum_score,
                },
                "assignment_level": {
                    "id": context.assignment_level.id,
                    "level_code": context.assignment_level.level_code,
                    "display_name": context.assignment_level.display_name,
                },
            },
            status=status.HTTP_200_OK,
        )


class SubmissionCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, context_id):
        

        context = get_object_or_404(
            SubmissionContext.objects.select_related(
                "assignment_level__assignment",
                "assignment_level__assignment__module", 
            ),
            id=context_id,
            learner=request.user,
            is_active=True,
        )

        mapping = context.assessment_mapping

        if (
            mapping is not None
            and mapping.due_date is not None
            and timezone.now() > mapping.due_date
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

        # if not attempt_policy.can_submit:
        #     return Response(
        #         {
        #             "detail": (
        #                 "You have used all 3 attempts available "
        #                 "after achieving your first passing grade."
        #             ),
        #             "attempt_policy": {
        #                 "limited_mode": True,
        #                 "attempts_used": (
        #                     attempt_policy.attempts_used
        #                 ),
        #                 "attempts_remaining": 0,
        #                 "first_pass_attempt": (
        #                     attempt_policy.first_pass_attempt
        #                 ),
        #                 "best_score": (
        #                     str(attempt_policy.best_score)
        #                     if attempt_policy.best_score is not None
        #                     else None
        #                 ),
        #             },
        #         },
        #         status=status.HTTP_409_CONFLICT,
        #     )

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

        # Once the submission row exists, this is the learner's latest
        # accepted attempt. Queue grading in Celery so the HTTP request
        # does not wait for extraction/AI grading to finish.
        try:
            grade_submission_task.delay(
                str(submission.id)
            )
        except Exception:
            logger.exception(
                "Unable to queue grading for submission %s",
                submission.id,
            )
            submission.status = LearnerSubmission.Status.ERROR
            submission.save(
                update_fields=["status"]
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


class PageImageView(APIView):
    """Serves the binary WebP image stored in Postgres."""

    def get(self, request, page_id):
        page = get_object_or_404(SubmissionPage, id=page_id)
        if not page.image_data:
            return HttpResponse(status=404)

        return HttpResponse(
            page.image_data, 
            content_type=page.image_mime_type
        )


class MappingSubmissionContextView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, mapping_id):
        assignment_level_id = request.data.get(
            "assignment_level"
        )

        if not assignment_level_id:
            return Response(
                {
                    "detail": (
                        "assignment_level is required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        mapping = get_object_or_404(
            AssessmentMapping.objects.select_related(
                "cohort",
                "cohort__module",
                "assignment",
            ),
            id=mapping_id,
            is_active=True,
        )

        assignment_level = get_object_or_404(
            AssignmentLevel,
            id=assignment_level_id,
            assignment=mapping.assignment,
            is_active=True,
        )

        context, _ = SubmissionContext.objects.get_or_create(
            learner=request.user,
            cohort=mapping.cohort,
            assignment_level=assignment_level,
            assessment_mapping=mapping,
            defaults={
                "is_active": True,
            },
        )

        if not context.is_active:
            context.is_active = True
            context.save(
                update_fields=[
                    "is_active",
                    "updated_at",
                ]
            )

        return Response(
            {
                "context_id": str(context.id),
                "mapping_id": str(mapping.id),

                "learner": {
                    "id": request.user.id,
                    "username": request.user.username,
                    "name": (
                        request.user.get_full_name()
                        or request.user.username
                    ),
                    "email": request.user.email,
                },

                "cohort": {
                    "id": str(mapping.cohort.id),
                    "code": mapping.cohort.cohort_code,
                    "name": mapping.cohort.cohort_name,
                },

                "assignment": {
                    "id": str(mapping.assignment.id),
                    "code": (
                        mapping.assignment.assignment_code
                    ),
                    "title": (
                        mapping.assignment.assignment_title
                    ),
                    "maximum_score": str(
                        mapping.assignment.maximum_score
                    ),
                },

                "assignment_level": {
                    "id": str(assignment_level.id),
                    "level_code": (
                        assignment_level.level_code
                    ),
                    "display_name": (
                        assignment_level.display_name
                    ),
                },
            },
            status=status.HTTP_200_OK,
        )


class MappingSubmissionHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, mapping_id):
        mapping = get_object_or_404(
            AssessmentMapping.objects.select_related(
                "cohort",
                "assignment",
            ),
            id=mapping_id,
            is_active=True,
        )

        submissions = (
            LearnerSubmission.objects
            .filter(
                learner=request.user,
                assignment_level__assignment=mapping.assignment,
                context__cohort=mapping.cohort,
            )
            .select_related(
                "assignment_level",
                "assignment_level__assignment",
                "context",
            )
            .order_by("-attempt_number")
        )

        attempt_policy = get_attempt_policy(
            learner=request.user,
            cohort=mapping.cohort,
            assignment=mapping.assignment,
        )

        return Response(
            {
                "submissions": LearnerSubmissionSerializer(
                    submissions,
                    many=True,
                ).data,
                "attempt_policy": {
                    "can_submit": attempt_policy.can_submit,
                    "limited_mode": attempt_policy.limited_mode,
                    "attempts_used": attempt_policy.attempts_used,
                    "attempts_remaining": attempt_policy.attempts_remaining,
                    "first_pass_attempt": attempt_policy.first_pass_attempt,
                    "best_score": (
                        str(attempt_policy.best_score)
                        if attempt_policy.best_score is not None
                        else None
                    ),
                },
            }
        )