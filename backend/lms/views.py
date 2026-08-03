from django.shortcuts import render

# Create your views here.
from rest_framework import generics

from .models import AssessmentMapping
from .permissions import IsMappingAdmin
from .serializers import AssessmentMappingSerializer


class AssessmentMappingListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = AssessmentMappingSerializer
    permission_classes = [IsMappingAdmin]

    def get_queryset(self):
        return (
            AssessmentMapping.objects
            .select_related(
                "cohort",
                "cohort__module",
                "assignment_level",
                "assignment_level__assignment",
            )
            .order_by("name")
        )

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

from rest_framework import status
from rest_framework.response import Response


class AssessmentMappingDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = AssessmentMappingSerializer
    permission_classes = [IsMappingAdmin]
    lookup_url_kwarg = "mapping_id"

    def get_queryset(self):
        return (
            AssessmentMapping.objects
            .select_related(
                "cohort",
                "cohort__module",
                "assignment_level",
                "assignment_level__assignment",
            )
        )

    def perform_update(self, serializer):
        serializer.save(
            updated_by=self.request.user,
        )

    def destroy(self, request, *args, **kwargs):
        mapping = self.get_object()

        has_submissions = mapping.submission_contexts.filter(
            submissions__isnull=False,
        ).exists()

        if has_submissions:
            return Response(
                {
                    "detail": (
                        "This mapping cannot be deleted because "
                        "one or more submissions are linked to it. "
                        "Deactivate it instead."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        return super().destroy(
            request,
            *args,
            **kwargs,
        )