from django.urls import path

from .views import (
    CsrfTokenView,
    CurrentUserView,
    LoginView,
    LogoutView,
)

app_name = "accounts"

urlpatterns = [
    path("csrf/", CsrfTokenView.as_view(), name="csrf"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", CurrentUserView.as_view(), name="me"),
]