"""Read-only snapshots for operator-managed permanent guest balance monitoring."""
import json

from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone

from api.models import GuestCompileBalance


class Command(BaseCommand):
    help = "Report guest balance row count and PostgreSQL total table bytes as JSON."

    def handle(self, *args, **options):
        row_count = GuestCompileBalance.objects.count()
        table_bytes = None
        if connection.vendor == "postgresql":
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_total_relation_size(%s)", [GuestCompileBalance._meta.db_table])
                table_bytes = cursor.fetchone()[0]
        self.stdout.write(json.dumps({
            "collected_at": timezone.now().isoformat(),
            "row_count": row_count,
            "table_bytes": table_bytes,
        }))
