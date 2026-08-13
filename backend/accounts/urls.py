from django.urls import path

from .views import (
    CurrentUserView,
    LoginView,
    LogoutView,
    LearnerRegisterView,
    LearnerListView,
    CsrfTokenView,
)

app_name = "accounts"

urlpatterns = [
    path("learners/", LearnerListView.as_view(), name="learner-list"),
    path("register/", LearnerRegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", CurrentUserView.as_view(), name="me"),
    path("csrf/", CsrfTokenView.as_view(), name="csrf"),
]
