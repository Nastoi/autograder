from django.contrib.auth import authenticate, get_user_model, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from ..models import UserProfile
from ..serializers import (
    ChangePasswordSerializer,
    CurrentUserSerializer,
    LoginSerializer,
)

User = get_user_model()


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

class CsrfTokenView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({
            "csrfToken": get_token(request),
        })


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        user = request.user

        current_password = serializer.validated_data[
            "current_password"
        ]
        new_password = serializer.validated_data[
            "new_password"
        ]

        if not user.check_password(current_password):
            return Response(
                {
                    "detail": (
                        "Current password is incorrect."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])

        profile, _ = UserProfile.objects.get_or_create(
            user=user,
        )

        profile.must_change_password = False
        profile.save(
            update_fields=[
                "must_change_password",
                "updated_at",
            ]
        )

        # Password change invalidates the existing session.
        login(request, user)

        return Response(
            {
                "message": "Password changed successfully.",
                "user": CurrentUserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )
