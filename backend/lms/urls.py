from django.urls import path

from .views import (
    AssessmentMappingDetailView,
    AssessmentMappingListCreateView,
    AssessmentMappingSubmissionView,
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
]