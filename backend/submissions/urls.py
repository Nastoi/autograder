from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    LearnerSubmissionViewSet,
    PageImageView,
    SubmissionContextView,
    SubmissionCreateView,
    SubmissionDetailView,
)

app_name = "submissions"

router = DefaultRouter()
router.register(r"", LearnerSubmissionViewSet, basename="learner-submission")

urlpatterns = [
    # 1. Explicit static routes (always place first)
    path(
        "pages/<uuid:page_id>/image/",
        PageImageView.as_view(),
        name="page-image",
    ),
    path(
        "context/",
        SubmissionContextView.as_view(), 
        name="submission-context"
    ),
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

    # 2. Router Fallback (POST / and ViewSet actions like /<pk>/grade/)
    path("", include(router.urls)),
]