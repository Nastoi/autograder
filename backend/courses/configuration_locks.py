from django.core.cache import cache
from rest_framework.exceptions import APIException


LOCK_TIMEOUT_SECONDS = 120


class ConfigurationLocked(APIException):
    status_code = 423
    default_code = "configuration_locked"
    default_detail = "This configuration is currently being edited by another user."


def _lock_key(assignment_level_id) -> str:
    return f"assignment-level-edit-lock:{assignment_level_id}"


def _user_label(user) -> str:
    full_name = ""
    if hasattr(user, "get_full_name"):
        full_name = (user.get_full_name() or "").strip()

    return (
        full_name
        or getattr(user, "username", "")
        or getattr(user, "email", "")
        or "Another administrator"
    )


def get_lock(assignment_level_id):
    return cache.get(_lock_key(assignment_level_id))


def acquire_lock(assignment_level_id, user):
    key = _lock_key(assignment_level_id)
    existing = cache.get(key)

    payload = {
        "user_id": str(user.id),
        "user_name": _user_label(user),
    }

    if existing and existing.get("user_id") != str(user.id):
        return False, existing

    cache.set(
        key,
        payload,
        timeout=LOCK_TIMEOUT_SECONDS,
    )
    return True, payload


def refresh_lock(assignment_level_id, user):
    key = _lock_key(assignment_level_id)
    existing = cache.get(key)

    if not existing:
        return acquire_lock(assignment_level_id, user)

    if existing.get("user_id") != str(user.id):
        return False, existing

    cache.set(
        key,
        existing,
        timeout=LOCK_TIMEOUT_SECONDS,
    )
    return True, existing


def release_lock(assignment_level_id, user):
    key = _lock_key(assignment_level_id)
    existing = cache.get(key)

    if (
        existing
        and existing.get("user_id") == str(user.id)
    ):
        cache.delete(key)
        return True

    return False


def require_lock_owner(assignment_level_id, user):
    existing = cache.get(_lock_key(assignment_level_id))

    if not existing:
        raise ConfigurationLocked(
            "Open this configuration first to obtain the edit lock."
        )

    if existing.get("user_id") != str(user.id):
        raise ConfigurationLocked(
            {
                "detail": (
                    f"{existing.get('user_name', 'Another administrator')} "
                    "is currently editing this configuration."
                ),
                "locked_by": existing.get("user_name"),
            }
        )

    cache.set(
        _lock_key(assignment_level_id),
        existing,
        timeout=LOCK_TIMEOUT_SECONDS,
    )

    return existing
