from django.urls import path

from .views import (
    SubmissionContextView,
    SubmissionCreateView,
    SubmissionDetailView,
)

app_name = "submissions"

urlpatterns = [
    path(
        "context/<uuid:context_id>/",
        SubmissionContextView.as_view(),
        name="context",
    ),
    path(
        "context/<uuid:context_id>/submit/",
        SubmissionCreateView.as_view(),
        name="create",
    ),
    path(
        "<uuid:submission_id>/",
        SubmissionDetailView.as_view(),
        name="detail",
    ),
]