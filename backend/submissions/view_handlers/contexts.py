
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from ..serializers import (
    SubmissionContextSerializer,
)
from ..models import SubmissionContext
from lms.models import AssessmentMapping
from courses.models import AssignmentLevel

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
