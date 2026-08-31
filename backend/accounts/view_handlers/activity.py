from datetime import timedelta
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from ..serializers import (
    PortalActivitySerializer,
)
from ..models import PortalActivity


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


