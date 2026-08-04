from django.urls import path

from .views import (
    AssignmentLevelListView,
    CohortListView,
    QualificationListCreateView,
)


urlpatterns = [
    path(
        "cohorts/",
        CohortListView.as_view(),
        name="cohort-list",
    ),
    path(
        "assignment-levels/",
        AssignmentLevelListView.as_view(),
        name="assignment-level-list",
    ),
    path(
    "qualifications/",
    QualificationListCreateView.as_view(),
    name="qualification-list-create",
),
]