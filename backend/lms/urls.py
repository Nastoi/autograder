from django.urls import path

from .jwks import LtiJwksView

from .views import (
    AssessmentMappingDetailView,
    AssessmentMappingListCreateView,
    AssessmentMappingSubmissionView,
    LtiLoginView,
    LtiLaunchView,
    InstructorMappingDashboardView,
    InstructorSubmissionDownloadView,
    InstructorSubmissionOverrideView,
)


urlpatterns = [
    path(
        "lti/jwks/",
        LtiJwksView.as_view(),
        name="lti-jwks",
    ),
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
    path(
        "assessment-mappings/<uuid:mapping_id>/instructor/",
        InstructorMappingDashboardView.as_view(),
        name="assessment-mapping-instructor",
    ),
    path(
        "assessment-mappings/<uuid:mapping_id>/instructor/submissions/<uuid:submission_id>/download/",
        InstructorSubmissionDownloadView.as_view(),
        name="assessment-mapping-instructor-submission-download",
    ),
    path(
        "assessment-mappings/<uuid:mapping_id>/instructor/submissions/<uuid:submission_id>/override/",
        InstructorSubmissionOverrideView.as_view(),
        name="assessment-mapping-instructor-submission-override",
    ),

]