from django.core.management.base import BaseCommand

from accounts.audit import purge_expired_deleted_activity


class Command(BaseCommand):
    help = "Delete portal DELETED audit entries older than 30 days."

    def handle(self, *args, **options):
        deleted_count = purge_expired_deleted_activity()

        self.stdout.write(
            self.style.SUCCESS(
                f"Purged {deleted_count} expired deleted audit record(s)."
            )
        )
