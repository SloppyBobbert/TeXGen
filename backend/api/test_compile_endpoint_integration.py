from datetime import UTC, datetime
from unittest.mock import Mock, patch

import pytest
from django.contrib.auth.models import User
from django.core.exceptions import ImproperlyConfigured
from django.test import override_settings
from rest_framework.test import APIClient

from api.compilation.service import SettingsCompilerSelector
from api.compilation.types import (
    CompileLimits,
    CompileResult,
    CompilerBusy,
    CompilerInternalError,
    CompilerOutputError,
    CompilerResourceLimit,
    CompilerSyntaxError,
    CompilerTimeout,
    CompilerUnavailable,
    InvalidCompileRequest,
)
from api.compile_quota import CompileQuotaAdmission, CompileQuotaUnavailableError
from api.models import CheatSheet


@pytest.fixture
def authenticated_client(db):
    user = User.objects.create_user(username="compile-integration-user", password="testpass123")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.parametrize("backend", ["disabled", "sidecar"])
def test_normalization_expansion_returns_413_before_quota_or_compiler(authenticated_client, backend):
    marker = "% @texgen-generated v1\n"
    maximum = 256 * 1024
    source = marker + "x" * (maximum - len(marker.encode("utf-8")))
    with override_settings(COMPILER_SOURCE_MAX_BYTES=maximum, COMPILER_BACKEND=backend), patch(
        "api.views.admit_compile"
    ) as quota, patch("api.views.get_compiler_service") as compiler:
        response = authenticated_client.post("/api/compile/", {"content": source}, format="json")
    assert response.status_code == 413
    assert response.json() == {"error": "LaTeX content exceeds the maximum allowed size"}
    quota.assert_not_called()
    compiler.assert_not_called()


def admitted():
    return CompileQuotaAdmission(allowed=True, retry_after=0, window_start=datetime.now(UTC))


@pytest.mark.django_db
def test_anonymous_request_stops_before_quota_and_compiler():
    compiler = Mock()
    with patch("api.views.admit_compile") as quota, patch("api.views.get_compiler_service", return_value=compiler):
        response = APIClient().post("/api/compile/", {"content": "x"}, format="json")

    assert response.status_code == 401
    quota.assert_not_called()
    compiler.prepare.assert_not_called()


@pytest.mark.django_db
def test_malformed_payload_does_not_consume_quota_or_reach_compiler(authenticated_client):
    compiler = Mock()
    with patch("api.views.admit_compile") as quota, patch(
        "api.views.get_compiler_service", return_value=compiler
    ):
        response = authenticated_client.post("/api/compile/", {"content": 2}, format="json")

    assert response.status_code == 400
    quota.assert_not_called()
    compiler.prepare.assert_not_called()


@pytest.mark.django_db
def test_quota_exhaustion_stops_selected_adapter_before_compilation(authenticated_client):
    compiler = Mock()
    adapter = Mock()
    compiler.prepare.return_value = adapter
    denied = CompileQuotaAdmission(allowed=False, retry_after=37, window_start=datetime.now(UTC))
    with patch("api.views.admit_compile", return_value=denied), patch(
        "api.views.get_compiler_service", return_value=compiler
    ):
        response = authenticated_client.post("/api/compile/", {"content": "x"}, format="json")

    assert response.status_code == 429
    assert response["Retry-After"] == "37"
    compiler.prepare.assert_called_once()
    adapter.compile.assert_not_called()


@pytest.mark.django_db
def test_malformed_json_does_not_consume_quota_before_parser_rejects_it(authenticated_client):
    compiler = Mock()
    with patch("api.views.admit_compile", return_value=admitted()) as quota, patch(
        "api.views.get_compiler_service", return_value=compiler
    ):
        response = authenticated_client.post(
            "/api/compile/", b'{"content":', content_type="application/json"
        )

    assert response.status_code == 400
    quota.assert_not_called()
    compiler.prepare.assert_not_called()


@pytest.mark.django_db
def test_normalize_does_not_consume_quota_or_compile(authenticated_client):
    compiler = Mock()
    with patch("api.views.admit_compile", return_value=admitted()) as quota, patch(
        "api.views.get_compiler_service", return_value=compiler
    ):
        response = authenticated_client.post(
            "/api/compile/", {"content": "x", "normalize_only": True}, format="json"
        )

    assert response.status_code == 200
    quota.assert_not_called()
    compiler.prepare.assert_not_called()


@pytest.mark.django_db
def test_owner_scope_and_compiler_status_mapping(authenticated_client):
    owner = User.objects.create_user(username="another-owner", password="testpass123")
    sheet = CheatSheet.objects.create(title="Private", latex_content="x", user=owner)
    service = Mock()
    with patch("api.views.admit_compile", return_value=admitted()), patch(
        "api.views.get_compiler_service", return_value=service
    ):
        response = authenticated_client.post(
            "/api/compile/", {"cheat_sheet_id": sheet.id}, format="json"
        )
    assert response.status_code == 404
    service.prepare.assert_not_called()

    adapter = Mock()
    service.prepare.return_value = adapter
    for failure, expected_status in (
        (InvalidCompileRequest("secret"), 400),
        (CompilerOutputError("secret"), 400),
        (CompilerSyntaxError("secret"), 400),
        (CompilerTimeout("secret"), 408),
        (CompilerBusy("secret"), 503),
        (CompilerResourceLimit("secret"), 422),
        (CompilerUnavailable("secret"), 503),
        (CompilerInternalError("secret"), 503),
    ):
        adapter.compile.side_effect = failure
        with patch("api.views.admit_compile", return_value=admitted()), patch(
            "api.views.get_compiler_service", return_value=service
        ):
            response = authenticated_client.post("/api/compile/", {"content": "x"}, format="json")
        assert response.status_code == expected_status
        assert "secret" not in response.content.decode()


@pytest.mark.django_db
def test_compile_returns_pdf_once(authenticated_client):
    adapter = Mock()
    adapter.compile.return_value = CompileResult(pdf=b"%PDF-1.7\nbody")
    service = Mock()
    service.prepare.return_value = adapter
    with patch("api.views.admit_compile", return_value=admitted()), patch(
        "api.views.get_compiler_service", return_value=service
    ):
        response = authenticated_client.post("/api/compile/", {"content": "x"}, format="json")

    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response.content == b"%PDF-1.7\nbody"
    service.prepare.assert_called_once()
    adapter.compile.assert_called_once()


@pytest.mark.parametrize("source_mode", [None, "raw", "generated"])
def test_compile_wraps_fragments_before_adapter(authenticated_client, source_mode):
    adapter = Mock()
    adapter.compile.return_value = CompileResult(pdf=b"%PDF-1.7")
    service = Mock()
    service.prepare.return_value = adapter
    payload = {"content": "Fragment $x_1$", "columns": 1}
    if source_mode is not None:
        payload["source_mode"] = source_mode
    with patch("api.views.get_compiler_service", return_value=service), patch(
        "api.views.admit_compile", return_value=admitted()
    ):
        response = authenticated_client.post("/api/compile/", payload, format="json")
    assert response.status_code == 200
    source = adapter.compile.call_args.args[0].source
    assert source.count(r"\begin{document}") == 1
    assert source.count(r"\end{document}") == 1
    assert "Fragment $x_1$" in source
    assert r"\begin{multicols}" not in source


@pytest.mark.django_db
def test_raw_complete_document_reaches_selected_adapter_byte_for_byte(authenticated_client):
    source = "\\documentclass{article}\n\\begin{document}\nRaw $x_1$\n\\end{document}"
    adapter = Mock()
    adapter.compile.return_value = CompileResult(pdf=b"%PDF-1.7\nbody")
    service = Mock()
    service.prepare.return_value = adapter
    with patch("api.views.get_compiler_service", return_value=service), patch(
        "api.views.admit_compile", return_value=admitted()
    ):
        response = authenticated_client.post(
            "/api/compile/", {"content": source, "source_mode": "raw"}, format="json"
        )

    assert response.status_code == 200
    assert adapter.compile.call_args.args[0].source == source
    service.prepare.assert_called_once()
    adapter.compile.assert_called_once()

    response = authenticated_client.post(
        "/api/compile/",
        {"content": source, "source_mode": "raw", "normalize_only": True},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["tex_code"] == source


@pytest.mark.django_db
def test_quota_database_failure_prevents_selected_adapter_invocation(authenticated_client):
    adapter = Mock()
    service = Mock()
    service.prepare.return_value = adapter
    with patch("api.views.get_compiler_service", return_value=service), patch(
        "api.views.admit_compile", side_effect=CompileQuotaUnavailableError
    ):
        response = authenticated_client.post("/api/compile/", {"content": "x"}, format="json")

    assert response.status_code == 503
    adapter.compile.assert_not_called()


@pytest.mark.django_db
def test_cross_owner_and_disabled_compiler_do_not_consume_quota(authenticated_client):
    sheet = CheatSheet.objects.create(
        title="Private",
        latex_content="x",
        user=User.objects.create_user(username="private-owner"),
    )
    with patch("api.views.admit_compile") as quota:
        response = authenticated_client.post("/api/compile/", {"cheat_sheet_id": sheet.id}, format="json")
    assert response.status_code == 404
    quota.assert_not_called()

    service = Mock()
    service.prepare.side_effect = CompilerUnavailable("private")
    with patch("api.views.get_compiler_service", return_value=service), patch("api.views.admit_compile") as quota:
        response = authenticated_client.post("/api/compile/", {"content": "x"}, format="json")
    assert response.status_code == 503
    quota.assert_not_called()


@pytest.mark.django_db
def test_compile_source_mode_accepts_legacy_and_rejects_conflicts(authenticated_client):
    response = authenticated_client.post(
        "/api/compile/",
        {"content": "x", "content_source": "manual", "normalize_only": True},
        format="json",
    )
    assert response.status_code == 200

    with patch("api.views.admit_compile") as quota:
        response = authenticated_client.post(
            "/api/compile/",
            {"content": "x", "source_mode": "raw", "content_source": "generated"},
            format="json",
        )
    assert response.status_code == 400
    quota.assert_not_called()


def test_compiler_selector_fails_closed_and_never_falls_back():
    limits = CompileLimits()
    with override_settings(COMPILER_BACKEND="disabled"):
        with pytest.raises(CompilerUnavailable):
            SettingsCompilerSelector(limits).select()
    with override_settings(COMPILER_BACKEND="sidecar", COMPILER_SIDECAR_SOCKET="/missing/compiler.sock"):
        adapter = SettingsCompilerSelector(limits).select()
        with pytest.raises(CompilerUnavailable):
            adapter.compile(__import__("api.compilation.types", fromlist=["CompileRequest"]).CompileRequest("job", "x", limits))
    with override_settings(COMPILER_BACKEND="local", DEBUG=False):
        with pytest.raises(CompilerUnavailable):
            SettingsCompilerSelector(limits).select()


def test_num_proxies_defaults_to_zero_and_rejects_invalid_values(monkeypatch):
    from cheat_sheet import settings as project_settings

    monkeypatch.delenv("DJANGO_NUM_PROXIES", raising=False)
    assert project_settings._nonnegative_int_setting("DJANGO_NUM_PROXIES", 0) == 0
    monkeypatch.setenv("DJANGO_NUM_PROXIES", "2")
    assert project_settings._nonnegative_int_setting("DJANGO_NUM_PROXIES", 0) == 2
    monkeypatch.setenv("DJANGO_NUM_PROXIES", "-1")
    with pytest.raises(ImproperlyConfigured, match="DJANGO_NUM_PROXIES"):
        project_settings._nonnegative_int_setting("DJANGO_NUM_PROXIES", 0)
