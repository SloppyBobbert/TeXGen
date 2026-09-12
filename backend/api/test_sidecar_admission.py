"""Real socket acceptance must precede quota; START must follow admission."""

import socket
import tempfile
import threading
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

import pytest
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient

from api.compilation.types import CompileResult, CompilerResourceLimit, CompilerSyntaxError, CompilerTimeout
from api.compile_quota import CompileQuotaAdmission, CompileQuotaUnavailableError, admit_compile
from api.models import CompileQuotaWindow
from compiler_sidecar.protocol import READY, START, VERSION, encode_response, receive_control, receive_request, send_control
from compiler_sidecar.server import SidecarServer


@pytest.fixture
def client(db):
    cache.clear()
    client = APIClient()
    client.force_authenticate(User.objects.create_user(username="socket-admission"))
    yield client
    cache.clear()


@contextmanager
def peer(handler):
    # Short paths fit AF_UNIX on macOS as well as Linux.
    with tempfile.TemporaryDirectory(prefix="txsc-") as directory:
        path = str(Path(directory) / "compiler.sock")
        errors = []
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as listener:
            listener.bind(path)
            listener.listen(1)
            listener.settimeout(3)

            def serve():
                try:
                    connection, _ = listener.accept()
                    with connection:
                        connection.settimeout(2)
                        handler(connection)
                except Exception as error:
                    errors.append(error)

            thread = threading.Thread(target=serve)
            thread.start()
            try:
                with override_settings(COMPILER_BACKEND="sidecar", COMPILER_SIDECAR_SOCKET=path):
                    yield
            finally:
                thread.join(timeout=4)
            assert not thread.is_alive(), "connection was not released"
            assert not errors


@pytest.mark.parametrize("kind", ["eof", "partial", "wrong-id", "wrong-type", "v1", "payload", "timeout", "early-result"])
def test_bad_ready_returns_503_without_admission_or_quota(client, kind):
    def respond(connection):
        request_id, _ = receive_request(connection)
        if kind == "eof":
            return
        if kind == "timeout":
            assert connection.recv(1) == b""  # Client must close on its readiness deadline.
            return
        if kind == "wrong-id":
            send_control(connection, b"wrong-request-id", READY)
        elif kind == "wrong-type":
            send_control(connection, request_id, START)
        elif kind == "early-result":
            connection.sendall(encode_response(request_id, {"diagnostics": ""}, b"%PDF-1.7"))
        else:
            version = 1 if kind == "v1" else VERSION
            length = 1 if kind == "payload" else 0
            header = b"TXSC" + bytes([version, READY]) + request_id + length.to_bytes(4, "big") + bytes(4)
            connection.sendall(header[:10] if kind == "partial" else header)

    with peer(respond), patch("api.views.admit_compile", wraps=admit_compile) as quota:
        response = client.post("/api/compile/", {"content": "x"}, format="json")
    assert response.status_code == 503
    quota.assert_not_called()
    assert not CompileQuotaWindow.objects.exists()


def test_refused_socket_returns_503_before_quota(client):
    with tempfile.TemporaryDirectory(prefix="txsc-") as directory:
        path = str(Path(directory) / "refused.sock")
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as abandoned:
            abandoned.bind(path)
        with override_settings(COMPILER_BACKEND="sidecar", COMPILER_SIDECAR_SOCKET=path), patch(
            "api.views.admit_compile", wraps=admit_compile
        ) as quota:
            response = client.post("/api/compile/", {"content": "x"}, format="json")
    assert response.status_code == 503
    quota.assert_not_called()
    assert not CompileQuotaWindow.objects.exists()


def test_connect_timeout_returns_503_before_quota_and_closes_socket(client, monkeypatch):
    real_socket = socket.socket
    opened = []

    class ConnectTimeout(real_socket):
        def connect(self, address):
            opened.append(self)
            raise TimeoutError("connect timed out")

    monkeypatch.setattr("api.compilation.sidecar.socket.socket", ConnectTimeout)
    with override_settings(COMPILER_BACKEND="sidecar"), patch("api.views.admit_compile", wraps=admit_compile) as quota:
        response = client.post("/api/compile/", {"content": "x"}, format="json")
    assert response.status_code == 503
    quota.assert_not_called()
    assert not CompileQuotaWindow.objects.exists()
    assert opened and opened[0].fileno() == -1


def test_socket_creation_failure_returns_503_before_quota(client):
    with override_settings(COMPILER_BACKEND="sidecar"), patch(
        "api.compilation.sidecar.socket.socket", side_effect=OSError("no file descriptors")
    ), patch("api.views.admit_compile", wraps=admit_compile) as quota:
        response = client.post("/api/compile/", {"content": "x"}, format="json")
    assert response.status_code == 503
    quota.assert_not_called()
    assert not CompileQuotaWindow.objects.exists()


@pytest.mark.parametrize("outcome", ["denied", "database", "unexpected"])
def test_admission_cancellation_closes_real_connection_without_execution(client, outcome):
    calls = []

    class Runner:
        def compile(self, request):
            calls.append(request)
            return CompileResult(b"%PDF-1.7")

    def admission(*args, **kwargs):
        assert not calls
        if outcome == "database":
            raise CompileQuotaUnavailableError
        if outcome == "unexpected":
            raise RuntimeError("unexpected admission failure")
        return CompileQuotaAdmission(False, 37, datetime.now(UTC))

    with peer(SidecarServer("unused", Runner()).handle), patch("api.views.admit_compile", side_effect=admission):
        if outcome == "unexpected":
            with pytest.raises(RuntimeError, match="unexpected admission"):
                client.post("/api/compile/", {"content": "x"}, format="json")
        else:
            response = client.post("/api/compile/", {"content": "x"}, format="json")
            assert response.status_code == (429 if outcome == "denied" else 503)
            if outcome == "denied":
                assert response["Retry-After"] == "37"
    assert not calls
    assert not CompileQuotaWindow.objects.exists()


@pytest.mark.parametrize("failure,status", [(None, 200), (CompilerSyntaxError, 400), (CompilerTimeout, 408), (CompilerResourceLimit, 422)])
def test_accepted_jobs_are_charged_and_never_run_before_admission(client, failure, status):
    admitted = threading.Event()
    calls = []

    class Runner:
        def compile(self, request):
            assert admitted.is_set()
            calls.append(request)
            if failure:
                raise failure("private diagnostic")
            return CompileResult(b"%PDF-1.7")

    def admission(*args, **kwargs):
        assert not calls
        result = admit_compile(*args, **kwargs)
        assert result.allowed
        admitted.set()
        return result

    with peer(SidecarServer("unused", Runner()).handle), patch("api.views.admit_compile", side_effect=admission) as quota:
        response = client.post("/api/compile/", {"content": "x"}, format="json")
    assert response.status_code == status
    quota.assert_called_once()
    assert len(calls) == 1
    assert CompileQuotaWindow.objects.get().count == 1


@pytest.mark.parametrize("kind,status", [("lost-response", 503), ("wrong-id", 503), ("runtime-timeout", 408)])
def test_post_acceptance_transport_failure_is_not_refunded(client, kind, status):
    executed = []

    def respond(connection):
        request_id, _ = receive_request(connection)
        send_control(connection, request_id, READY)
        receive_control(connection, request_id, START)
        executed.append(True)  # Successful work may occur even when its response is lost.
        if kind == "runtime-timeout":
            assert connection.recv(1) == b""
        elif kind == "wrong-id":
            connection.sendall(encode_response(b"fedcba9876543210", {"diagnostics": ""}, b"%PDF-1.7"))

    with peer(respond), override_settings(COMPILER_TIMEOUT_SECONDS=0.01), patch(
        "api.compilation.sidecar._RESPONSE_GRACE_SECONDS", 0.01
    ):
        response = client.post("/api/compile/", {"content": "x"}, format="json")
    assert response.status_code == status
    assert executed == [True]
    assert CompileQuotaWindow.objects.get().count == 1
