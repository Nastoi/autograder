from datetime import timedelta

from django.utils import timezone

from .models import PortalActivity


def purge_expired_deleted_activity() -> int:
    cutoff = timezone.now() - timedelta(days=30)

    deleted_count, _ = PortalActivity.objects.filter(
        action=PortalActivity.Action.DELETED,
        created_at__lt=cutoff,
    ).delete()

    return deleted_count


def record_portal_activity(
    *,
    user,
    action,
    object_type,
    object_id,
    object_label,
):
    # Keep deleted-object history for 30 days.
    # Cleanup happens automatically whenever a new audited activity is written.
    purge_expired_deleted_activity()

    return PortalActivity.objects.create(
        user=(
            user
            if user and user.is_authenticated
            else None
        ),
        action=action,
        object_type=object_type,
        object_id=str(object_id),
        object_label=str(object_label),
    )
