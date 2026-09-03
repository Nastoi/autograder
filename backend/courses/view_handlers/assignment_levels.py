from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from lms.permissions import IsMappingAdmin
from django.shortcuts import get_object_or_404

from ..models import AssignmentLevel

from ..serializers import AssignmentLevelSerializer

from ..configuration_status import (
    refresh_assignment_level_configuration_status,
)

from ..configuration_locks import (
    acquire_lock,
    get_lock,
    refresh_lock,
    release_lock,
    require_lock_owner,
)

class AssignmentLevelConfigurationLockView(APIView):
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get(self, request, level_id):
        get_object_or_404(AssignmentLevel, id=level_id)
        lock = get_lock(level_id)

        return Response(
            {
                "locked": bool(lock),
                "locked_by": (
                    lock.get("user_name")
                    if lock
                    else None
                ),
                "owned_by_me": (
                    bool(lock)
                    and lock.get("user_id")
                    == str(request.user.id)
                ),
            }
        )

    def post(self, request, level_id):
        get_object_or_404(AssignmentLevel, id=level_id)

        action = request.data.get("action", "acquire")

        if action == "acquire":
            acquired, lock = acquire_lock(
                level_id,
                request.user,
            )
        elif action == "heartbeat":
            acquired, lock = refresh_lock(
                level_id,
                request.user,
            )
        elif action == "release":
            released = release_lock(
                level_id,
                request.user,
            )
            return Response(
                {
                    "released": released,
                    "locked": False,
                    "owned_by_me": False,
                }
            )
        else:
            return Response(
                {"detail": "Invalid lock action."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not acquired:
            return Response(
                {
                    "locked": True,
                    "locked_by": lock.get("user_name"),
                    "owned_by_me": False,
                    "detail": (
                        f"{lock.get('user_name', 'Another administrator')} "
                        "is currently editing this configuration."
                    ),
                },
                status=status.HTTP_423_LOCKED,
            )

        return Response(
            {
                "locked": True,
                "locked_by": lock.get("user_name"),
                "owned_by_me": True,
            }
        )


class AssignmentLevelListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = AssignmentLevelSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def get_queryset(self):
        queryset = AssignmentLevel.objects.select_related(
            "assignment",
            "assignment__module",
            "assignment__module__qualification",
            "grading_configuration",
        ).order_by(
            "assignment__assignment_code",
            "level_code",
        )

        module_id = self.request.query_params.get("module_id")
        assignment_id = self.request.query_params.get("assignment_id")

        if module_id:
            queryset = queryset.filter(
                assignment__module_id=module_id,
            )

        if assignment_id:
            queryset = queryset.filter(
                assignment_id=assignment_id,
            )

        return queryset


class AssignmentLevelDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = AssignmentLevelSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def get_queryset(self):
        return AssignmentLevel.objects.select_related(
            "assignment",
            "assignment__module",
            "assignment__module__qualification",
            "grading_configuration",
        ).order_by(
            "assignment__assignment_code",
            "level_code",
        )

    def perform_update(self, serializer):
        level = self.get_object()

        require_lock_owner(
            level.id,
            self.request.user,
        )

        updated_level = serializer.save()

        refresh_assignment_level_configuration_status(
            updated_level
        )

    def destroy(self, request, *args, **kwargs):
        level = self.get_object()

        has_submission_history = (
            level.learner_submissions.exists()
            or level.submission_contexts_by_assignment.exists()
        )

        if has_submission_history:
            level.is_active = False
            level.configuration_status = (
                AssignmentLevel.ConfigurationStatus.RETIRED
            )

            level.save(
                update_fields=[
                    "is_active",
                    "configuration_status",
                    "updated_at",
                ]
            )

            return Response(
                {
                    "detail": (
                        "This track has learner history, so it was "
                        "retired instead of permanently deleted."
                    ),
                    "retired": True,
                },
                status=status.HTTP_200_OK,
            )

        return super().destroy(
            request,
            *args,
            **kwargs,
        )
