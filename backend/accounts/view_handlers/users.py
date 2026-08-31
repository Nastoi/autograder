from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
import secrets
from django.shortcuts import get_object_or_404
from ..models import UserProfile
from ..permissions import (
    CanAccessUserManagement,
    CanCreateManagedUsers,
    CanResetManagedPasswords,
    CanToggleManagedUsers,
    IsSuperUserOrStaff,
)
from ..serializers import (
    LearnerListSerializer,
    ManagedUserCreateSerializer,
    ManagedUserPermissionSerializer,
    ManagedUserSerializer,
)

User = get_user_model()



class ManagedUserListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [CanCreateManagedUsers()]
        return [CanAccessUserManagement()]

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





class ManagedUserResetPasswordView(APIView):
    permission_classes = [CanResetManagedPasswords]

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


class ManagedUserToggleActiveView(APIView):
    permission_classes = [CanToggleManagedUsers]

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

class ManagedUserPermissionsView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, user_id):
        if not request.user.is_superuser:
            return Response(
                {"detail": "Only a superuser can change portal permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = get_object_or_404(User, id=user_id)
        if user.is_superuser:
            return Response(
                {"detail": "Superusers already have all portal permissions."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ManagedUserPermissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        profile, _ = UserProfile.objects.get_or_create(user=user)
        for field_name, value in serializer.validated_data.items():
            setattr(profile, field_name, value)

        # Child User Management permissions are meaningless without page access.
        if not profile.can_access_user_management:
            profile.can_create_users = False
            profile.can_reset_passwords = False
            profile.can_toggle_users = False

        profile.save(
            update_fields=[
                "can_access_user_management",
                "can_create_users",
                "can_reset_passwords",
                "can_toggle_users",
                "can_view_logs",
                "updated_at",
            ]
        )

        return Response(ManagedUserSerializer(user).data, status=status.HTTP_200_OK)
