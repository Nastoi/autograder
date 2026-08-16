from django.urls import path

from .views import (
    ChangePasswordView,
    CurrentUserView,
    CsrfTokenView,
    LearnerListView,
    LoginView,
    LogoutView,
    ManagedUserListCreateView,
    ManagedUserResetPasswordView,
    PortalActivityListView,
    PortalDeletedActivityListView,
    ManagedUserToggleActiveView,
)

app_name = "accounts"

urlpatterns = [
    path("learners/", LearnerListView.as_view(), name="learner-list"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", CurrentUserView.as_view(), name="me"),
    path("csrf/", CsrfTokenView.as_view(), name="csrf"),
    path(
        "users/",
        ManagedUserListCreateView.as_view(),
        name="managed-users",
    ),
    path(
        "users/<int:user_id>/reset-password/",
        ManagedUserResetPasswordView.as_view(),
        name="managed-user-reset-password",
    ),
    path(
        "change-password/",
        ChangePasswordView.as_view(),
        name="change-password",
    ),
    path(
        "activity/",
        PortalActivityListView.as_view(),
        name="portal-activity",
    ),
    path(
        "activity/deleted/",
        PortalDeletedActivityListView.as_view(),
        name="portal-deleted-activity",
    ),

    path(
        "users/<int:user_id>/toggle-active/",
        ManagedUserToggleActiveView.as_view(),
        name="managed-user-toggle-active",
    ),
]
