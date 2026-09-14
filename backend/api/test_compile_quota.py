from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import DatabaseError, IntegrityError

from api.compile_quota import CompileQuotaUnavailableError, admit_compile
from api.models import CompileQuotaWindow


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="quota-user")


@pytest.mark.django_db
def test_fixed_utc_boundary_and_retry_after(user):
    now = datetime(2026, 1, 1, 12, 0, 0, 500_000, tzinfo=UTC)
    first = admit_compile(user, limit=1, window_seconds=60, now=now)
    second = admit_compile(user, limit=1, window_seconds=60, now=now)

    assert first.allowed is True
    assert first.retry_after == 0
    assert first.window_start == datetime(2026, 1, 1, 12, 0, tzinfo=UTC)
    assert second.allowed is False
    assert second.retry_after == 60


@pytest.mark.django_db
def test_limits_are_per_user_exact_and_reset_at_next_window(user):
    other = get_user_model().objects.create_user(username="other-quota-user")
    start = datetime(2026, 1, 1, tzinfo=UTC)

    assert admit_compile(user, limit=2, window_seconds=60, now=start).allowed
    assert admit_compile(user, limit=2, window_seconds=60, now=start + timedelta(seconds=1)).allowed
    assert not admit_compile(user, limit=2, window_seconds=60, now=start + timedelta(seconds=2)).allowed
    assert admit_compile(other, limit=2, window_seconds=60, now=start).allowed
    assert CompileQuotaWindow.objects.get(user=user, window_start=start).count == 2
    assert admit_compile(user, limit=2, window_seconds=60, now=start + timedelta(seconds=60)).allowed


@pytest.mark.django_db
@pytest.mark.parametrize("limit,seconds", [(0, 60), (1, 0), (-1, 60), (True, 60)])
def test_invalid_configuration_is_rejected(user, limit, seconds):
    with pytest.raises(ValueError):
        admit_compile(user, limit=limit, window_seconds=seconds)


@pytest.mark.django_db
def test_database_failure_is_fail_closed_without_details(user):
    with (
        patch("api.compile_quota.transaction.atomic", side_effect=DatabaseError("private database detail")),
        pytest.raises(CompileQuotaUnavailableError) as error,
    ):
        admit_compile(user, limit=1, window_seconds=60)

    assert str(error.value) == ""


@pytest.mark.django_db
def test_unique_window_constraint_rejects_duplicate(user):
    start = datetime(2026, 1, 1, tzinfo=UTC)
    CompileQuotaWindow.objects.create(user=user, window_start=start, count=1)

    with pytest.raises(IntegrityError):
        CompileQuotaWindow.objects.create(user=user, window_start=start, count=1)


@pytest.mark.django_db
def test_create_race_retries_with_locked_existing_row(user):
    start = datetime(2026, 1, 1, tzinfo=UTC)
    existing = CompileQuotaWindow.objects.create(user=user, window_start=start, count=1)
    manager = CompileQuotaWindow.objects
    original_select_for_update = manager.select_for_update
    calls = 0

    def select_for_update():
        nonlocal calls
        calls += 1
        queryset = original_select_for_update()
        if calls == 1:
            return _MissingFirstGet(queryset)
        return queryset

    with patch.object(manager, "select_for_update", side_effect=select_for_update), patch.object(
        manager, "create", side_effect=IntegrityError
    ):
        result = admit_compile(user, limit=3, window_seconds=60, now=start)

    existing.refresh_from_db()
    assert result.allowed is True
    assert existing.count == 2


class _MissingFirstGet:
    def __init__(self, queryset):
        self.queryset = queryset

    def get(self, **kwargs):
        raise CompileQuotaWindow.DoesNotExist
