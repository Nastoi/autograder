from rest_framework.permissions import BasePermission


class IsMappingAdmin(BasePermission):
    message = "You do not have permission to manage assessment mappings."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        try:
            return request.user.profile.role in {
                "system_admin",
                "mapping_admin",
            }
        except AttributeError:
            return False