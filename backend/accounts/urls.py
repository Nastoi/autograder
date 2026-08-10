from django.urls import path

from .views import (
    CurrentUserView,
    LoginView,
    LogoutView,
    LearnerRegisterView,
    LearnerListView,
)

app_name = "accounts"

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('register/', LearnerRegisterView.as_view(), name='register'),
    path('current-user/', CurrentUserView.as_view(), name='current-user'),
    path('learners/', LearnerListView.as_view(), name='learners'),
]
