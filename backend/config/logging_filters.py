import logging


class SkipPortalLogRequests(logging.Filter):
    """Avoid filling backend.log with the Logs page's own polling requests."""

    def filter(self, record):
        request = getattr(record, "request", None)
        path = getattr(request, "path", "") if request is not None else ""
        if path.startswith("/api/auth/logs/"):
            return False

        message = record.getMessage()
        return "/api/auth/logs/" not in message
