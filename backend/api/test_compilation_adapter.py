from dataclasses import FrozenInstanceError

import pytest

from api.compilation.adapter import CompilerAdapter, LocalCompilerAdapter
from api.compilation.service import CompilerService, UnavailableCompilerSelector
from api.compilation.sidecar import SidecarCompilerClient
from api.compilation.types import (
    CompileLimits,
    CompileRequest,
    CompileResult,
    CompilerUnavailable,
    CompilerOutputError,
    InvalidCompileRequest,
)
from compiler_sidecar.protocol import READY, START, receive_control, receive_request, send_control, send_response
from compiler_sidecar.server import SidecarServer


def receive_started_request(connection):
    request_id, payload = receive_request(connection)
    send_control(connection, request_id, READY)
    receive_control(connection, request_id, START)
    return request_id, payload


class ConnectedSocket:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.connection.close()

    def settimeout(self, value):
        self.connection.settimeout(value)

    def connect(self, _):
        pass

    def __getattr__(self, name):
        return getattr(self.connection, name)


def test_compile_contract_is_immutable_and_local_adapter_delegates():
    limits = CompileLimits(source_max_bytes=100, timeout_seconds=2, pdf_max_bytes=200)
    request = CompileRequest(job_id="job-1", source="\\documentclass{article}", limits=limits)
    expected = CompileResult(pdf=b"%PDF-1.7", diagnostics="ok")
    adapter = LocalCompilerAdapter(lambda received: expected)

    assert isinstance(adapter, CompilerAdapter)
    assert adapter.compile(request) is expected
    with pytest.raises(FrozenInstanceError):
        limits.timeout_seconds = 3


@pytest.mark.parametrize("value", (float("nan"), float("inf"), float("-inf")))
def test_compile_limits_reject_nonfinite_values(value):
    with pytest.raises(InvalidCompileRequest):
        CompileLimits(timeout_seconds=value)
    with pytest.raises(InvalidCompileRequest):
        CompileLimits(cpu_seconds=value)


def test_service_fails_closed_when_no_compiler_is_available():
    request = CompileRequest(job_id="job-1", source="x", limits=CompileLimits())

    with pytest.raises(CompilerUnavailable):
        CompilerService(UnavailableCompilerSelector()).compile(request)


def test_sidecar_server_and_client_round_trip_large_pdf_over_socketpair(monkeypatch):
    client_socket, server_socket = __import__("socket").socketpair()
    pdf = b"%PDF-1.7\n" + b"x" * (1_048_576 + 1)

    class Runner:
        def compile(self, request):
            return CompileResult(pdf=pdf, diagnostics="ok")

    server = SidecarServer("unused", Runner())
    monkeypatch.setattr("api.compilation.sidecar.socket.socket", lambda *_: ConnectedSocket(client_socket))
    from threading import Thread

    thread = Thread(target=server.handle, args=(server_socket,))
    thread.start()
    try:
        result = SidecarCompilerClient("unused").compile(
            CompileRequest("job", "x", CompileLimits())
        )
    finally:
        thread.join()

    assert result.pdf == pdf


def test_sidecar_client_maps_typed_failure_and_rejects_mismatched_id(monkeypatch):
    client_socket, server_socket = __import__("socket").socketpair()
    monkeypatch.setattr("api.compilation.sidecar.socket.socket", lambda *_: ConnectedSocket(client_socket))
    from threading import Thread

    def respond():
        request_id, _ = receive_started_request(server_socket)
        send_response(server_socket, request_id, {"failure": "busy", "diagnostics": "x"})

    thread = Thread(target=respond)
    thread.start()
    try:
        with pytest.raises(__import__("api.compilation.types", fromlist=["CompilerBusy"]).CompilerBusy):
            SidecarCompilerClient("unused").compile(CompileRequest("job", "x", CompileLimits()))
    finally:
        thread.join()


def test_sidecar_client_rejects_mismatched_response_id(monkeypatch):
    client_socket, server_socket = __import__("socket").socketpair()
    monkeypatch.setattr("api.compilation.sidecar.socket.socket", lambda *_: ConnectedSocket(client_socket))
    from threading import Thread

    def respond():
        receive_started_request(server_socket)
        send_response(server_socket, b"fedcba9876543210", {"failure": "busy", "diagnostics": "x"})

    thread = Thread(target=respond)
    thread.start()
    try:
        with pytest.raises(CompilerUnavailable, match="mismatched"):
            SidecarCompilerClient("unused").compile(CompileRequest("job", "x", CompileLimits()))
    finally:
        thread.join()


@pytest.mark.parametrize(
    ("payload", "pdf"),
    [
        ({"diagnostics": ""}, b"%PDF-1.7" + b"x" * 11),
        ({"diagnostics": "x" * 11}, b"%PDF-1.7"),
    ],
)
def test_sidecar_client_rejects_response_over_request_limit(monkeypatch, payload, pdf):
    client_socket, server_socket = __import__("socket").socketpair()
    monkeypatch.setattr("api.compilation.sidecar.socket.socket", lambda *_: ConnectedSocket(client_socket))
    from threading import Thread

    def respond():
        request_id, _ = receive_started_request(server_socket)
        send_response(server_socket, request_id, payload, pdf)

    thread = Thread(target=respond)
    thread.start()
    try:
        with pytest.raises(CompilerOutputError):
            SidecarCompilerClient("unused").compile(
                CompileRequest("job", "x", CompileLimits(pdf_max_bytes=10, diagnostics_max_bytes=10))
            )
    finally:
        thread.join()
