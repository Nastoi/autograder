from django.contrib.auth import authenticate, get_user_model, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.generics import CreateAPIView, ListAPIView
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import UserProfile
from .permissions import IsSuperUserOrStaff
from .serializers import (
    CurrentUserSerializer,
    LearnerListSerializer,
    LearnerRegisterSerializer,
    LoginSerializer,
)

User = get_user_model()


class LearnerListView(ListAPIView):
    permission_classes = [IsSuperUserOrStaff]
    serializer_class = LearnerListSerializer

    def get_queryset(self):
        # Filter users who have the LEARNER role on their profile
        return (
            User.objects.filter(profile__role=UserProfile.Role.LEARNER)
            .select_related("profile")
            .order_by("-id")
        )


class LearnerRegisterView(CreateAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = LearnerRegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                "message": "Learner registered successfully.",
                "user": CurrentUserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


@method_decorator(ensure_csrf_cookie, name="dispatch")
class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data["username"]
        password = serializer.validated_data["password"]

        user = authenticate(
            request=request,
            username=username,
            password=password,
        )

        if user is None:
            return Response(
                {"detail": "Invalid username or password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.is_active:
            return Response(
                {"detail": "This account is inactive."},
                status=status.HTTP_403_FORBIDDEN,
            )

        login(request, user)
        csrf_token = get_token(request)

        response = Response(
            {
                "message": "Login successful.",
                "csrfToken": csrf_token,
                "user": CurrentUserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )

        response.set_cookie(
            "csrftoken",
            csrf_token,
            httponly=False,
            samesite="Lax",
        )
        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(
            {"message": "Logout successful."},
            status=status.HTTP_200_OK,
        )


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)