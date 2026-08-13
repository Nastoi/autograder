from django.urls import path

from .views import (
    AssessmentMappingDetailView,
    AssessmentMappingListCreateView,
    AssessmentMappingSubmissionView,
    LtiLoginView,
    LtiLaunchView,
    AssessmentMappingLtiRegistrationView,
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
        "assessment-mappings/<uuid:mapping_id>/lti-registration/",
        AssessmentMappingLtiRegistrationView.as_view(),
        name="assessment-mapping-lti-registration",
    ),
    path(
        "lti/login/",
        LtiLoginView.as_view(),
        name="lti-login",
    ),
    path(
        "lti/launch/",
        LtiLaunchView.as_view(),
        name="lti-launch-debug",
    ),
    path(
        "lti/launch/<uuid:mapping_id>/",
        LtiLaunchView.as_view(),
        name="lti-launch",
    ),
]