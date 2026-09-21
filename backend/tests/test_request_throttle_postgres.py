"""Strict request admission across independent PostgreSQL connections."""

from concurrent.futures import ThreadPoolExecutor
import os
import threading

import pytest
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections, connection, connections
from rest_framework.test import APIRequestFactory

from api.models import RequestThrottleWindow
from api.request_throttle import SharedRequestThrottle


if os.environ.get("TEXGEN_REQUIRE_POSTGRES_CONCURRENCY") != "1":
    pytestmark = pytest.mark.skip(reason="Requires explicit PostgreSQL concurrency execution")
else:
    assert connection.vendor == "postgresql", "Concurrency proof requires PostgreSQL"


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("already_used", [0, 2])
def test_concurrent_connections_cannot_exceed_request_limit(settings, monkeypatch, already_used):
    settings.REQUEST_THROTTLE_ENABLED = True
    settings.REQUEST_THROTTLE_ANON_LIMIT = 3
    settings.REQUEST_THROTTLE_USER_LIMIT = 3
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": 0}
    monkeypatch.setattr(SharedRequestThrottle, "timer", staticmethod(lambda: 61.0))

    def request():
        req = APIRequestFactory().get("/api/classes/", REMOTE_ADDR="192.0.2.1")
        req.user = AnonymousUser()
        return req

    for _ in range(already_used):
        assert SharedRequestThrottle().allow_request(request(), None)

    barrier = threading.Barrier(8)

    def worker():
        close_old_connections()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET statement_timeout TO '15s'")
            barrier.wait(timeout=15)
            throttle = SharedRequestThrottle()
            allowed = throttle.allow_request(request(), None)
            return allowed, throttle.wait() if not allowed else 0
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(worker) for _ in range(8)]
        results = [future.result(timeout=30) for future in futures]

    assert sum(allowed for allowed, _ in results) == 3 - already_used
    assert all(wait == 59 for allowed, wait in results if not allowed)
    assert RequestThrottleWindow.objects.get().count == 3
