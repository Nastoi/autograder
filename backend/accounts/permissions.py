from rest_framework.permissions import BasePermission


class IsSuperUserOrStaff(BasePermission):
    """
    Allows access to superusers or staff members.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_superuser or request.user.is_staff)
        )