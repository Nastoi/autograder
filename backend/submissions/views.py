from pathlib import Path

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from .models import LearnerSubmission, SubmissionContext, SubmissionPage
from .serializers import (
    LearnerSubmissionSerializer,
    LearnerSubmissionDetailSerializer,
    LearnerSubmissionListSerializer,
    SubmissionContextSerializer,
)
from .services import extract_submission_pages, run_ai_grading

ALLOWED_EXTENSIONS = {
    ".doc",
    ".docx",
    ".pdf",
    ".pbix",
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
                "assignment_level",
                "assignment_level__assignment",
            ),
            id=context_id,
            learner=request.user,
            is_active=True,
        )

        assignment = context.assignment_level.assignment
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
                    "code": module.code,
                    "name": module.module_name,
                },
                "assignment": {
                    "id": assignment.id,
                    "code": assignment.assignment_code,
                    "title": assignment.title,
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
        if get_learner_role(request.user) != "learner":
            return Response(
                {"detail": "Only learner accounts can submit assignments."},
                status=status.HTTP_403_FORBIDDEN,
            )

        context = get_object_or_404(
            SubmissionContext.objects.select_related(
                "assignment_level",
                "assignment_level__assignment",
            ),
            id=context_id,
            learner=request.user,
            is_active=True,
        )

        uploaded_file = request.FILES.get("submitted_file")

        submission_track = request.data.get("submission_track")

        valid_tracks = {
            LearnerSubmission.SubmissionTrack.BASIC,
            LearnerSubmission.SubmissionTrack.ADVANCED,
        }

        if submission_track not in valid_tracks:
            return Response(
                {
                    "detail": (
                        "Please select a valid submission track: "
                        "basic or advanced."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if uploaded_file is None:
            return Response(
                {"detail": "Please select a file."},
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

        previous_attempts = LearnerSubmission.objects.filter(
            learner=request.user,
            context=context,
        ).count()

        assignment = context.assignment_level.assignment

        submission = LearnerSubmission.objects.create(
            context=context,
            learner=request.user,
            assignment_level=context.assignment_level,
            submitted_file=uploaded_file,
            original_filename=uploaded_file.name,
            attempt_number=previous_attempts + 1,
            status=LearnerSubmission.Status.UPLOADED,
            maximum_score=assignment.maximum_score,
        )


        submission = run_ai_grading(submission)

        return Response(
            LearnerSubmissionSerializer(submission).data,
            status=status.HTTP_201_CREATED,
        )


class SubmissionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, submission_id):
        queryset = LearnerSubmission.objects.prefetch_related(
            "pages"
        ).select_related(
            "assignment_level",
            "assignment_level__assignment",
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