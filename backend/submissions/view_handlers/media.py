from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView

from ..models import SubmissionPage


class PageImageView(APIView):
    """Serve the stored image for a submission page."""

    def get(self, request, page_id):
        page = get_object_or_404(
            SubmissionPage,
            id=page_id,
        )

        if not page.image_data:
            return HttpResponse(status=404)

        return HttpResponse(
            page.image_data,
            content_type=page.image_mime_type,
        )