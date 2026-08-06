from pathlib import Path

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LearnerSubmission, SubmissionContext
from .serializers import LearnerSubmissionSerializer
from .services import run_mock_grading


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
                    "name": request.user.get_full_name()
                    or request.user.username,
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
                    "name": module.name,
                },
                "assignment": {
                    "id": assignment.id,
                    "code": assignment.code,
                    "title": assignment.title,
                    "maximum_score": assignment.maximum_score,
                },
                "assignment_level": {
                    "id": context.assignment_level.id,
                    "level_code": context.assignment_level.level_code,
                    "display_name": (
                        context.assignment_level.display_name
                    ),
                },
            }
        )


class SubmissionCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, context_id):
        if get_learner_role(request.user) != "learner":
            return Response(
                {
                    "detail": (
                        "Only learner accounts can submit assignments."
                    )
                },
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

        submission = run_mock_grading(submission)

        return Response(
            LearnerSubmissionSerializer(submission).data,
            status=status.HTTP_201_CREATED,
        )


class SubmissionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, submission_id):
        submission = get_object_or_404(
            LearnerSubmission.objects.select_related(
                "assignment_level",
                "assignment_level__assignment",
            ),
            id=submission_id,
            learner=request.user,
        )

        return Response(
            LearnerSubmissionSerializer(submission).data
        )