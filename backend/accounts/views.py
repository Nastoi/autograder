from datetime import timedelta
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.generics import CreateAPIView, ListAPIView
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import secrets
from django.shortcuts import get_object_or_404
from .models import UserProfile
from .permissions import IsSuperUserOrStaff
from .serializers import (
    ChangePasswordSerializer,
    CurrentUserSerializer,
    LearnerListSerializer,
    LearnerRegisterSerializer,
    LoginSerializer,
    ManagedUserCreateSerializer,
    ManagedUserSerializer,
    PortalActivitySerializer,
)
from .models import PortalActivity

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


class ManagedUserListCreateView(APIView):
    permission_classes = [IsSuperUserOrStaff]

    def get(self, request):
        users = (
        User.objects
        .filter(
            profile__role__in=[
                UserProfile.Role.SYSTEM_ADMIN,
                UserProfile.Role.MAPPING_ADMIN,
                UserProfile.Role.FACULTY,
            ]
        )
        .select_related("profile")
        .order_by("username")
    )

        return Response(
            ManagedUserSerializer(
                users,
                many=True,
            ).data
        )

    def post(self, request):
        serializer = ManagedUserCreateSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        temporary_password = secrets.token_urlsafe(12)

        user = User.objects.create_user(
            username=serializer.validated_data["username"],
            email=serializer.validated_data.get("email", ""),
            first_name=serializer.validated_data.get(
                "first_name",
                "",
            ),
            last_name=serializer.validated_data.get(
                "last_name",
                "",
            ),
            password=temporary_password,
        )

        UserProfile.objects.create(
            user=user,
            role=UserProfile.Role.MAPPING_ADMIN,
            must_change_password=True,
        )

        return Response(
            {
                "user": ManagedUserSerializer(user).data,
                "temporary_password": temporary_password,
            },
            status=status.HTTP_201_CREATED,
        )


class CsrfTokenView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({
            "csrfToken": get_token(request),
        })


class ManagedUserResetPasswordView(APIView):
    permission_classes = [IsSuperUserOrStaff]

    def post(self, request, user_id):
        user = get_object_or_404(
            User,
            id=user_id,
        )

        temporary_password = secrets.token_urlsafe(12)

        user.set_password(temporary_password)
        user.save(update_fields=["password"])

        profile, _ = UserProfile.objects.get_or_create(
            user=user,
        )

        profile.must_change_password = True
        profile.save(
            update_fields=[
                "must_change_password",
                "updated_at",
            ]
        )

        return Response(
            {
                "temporary_password": temporary_password,
            },
            status=status.HTTP_200_OK,
        )


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


class PortalActivityListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        object_type = request.query_params.get("object_type")
        object_id = request.query_params.get("object_id")

        if not object_type or not object_id:
            return Response(
                {
                    "detail": (
                        "object_type and object_id are required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Opportunistic 30-day cleanup for deleted-object audit history.
        cutoff = timezone.now() - timedelta(days=30)
        PortalActivity.objects.filter(
            action=PortalActivity.Action.DELETED,
            created_at__lt=cutoff,
        ).delete()

        activities = (
            PortalActivity.objects
            .filter(
                object_type=object_type,
                object_id=str(object_id),
            )
            .select_related("user")
            .order_by("-created_at")
        )

        return Response(
            PortalActivitySerializer(
                activities,
                many=True,
            ).data
        )


class PortalDeletedActivityListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cutoff = timezone.now() - timedelta(days=30)

        PortalActivity.objects.filter(
            action=PortalActivity.Action.DELETED,
            created_at__lt=cutoff,
        ).delete()

        activities = (
            PortalActivity.objects
            .filter(
                action=PortalActivity.Action.DELETED,
                created_at__gte=cutoff,
            )
            .select_related("user")
            .order_by("-created_at")
        )

        return Response(
            PortalActivitySerializer(
                activities,
                many=True,
            ).data
        )


class ManagedUserToggleActiveView(APIView):
    permission_classes = [IsSuperUserOrStaff]

    def post(self, request, user_id):
        user = get_object_or_404(
            User,
            id=user_id,
        )

        if user.id == request.user.id:
            return Response(
                {
                    "detail": (
                        "You cannot disable your own account."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = not user.is_active

        user.save(
            update_fields=["is_active"],
        )

        return Response(
            ManagedUserSerializer(user).data,
            status=status.HTTP_200_OK,
        )