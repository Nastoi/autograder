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
                    "assignment",
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
                "assignment",
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

from rest_framework.permissions import AllowAny


class AssessmentMappingSubmissionView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    lookup_url_kwarg = "mapping_id"

    def get_queryset(self):
        return (
            AssessmentMapping.objects
            .select_related(
                "cohort",
                "cohort__module",
                "assignment",
            )
            .filter(is_active=True)
        )

    def retrieve(self, request, *args, **kwargs):
        mapping = self.get_object()

        return Response(
            {
                "mapping_id": str(mapping.id),
                "cohort": {
                    "id": mapping.cohort.id,
                    "code": mapping.cohort.cohort_code,
                    "name": mapping.cohort.cohort_name,
                },
                "assignment": {
                    "id": str(mapping.assignment.id),
                    "code": mapping.assignment.code,
                    "title": mapping.assignment.title,
                    "maximum_score": str(
                        mapping.assignment.maximum_score
                    ),
                },
            }
        )

    from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class RequestDebugView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "authenticated": request.user.is_authenticated,
            "user": {
                "id": getattr(request.user, "id", None),
                "username": getattr(request.user, "username", None),
                "email": getattr(request.user, "email", None),
            },
            "query_params": dict(request.query_params),
            "headers": {
                "referer": request.headers.get("Referer"),
                "origin": request.headers.get("Origin"),
                "user_agent": request.headers.get("User-Agent"),
            },
        })


class LtiLoginDebugView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "method": "GET",
            "query_params": dict(request.query_params),
        })

    def post(self, request):
        return Response({
            "method": "POST",
            "data": dict(request.data),
        })

class LtiLaunchDebugView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "method": "GET",
            "query_params": dict(request.query_params),
        })

    def post(self, request):
        return Response({
            "method": "POST",
            "data": dict(request.data),
        })