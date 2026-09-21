"""Shared fixed-minute request limits, separate from accepted-compile quotas."""

from math import ceil
import time

from django.conf import settings
from django.db import DatabaseError, transaction
from django.utils.crypto import salted_hmac
from rest_framework.exceptions import APIException
from rest_framework.throttling import BaseThrottle

from .models import RequestThrottleWindow


class RequestThrottleUnavailable(APIException):
    status_code = 503
    default_detail = "Request limiting is temporarily unavailable."
    default_code = "request_throttle_unavailable"


class SharedRequestThrottle(BaseThrottle):
    timer = staticmethod(time.time)

    def allow_request(self, request, view):
        if not getattr(settings, "REQUEST_THROTTLE_ENABLED", False):
            return True

        authenticated = request.user.is_authenticated
        identity = f"user:{request.user.pk}" if authenticated else f"ip:{self.get_ident(request)}"
        key = salted_hmac("request-throttle", identity, algorithm="sha256").hexdigest()
        limit = settings.REQUEST_THROTTLE_USER_LIMIT if authenticated else settings.REQUEST_THROTTLE_ANON_LIMIT
        now = self.timer()
        start = int(now // 60) * 60
        self.retry_after = None
        try:
            with transaction.atomic():
                RequestThrottleWindow.objects.get_or_create(key=key, defaults={"window_start": start})
                # PostgreSQL serializes both existing-row and first-insert races.
                row = RequestThrottleWindow.objects.select_for_update().get(pk=key)
                if row.window_start > start:
                    self.retry_after = max(1, ceil(row.window_start + 60 - now))
                    return False
                if row.window_start < start:
                    row.window_start = start
                    row.count = 0
                if row.count >= limit:
                    self.retry_after = max(1, ceil(start + 60 - now))
                    return False
                row.count += 1
                row.save(update_fields=["window_start", "count"])
        except (DatabaseError, RequestThrottleWindow.DoesNotExist):
            raise RequestThrottleUnavailable from None

        # ponytail: bounded per-request cleanup; move to a job if throughput requires it.
        try:
            old_keys = list(RequestThrottleWindow.objects.filter(window_start__lt=start - 120)
                            .order_by("window_start").values_list("pk", flat=True)[:100])
            if old_keys:
                # Recheck expiry so cleanup cannot remove an identity refreshed meanwhile.
                RequestThrottleWindow.objects.filter(pk__in=old_keys, window_start__lt=start - 120).delete()
        except DatabaseError:
            pass  # Admission already committed; cleanup is best effort.
        return True

    def wait(self):
        return self.retry_after
