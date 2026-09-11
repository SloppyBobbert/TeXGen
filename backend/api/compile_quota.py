"""Persistent fixed-window admission control for authenticated compilation."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from math import ceil, floor

from django.db import DatabaseError, IntegrityError, transaction
from django.utils import timezone

from .models import CompileQuotaWindow


class CompileQuotaUnavailableError(Exception):
    """Raised when quota state cannot be read or updated safely."""


@dataclass(frozen=True)
class CompileQuotaAdmission:
    allowed: bool
    retry_after: int
    window_start: datetime


def _require_positive_int(value: int, name: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(f"{name} must be a positive integer")


def _window_start(now: datetime, window_seconds: int) -> datetime:
    if timezone.is_naive(now):
        raise ValueError("now must be timezone-aware")
    utc_now = now.astimezone(UTC)
    epoch_seconds = floor(utc_now.timestamp())
    return datetime.fromtimestamp(epoch_seconds - (epoch_seconds % window_seconds), tz=UTC)


def _retry_after(now: datetime, window_start: datetime, window_seconds: int) -> int:
    remaining = (window_start + timedelta(seconds=window_seconds) - now).total_seconds()
    return max(1, ceil(remaining))


def _cleanup_old_windows(before: datetime, batch_size: int) -> None:
    """Best-effort cleanup; admission has already committed when this runs."""
    try:
        ids = list(
            CompileQuotaWindow.objects.filter(window_start__lt=before)
            .order_by("window_start")
            .values_list("pk", flat=True)[:batch_size]
        )
        if ids:
            CompileQuotaWindow.objects.filter(pk__in=ids).delete()
    except DatabaseError:
        pass


def admit_compile(
    user,
    *,
    limit: int,
    window_seconds: int,
    now: datetime | None = None,
    cleanup_batch_size: int = 100,
) -> CompileQuotaAdmission:
    """Atomically admit one compile call without holding a transaction for compilation."""
    _require_positive_int(limit, "limit")
    _require_positive_int(window_seconds, "window_seconds")
    if isinstance(cleanup_batch_size, bool) or not isinstance(cleanup_batch_size, int) or cleanup_batch_size < 0:
        raise ValueError("cleanup_batch_size must be a non-negative integer")
    if user is None or user.pk is None:
        raise ValueError("user must be persisted")

    current_time = timezone.now() if now is None else now
    start = _window_start(current_time, window_seconds)

    try:
        with transaction.atomic():
            created = False
            try:
                quota_window = (
                    CompileQuotaWindow.objects.select_for_update()
                    .get(user=user, window_start=start)
                )
            except CompileQuotaWindow.DoesNotExist:
                try:
                    # A savepoint keeps the outer transaction usable after a
                    # concurrent insert wins the unique-constraint race.
                    with transaction.atomic():
                        quota_window = CompileQuotaWindow.objects.create(
                            user=user,
                            window_start=start,
                            count=1,
                        )
                        created = True
                except IntegrityError:
                    try:
                        quota_window = (
                            CompileQuotaWindow.objects.select_for_update()
                            .get(user=user, window_start=start)
                        )
                    except CompileQuotaWindow.DoesNotExist:
                        raise CompileQuotaUnavailableError from None

            if created:
                admission = CompileQuotaAdmission(allowed=True, retry_after=0, window_start=start)
            elif quota_window.count >= limit:
                admission = CompileQuotaAdmission(
                    allowed=False,
                    retry_after=_retry_after(current_time.astimezone(UTC), start, window_seconds),
                    window_start=start,
                )
            else:
                quota_window.count += 1
                quota_window.save(update_fields=["count"])
                admission = CompileQuotaAdmission(allowed=True, retry_after=0, window_start=start)
    except DatabaseError:
        raise CompileQuotaUnavailableError from None

    if cleanup_batch_size:
        _cleanup_old_windows(start, cleanup_batch_size)
    return admission
