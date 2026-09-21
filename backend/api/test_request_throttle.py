from types import SimpleNamespace

import pytest
from django.contrib.auth.models import AnonymousUser
from django.db import OperationalError
from rest_framework.test import APIRequestFactory


pytestmark = pytest.mark.django_db


@pytest.fixture
def throttle(settings, monkeypatch):
    from api.request_throttle import SharedRequestThrottle

    settings.REQUEST_THROTTLE_ENABLED = True
    settings.REQUEST_THROTTLE_ANON_LIMIT = 2
    settings.REQUEST_THROTTLE_USER_LIMIT = 3
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": 0}
    monkeypatch.setattr(SharedRequestThrottle, "timer", staticmethod(lambda: 61.0))
    return SharedRequestThrottle


def request(ip="192.0.2.1", user_id=None, **headers):
    req = APIRequestFactory().get("/api/classes/", REMOTE_ADDR=ip, **headers)
    req.user = AnonymousUser() if user_id is None else SimpleNamespace(pk=user_id, is_authenticated=True)
    return req


def test_independent_instances_share_limit_and_retry_after(throttle):
    from api.models import RequestThrottleWindow

    assert throttle().allow_request(request(), None)
    assert throttle().allow_request(request(), None)
    denied = throttle()
    assert not denied.allow_request(request(), None)
    assert denied.wait() == 59
    assert RequestThrottleWindow.objects.get().count == 2


def test_authenticated_identity_is_shared_across_addresses(throttle):
    for ip in ("192.0.2.1", "192.0.2.2", "192.0.2.3"):
        assert throttle().allow_request(request(ip, user_id=1), None)
    assert not throttle().allow_request(request("192.0.2.4", user_id=1), None)
    assert throttle().allow_request(request(user_id=2), None)
    assert throttle().allow_request(request(), None)


def test_untrusted_forwarding_headers_cannot_reset_anonymous_limit(throttle):
    for forged in ("198.51.100.1", "198.51.100.2"):
        assert throttle().allow_request(request(HTTP_X_FORWARDED_FOR=forged), None)
    assert not throttle().allow_request(request(HTTP_X_FORWARDED_FOR="198.51.100.3"), None)


def test_window_rolls_over_without_growing_identity_rows(throttle, monkeypatch):
    from api.models import RequestThrottleWindow

    assert throttle().allow_request(request(), None)
    assert throttle().allow_request(request(), None)
    monkeypatch.setattr(throttle, "timer", staticmethod(lambda: 120.0))
    assert throttle().allow_request(request(), None)
    row = RequestThrottleWindow.objects.get()
    assert row.count == 1
    assert row.window_start == 120
    assert "192.0.2.1" not in row.pk


def test_clock_reversal_does_not_reset_budget(throttle, monkeypatch):
    assert throttle().allow_request(request(), None)
    monkeypatch.setattr(throttle, "timer", staticmethod(lambda: 1.0))
    denied = throttle()
    assert not denied.allow_request(request(), None)
    assert denied.wait() == 119


def test_database_failure_is_service_unavailable_not_fail_open(throttle, monkeypatch):
    from api.models import RequestThrottleWindow
    from api.request_throttle import RequestThrottleUnavailable

    def unavailable(**kwargs):
        raise OperationalError("private database details")

    monkeypatch.setattr(RequestThrottleWindow.objects, "get_or_create", unavailable)
    with pytest.raises(RequestThrottleUnavailable) as error:
        throttle().allow_request(request(), None)
    assert error.value.status_code == 503
    assert "private" not in str(error.value)


def test_development_can_bypass_without_database_access(throttle, settings, django_assert_num_queries):
    settings.REQUEST_THROTTLE_ENABLED = False
    with django_assert_num_queries(0):
        assert throttle().allow_request(request(), None)


def test_old_identity_cleanup_is_bounded(throttle):
    from api.models import RequestThrottleWindow

    RequestThrottleWindow.objects.bulk_create([
        RequestThrottleWindow(key=f"old-{i}", window_start=0, count=1) for i in range(105)
    ])
    throttle.timer = staticmethod(lambda: 600.0)
    assert throttle().allow_request(request(), None)
    assert RequestThrottleWindow.objects.filter(window_start=0).count() == 5


@pytest.mark.parametrize("method,path", [
    ("get", "/api/classes/"),
    ("post", "/api/register/"),
    ("post", "/api/token/"),
    ("post", "/api/token/refresh/"),
])
def test_public_routes_enforce_shared_budget(throttle, method, path):
    from rest_framework.test import APIClient

    client = APIClient()
    send = getattr(client, method)
    for _ in range(2):
        assert send(path, {}, format="json").status_code in (200, 400)
    response = send(path, {}, format="json")
    assert response.status_code == 429
    assert response["Retry-After"] == "59"


def test_compile_keeps_shared_budget_and_accepted_quota_separate(throttle, settings):
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient
    from api.models import CompileQuotaWindow

    settings.REQUEST_THROTTLE_USER_LIMIT = 1
    client = APIClient()
    client.force_authenticate(get_user_model().objects.create_user("shared-throttle-user"))
    assert client.post("/api/compile/", {"content": ""}, format="json").status_code == 400
    response = client.post("/api/compile/", {"content": ""}, format="json")
    assert response.status_code == 429
    assert response["Retry-After"] == "59"
    assert not CompileQuotaWindow.objects.exists()


def test_health_does_not_consume_the_request_budget(throttle):
    from rest_framework.test import APIClient
    from api.models import RequestThrottleWindow

    for _ in range(2):
        assert throttle().allow_request(request("127.0.0.1"), None)
    assert APIClient().get("/api/health/").status_code == 200
    assert RequestThrottleWindow.objects.get().count == 2


def test_public_route_returns_503_when_throttle_storage_fails(throttle, monkeypatch):
    from rest_framework.test import APIClient
    from api.models import RequestThrottleWindow

    def unavailable(**kwargs):
        raise OperationalError("private database details")

    monkeypatch.setattr(RequestThrottleWindow.objects, "get_or_create", unavailable)
    response = APIClient().get("/api/classes/")
    assert response.status_code == 503
    assert "private" not in response.content.decode()
