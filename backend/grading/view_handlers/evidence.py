
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from lms.permissions import IsMappingAdmin



from ..models import (
    ExtractedEvidence,
)

from ..serializers import (
    ExtractedEvidenceSerializer,
)

class ExtractedEvidenceListCreateView(generics.ListCreateAPIView):
    serializer_class = ExtractedEvidenceSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = ExtractedEvidence.objects.select_related(
            "submission",
        ).order_by("page_number", "created_at")

        submission_id = self.request.query_params.get("submission_id")
        page_number = self.request.query_params.get("page_number")

        if submission_id:
            queryset = queryset.filter(submission_id=submission_id)

        if page_number:
            queryset = queryset.filter(page_number=page_number)

        return queryset

class ExtractedEvidenceDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = ExtractedEvidenceSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return ExtractedEvidence.objects.select_related(
            "submission",
        ).order_by("created_at")


