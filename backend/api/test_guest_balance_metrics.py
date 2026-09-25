import json
import uuid
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.db import DatabaseError, connection
from django.utils.dateparse import parse_datetime

from api.models import GuestCompileBalance

pytestmark = pytest.mark.django_db


def snapshot():
    output = StringIO()
    call_command("guest_balance_metrics", stdout=output)
    return json.loads(output.getvalue())


def test_reports_actual_count_growth_and_physical_size_without_mutation():
    empty = snapshot()
    assert empty["row_count"] == 0
    assert parse_datetime(empty["collected_at"]).utcoffset() is not None
    balance = GuestCompileBalance.objects.create(identity=uuid.uuid4(), used=2)
    populated = snapshot()
    assert populated["row_count"] - empty["row_count"] == 1
    balance.refresh_from_db()
    assert balance.used == 2
    assert GuestCompileBalance.objects.count() == 1
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_total_relation_size(%s)", [GuestCompileBalance._meta.db_table])
            expected = cursor.fetchone()[0]
        assert populated["table_bytes"] == expected
        assert expected > 0
    else:
        assert populated["table_bytes"] is None


def test_count_errors_fail_loudly_without_emitting_a_snapshot():
    output = StringIO()
    with (
        patch.object(GuestCompileBalance.objects, "count", side_effect=DatabaseError("unavailable")),
        pytest.raises(DatabaseError, match="unavailable"),
    ):
        call_command("guest_balance_metrics", stdout=output)
    assert output.getvalue() == ""


def test_size_errors_fail_loudly_without_emitting_a_snapshot():
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL physical size query")
    output = StringIO()
    with (
        patch.object(GuestCompileBalance.objects, "count", return_value=0),
        patch("api.management.commands.guest_balance_metrics.connection.cursor", side_effect=DatabaseError("size unavailable")),
        pytest.raises(DatabaseError, match="size unavailable"),
    ):
        call_command("guest_balance_metrics", stdout=output)
    assert output.getvalue() == ""


def test_non_postgres_size_is_explicitly_unavailable():
    with patch.object(connection, "vendor", "sqlite"):
        assert snapshot()["table_bytes"] is None
