from django.urls import path

from .views import (
    AssessmentMappingDetailView,
    AssessmentMappingListCreateView,
    AssessmentMappingSubmissionView,
    RequestDebugView,
    LtiLoginDebugView,
    LtiLaunchDebugView,
)


urlpatterns = [
    path(
        "assessment-mappings/",
        AssessmentMappingListCreateView.as_view(),
        name="assessment-mapping-list-create",
    ),
    path(
        "assessment-mappings/<uuid:mapping_id>/",
        AssessmentMappingDetailView.as_view(),
        name="assessment-mapping-detail",
    ),
    path(
        "assessment-mappings/<uuid:mapping_id>/submission/",
        AssessmentMappingSubmissionView.as_view(),
        name="assessment-mapping-submission",
    ),
    path(
        "debug/request/",
        RequestDebugView.as_view(),
        name="request-debug",
    ),
    path(
        "lti/login/",
        LtiLoginDebugView.as_view(),
        name="lti-login-debug",
    ),
    path(
        "lti/launch/",
        LtiLaunchDebugView.as_view(),
        name="lti-launch-debug",
    ),
]