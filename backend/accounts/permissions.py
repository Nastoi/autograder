from rest_framework.permissions import BasePermission


def _has_profile_permission(user, field_name: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    profile = getattr(user, "profile", None)
    return bool(profile and getattr(profile, field_name, False))


class IsSuperUserOrStaff(BasePermission):
    """Legacy helper retained for existing endpoints."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_superuser or request.user.is_staff)
        )


class CanAccessUserManagement(BasePermission):
    def has_permission(self, request, view):
        return _has_profile_permission(request.user, "can_access_user_management")


class CanCreateManagedUsers(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return _has_profile_permission(user, "can_access_user_management") and _has_profile_permission(
            user, "can_create_users"
        )


class CanResetManagedPasswords(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return _has_profile_permission(user, "can_access_user_management") and _has_profile_permission(
            user, "can_reset_passwords"
        )


class CanToggleManagedUsers(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return _has_profile_permission(user, "can_access_user_management") and _has_profile_permission(
            user, "can_toggle_users"
        )


class CanViewPortalLogs(BasePermission):
    def has_permission(self, request, view):
        return _has_profile_permission(request.user, "can_view_logs")
