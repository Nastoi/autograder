import json
from datetime import timedelta
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.generics import CreateAPIView, ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
import secrets
from django.shortcuts import get_object_or_404
from .models import UserProfile
from .permissions import (
    CanAccessUserManagement,
    CanCreateManagedUsers,
    CanResetManagedPasswords,
    CanToggleManagedUsers,
    CanViewPortalLogs,
    IsSuperUserOrStaff,
)
from .serializers import (
    ChangePasswordSerializer,
    CurrentUserSerializer,
    LearnerListSerializer,
    LearnerRegisterSerializer,
    LoginSerializer,
    ManagedUserCreateSerializer,
    ManagedUserPermissionSerializer,
    ManagedUserSerializer,
    PortalActivitySerializer,
)
from .models import PortalActivity
from submissions.models import SubmissionProcessLog

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


class CsrfTokenView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({
            "csrfToken": get_token(request),
        })


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


class PortalLogView(APIView):
    permission_classes = [CanViewPortalLogs]

    LOG_FILES = {
        "backend": "backend.log",
        "celery": "celery.log",
        "errors": "error.log",
    }

    def _grading_logs(self, request, lines):
        base_queryset = SubmissionProcessLog.objects.all()

        filter_options = {
            "cohorts": list(
                base_queryset.order_by("cohort_code")
                .values_list("cohort_code", flat=True)
                .distinct()
            ),
            "assignments": list(
                base_queryset.order_by("assignment_code")
                .values_list("assignment_code", flat=True)
                .distinct()
            ),
            "learners": list(
                base_queryset.exclude(learner_email="")
                .order_by("learner_email")
                .values_list("learner_email", flat=True)
                .distinct()
            ),
            "attempts": list(
                base_queryset.order_by("attempt_number")
                .values_list("attempt_number", flat=True)
                .distinct()
            ),
            "stages": list(
                base_queryset.order_by("stage")
                .values_list("stage", flat=True)
                .distinct()
            ),
            "statuses": list(
                base_queryset.order_by("status")
                .values_list("status", flat=True)
                .distinct()
            ),
        }

        queryset = base_queryset
        cohort = request.query_params.get("cohort")
        assignment = request.query_params.get("assignment")
        learner = request.query_params.get("learner")
        attempt = request.query_params.get("attempt")
        stage = request.query_params.get("stage")
        event_status = request.query_params.get("status")

        if cohort:
            queryset = queryset.filter(cohort_code=cohort)
        if assignment:
            queryset = queryset.filter(assignment_code=assignment)
        if learner:
            queryset = queryset.filter(learner_email=learner)
        if attempt:
            try:
                queryset = queryset.filter(attempt_number=int(attempt))
            except ValueError:
                return Response(
                    {"detail": "Attempt must be a number."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if stage:
            queryset = queryset.filter(stage=stage)
        if event_status:
            queryset = queryset.filter(status=event_status)

        entries = list(queryset.order_by("-created_at")[:lines])
        entries.reverse()

        formatted_lines = []
        for entry in entries:
            timestamp = timezone.localtime(
                entry.created_at
            ).isoformat(timespec="seconds")

            parts = [
                timestamp,
                f"cohort={entry.cohort_code}",
                f"assignment={entry.assignment_code}",
                (
                    f"learner={entry.learner_email}"
                    if entry.learner_email
                    else f"learner={entry.learner_username}"
                ),
                f"attempt={entry.attempt_number}",
                f"submission={entry.submission_id}",
                f"stage={entry.stage}",
                f"status={entry.status}",
            ]

            if entry.event_code:
                parts.append(f"code={entry.event_code}")
            if entry.message:
                parts.append(f"message={entry.message}")
            if entry.details:
                parts.append(
                    "details="
                    + json.dumps(
                        entry.details,
                        ensure_ascii=False,
                        default=str,
                    )
                )

            formatted_lines.append(" | ".join(parts))

        return Response(
            {
                "source": "grading",
                "lines": formatted_lines,
                "grading_filters": filter_options,
                "message": (
                    None
                    if formatted_lines
                    else "No grading-attempt log entries match the current filters."
                ),
            },
            status=status.HTTP_200_OK,
        )

    def get(self, request):
        source = request.query_params.get("source", "backend")

        try:
            lines = int(request.query_params.get("lines", "200"))
        except ValueError:
            lines = 200
        lines = max(1, min(lines, 1000))

        if source == "grading":
            return self._grading_logs(request, lines)

        if source not in self.LOG_FILES:
            return Response(
                {"detail": "Invalid log source."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.conf import settings

        log_path = settings.LOG_DIR / self.LOG_FILES[source]
        if not log_path.exists():
            return Response(
                {
                    "source": source,
                    "lines": [],
                    "message": "No log entries yet.",
                },
                status=status.HTTP_200_OK,
            )

        with log_path.open(
            "r",
            encoding="utf-8",
            errors="replace",
        ) as handle:
            content = handle.readlines()[-lines:]

        return Response(
            {
                "source": source,
                "lines": [
                    line.rstrip("\n")
                    for line in content
                ],
            },
            status=status.HTTP_200_OK,
        )
