from contextlib import nullcontext
from unittest.mock import Mock, patch

import pytest
from django.core.cache import cache
from django.db import DatabaseError
from rest_framework.test import APIClient

from api.compilation.types import CompileResult, CompilerBusy, CompilerTimeout
from api.models import CompileQuotaWindow


@pytest.fixture(autouse=True)
def guest_limits(settings, db):
    cache.clear()
    settings.REQUEST_THROTTLE_ENABLED = True
    settings.REQUEST_THROTTLE_ANON_LIMIT = 20
    settings.COMPILER_USER_RATE = "60/hour"
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": 0}
    yield
    cache.clear()


@pytest.mark.parametrize("normalize", [False, True])
def test_guest_submitted_content_returns_pdf_or_normalized_source_without_user_quota(normalize):
    execute = Mock(return_value=CompileResult(pdf=b"%PDF-1.4 guest"))
    service = Mock()
    service.prepare.return_value = nullcontext(execute)
    with patch("api.views.get_compiler_service", return_value=service), patch("api.views.admit_compile") as quota:
        response = APIClient().post("/api/compile/", {
            "content": "Guest source", "source_mode": "raw", "normalize_only": normalize,
        }, format="json")
    assert response.status_code == 200
    if normalize:
        assert response.json()["tex_code"] == "Guest source"
        service.prepare.assert_not_called()
    else:
        assert response.content == b"%PDF-1.4 guest"
        assert response["Content-Type"] == "application/pdf"
        assert "document.pdf" in response["Content-Disposition"]
        execute.assert_called_once_with()
        assert "Guest source" in service.prepare.call_args.args[0].source
    quota.assert_not_called()
    assert not CompileQuotaWindow.objects.exists()


@pytest.mark.parametrize("payload,status", [
    ({"content": 2}, 400), ({"content": ""}, 400),
    ({"content": "x", "source_mode": "empty"}, 400),
    ({"content": "x" * (256 * 1024 + 1)}, 413),
])
def test_guest_invalid_source_never_reaches_compiler(payload, status):
    with patch("api.views.get_compiler_service") as compiler, patch("api.views.admit_compile") as quota:
        response = APIClient().post("/api/compile/", payload, format="json")
    assert response.status_code == status
    compiler.assert_not_called()
    quota.assert_not_called()


@pytest.mark.parametrize("shared", [False, True])
def test_guest_request_limits_cannot_be_bypassed_with_forwarded_header(settings, shared):
    if shared:
        settings.REQUEST_THROTTLE_ANON_LIMIT = 1
    else:
        settings.COMPILER_USER_RATE = "1/hour"
    client = APIClient()
    payload = {"content": "x", "normalize_only": True}
    assert client.post("/api/compile/", payload, format="json", HTTP_X_FORWARDED_FOR="192.0.2.1").status_code == 200
    if shared:
        cache.clear()  # Durable shared admission survives local cache eviction.
    denied = client.post("/api/compile/", payload, format="json", HTTP_X_FORWARDED_FOR="192.0.2.2")
    assert denied.status_code == 429
    assert int(denied["Retry-After"]) > 0
    assert client.post("/api/compile/", payload, format="json", REMOTE_ADDR="192.0.2.3").status_code == 200


def test_invalid_credentials_are_not_silently_downgraded_to_guest():
    with patch("api.views.get_compiler_service") as compiler, patch("api.views.admit_compile") as quota:
        response = APIClient().post(
            "/api/compile/", {"content": "x"}, format="json", HTTP_AUTHORIZATION="Bearer expired-token"
        )
    assert response.status_code == 401
    compiler.assert_not_called()
    quota.assert_not_called()


def test_trusted_single_proxy_uses_rightmost_address(settings):
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}
    settings.REQUEST_THROTTLE_ANON_LIMIT = 1
    client = APIClient()
    payload = {"content": "x", "normalize_only": True}
    for index in range(2):
        response = client.post(
            "/api/compile/", payload, format="json", HTTP_X_FORWARDED_FOR=f"forged-{index}, 192.0.2.4"
        )
        assert response.status_code == (200 if index == 0 else 429)
        if index:
            assert int(response["Retry-After"]) > 0


def test_guest_request_storage_failure_fails_closed():
    with patch("api.request_throttle.RequestThrottleWindow.objects.get_or_create", side_effect=DatabaseError), patch(
        "api.views.get_compiler_service"
    ) as compiler:
        response = APIClient().post("/api/compile/", {"content": "x"}, format="json")
    assert response.status_code == 503
    compiler.assert_not_called()


@pytest.mark.parametrize("failure,status", [(CompilerBusy, 503), (CompilerTimeout, 408)])
def test_guest_still_uses_compiler_capacity_and_execution_limits(failure, status):
    service = Mock()
    if failure is CompilerBusy:
        service.prepare.side_effect = failure
    else:
        service.prepare.return_value = nullcontext(Mock(side_effect=failure))
    with patch("api.views.get_compiler_service", return_value=service), patch("api.views.admit_compile") as quota:
        response = APIClient().post("/api/compile/", {"content": "x"}, format="json")
    assert response.status_code == status
    quota.assert_not_called()
