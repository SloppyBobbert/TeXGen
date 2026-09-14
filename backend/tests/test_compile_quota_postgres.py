import os
import threading
from datetime import UTC, datetime

import pytest
from django.contrib.auth import get_user_model
from django.db import connection, connections, close_old_connections

from api.compile_quota import admit_compile
from api.models import CompileQuotaWindow


if os.environ.get("TEXGEN_REQUIRE_POSTGRES_CONCURRENCY") != "1":
    pytestmark = pytest.mark.skip(
        reason="PostgreSQL concurrency evidence requires TEXGEN_REQUIRE_POSTGRES_CONCURRENCY=1"
    )
else:
    assert connection.vendor == "postgresql", "PostgreSQL concurrency evidence must run against PostgreSQL"


@pytest.mark.django_db
def test_cleanup_has_a_standalone_window_start_index():
    with connection.cursor() as cursor:
        indexes = connection.introspection.get_constraints(cursor, CompileQuotaWindow._meta.db_table)
    assert any(index["index"] and index["columns"] == ["window_start"] for index in indexes.values())


def _concurrent_admissions(*, user_id, limit, now, workers=8):
    barrier = threading.Barrier(workers)
    results = []
    errors = []
    result_lock = threading.Lock()

    def worker():
        close_old_connections()
        try:
            user = get_user_model().objects.get(pk=user_id)
            barrier.wait(timeout=30)
            admission = admit_compile(user, limit=limit, window_seconds=60, now=now)
            with result_lock:
                results.append(admission)
        except Exception as error:
            with result_lock:
                errors.append(error)
        finally:
            connections.close_all()

    threads = [threading.Thread(target=worker) for _ in range(workers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    assert not [thread for thread in threads if thread.is_alive()]
    assert errors == []
    return results


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(
    "now",
    [
        datetime(2026, 1, 1, 12, 0, 1, tzinfo=UTC),
        datetime(2026, 1, 1, 12, 1, 1, tzinfo=UTC),
        datetime(2026, 1, 1, 12, 2, 1, tzinfo=UTC),
    ],
)
def test_empty_window_allows_only_the_limit_during_insert_race(now):
    user = get_user_model().objects.create_user(username=f"quota-insert-race-{now.minute}")
    connection.commit()

    results = _concurrent_admissions(user_id=user.pk, limit=3, now=now)

    assert sum(result.allowed for result in results) == 3
    denied = [result for result in results if not result.allowed]
    assert len(denied) == 5
    assert all(result.retry_after > 0 for result in denied)
    assert CompileQuotaWindow.objects.filter(user=user, window_start=now.replace(second=0)).get().count == 3


@pytest.mark.django_db(transaction=True)
def test_existing_window_allows_one_remaining_admission_under_contention():
    now = datetime(2026, 1, 1, 13, 0, 1, tzinfo=UTC)
    limit = 3
    user = get_user_model().objects.create_user(username="quota-existing-window-race")
    CompileQuotaWindow.objects.create(user=user, window_start=now.replace(second=0), count=limit - 1)
    connection.commit()

    results = _concurrent_admissions(user_id=user.pk, limit=limit, now=now)

    assert sum(result.allowed for result in results) == 1
    denied = [result for result in results if not result.allowed]
    assert len(denied) == 7
    assert all(result.retry_after > 0 for result in denied)
    assert CompileQuotaWindow.objects.get(user=user, window_start=now.replace(second=0)).count == limit
