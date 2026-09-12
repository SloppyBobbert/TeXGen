import errno
import fcntl
import os
import socket
import stat
import subprocess
import sys
import tempfile
import threading
from dataclasses import asdict
from pathlib import Path

import pytest

from api.compilation.types import CompileLimits, CompileResult, CompilationFailure, CompilerSyntaxError, InvalidCompileRequest
from compiler_sidecar.container.healthcheck import probe
from compiler_sidecar.protocol import HEADER_SIZE, READY, START, encode_frame, receive_control, receive_message, receive_request, send_control, send_response
from compiler_sidecar.runner import TectonicRunner
from compiler_sidecar.server import DEFAULT_SOCKET_PATH, SidecarServer, main


def test_sidecar_modules_import_without_site_packages():
    backend = Path(__file__).resolve().parents[1]
    subprocess.run(
        [sys.executable, "-S", "-c", "import api.compilation; import compiler_sidecar.server"],
        cwd=backend,
        check=True,
    )


class Runner:
    def __init__(self):
        self.calls = 0

    def compile(self, request):
        self.calls += 1
        raise AssertionError("runner must not be invoked")


def _payload(**limits):
    values = asdict(CompileLimits())
    values.update(limits)
    return {"job_id": "job", "source": "x", "limits": values}


@pytest.mark.parametrize(
    "name",
    tuple(asdict(CompileLimits())),
)
def test_sidecar_rejects_each_limit_above_hard_maximum(name):
    server = SidecarServer("unused", Runner())
    maximum = asdict(CompileLimits())[name]

    with pytest.raises(InvalidCompileRequest):
        server._request_from_payload(_payload(**{name: maximum + 1}))


def test_sidecar_accepts_exact_hard_maxima():
    server = SidecarServer("unused", Runner())

    assert server._request_from_payload(_payload()).limits == CompileLimits()


def test_sidecar_accepts_512_mib_address_space_limit_and_rejects_one_byte_more():
    server = SidecarServer("unused", Runner())
    maximum = 512 * 1024 * 1024

    assert server._request_from_payload(_payload(address_space_bytes=maximum)).limits.address_space_bytes == maximum
    with pytest.raises(InvalidCompileRequest):
        server._request_from_payload(_payload(address_space_bytes=maximum + 1))


def test_unknown_compilation_failure_has_protocol_valid_fallback():
    class UnknownFailure(CompilationFailure):
        pass

    assert SidecarServer._failure_payload(UnknownFailure("secret")) == {"failure": "internal", "diagnostics": ""}


def test_partial_header_timeout_closes_connection_without_invoking_runner():
    client, server_socket = socket.socketpair()
    runner = Runner()
    server = SidecarServer("unused", runner, framing_timeout=0.01)
    client.sendall(encode_frame(b"0123456789abcdef", _payload())[: HEADER_SIZE - 1])
    try:
        server.handle(server_socket)
        client.settimeout(0.1)
        assert client.recv(1) == b""
    finally:
        client.close()
        server_socket.close()

    assert runner.calls == 0


@pytest.mark.parametrize("header_sent", [False, True])
def test_drip_fed_request_releases_worker_for_next_job(header_sent):
    class ReturningRunner:
        calls = 0

        def compile(self, request):
            self.calls += 1
            return CompileResult(b"%PDF-1.7")

    runner = ReturningRunner()
    server = SidecarServer("unused", runner, framing_timeout=0.05)
    client, peer = socket.socketpair()
    frame = encode_frame(b"0123456789abcdef", _payload())
    if header_sent:
        client.sendall(frame[:HEADER_SIZE])
        frame = frame[HEADER_SIZE:]
    stopped = threading.Event()

    def drip():
        for byte in frame:
            if stopped.wait(0.01):
                return
            try:
                client.sendall(bytes([byte]))
            except OSError:
                return

    sender = threading.Thread(target=drip)
    worker = threading.Thread(target=server.handle, args=(peer,))
    sender.start()
    worker.start()
    try:
        worker.join(timeout=0.5)
        assert not worker.is_alive(), "drip-fed request retained the worker"
        assert runner.calls == 0
    finally:
        stopped.set()
        client.close()
        sender.join(timeout=1)
        worker.join(timeout=1)
        peer.close()

    client, peer = socket.socketpair()
    client.settimeout(1)
    client.sendall(encode_frame(b"0123456789abcdef", _payload()))
    worker = threading.Thread(target=server.handle, args=(peer,))
    worker.start()
    try:
        receive_control(client, b"0123456789abcdef", READY)
        send_control(client, b"0123456789abcdef", START)
        assert receive_message(client)[2] == b"%PDF-1.7"
    finally:
        client.close()
        worker.join(timeout=1)
        peer.close()
    assert not worker.is_alive() and runner.calls == 1


@pytest.mark.parametrize("failure", [False, True])
def test_non_reading_peer_is_bounded_and_next_job_succeeds(failure):
    class ReturningRunner:
        def compile(self, request):
            if failure and request.job_id == "blocked":
                raise CompilerSyntaxError("\x00" * 4096)
            return CompileResult(b"%PDF-1.7" + b"x" * (1024 * 1024))

    server = SidecarServer("unused", ReturningRunner(), framing_timeout=0.05)
    client, peer = socket.socketpair()
    peer.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 1024)
    payload = _payload()
    payload["job_id"] = "blocked"
    client.sendall(encode_frame(b"0123456789abcdef", payload))
    thread = threading.Thread(target=server.handle, args=(peer,))
    thread.start()
    try:
        receive_control(client, b"0123456789abcdef", READY)
        send_control(client, b"0123456789abcdef", START)
        thread.join(timeout=0.5)
        assert not thread.is_alive(), "non-reading peer retained the worker"
    finally:
        client.close()
        thread.join(timeout=1)
        peer.close()

    client, peer = socket.socketpair()
    client.settimeout(1)
    client.sendall(encode_frame(b"0123456789abcdef", _payload()))
    thread = threading.Thread(target=server.handle, args=(peer,))
    thread.start()
    try:
        receive_control(client, b"0123456789abcdef", READY)
        send_control(client, b"0123456789abcdef", START)
        _, response, pdf = receive_message(client)
        assert not response.get("failure") and pdf.startswith(b"%PDF-")
    finally:
        client.close()
        thread.join(timeout=1)
        peer.close()
    assert not thread.is_alive()


def test_main_starts_server_with_the_fixed_socket_and_default_runner(monkeypatch):
    started = []

    class Server:
        def __init__(self, socket_path, runner):
            started.extend((socket_path, runner))

        def serve_forever(self):
            started.append("served")

    monkeypatch.setattr("compiler_sidecar.server.SidecarServer", Server)

    main()

    assert started[0] == DEFAULT_SOCKET_PATH
    assert isinstance(started[1], TectonicRunner)
    assert started[2] == "served"


def test_main_accepts_injected_runner_and_socket(monkeypatch):
    started = []
    runner = TectonicRunner()

    class Server:
        def __init__(self, socket_path, selected_runner):
            started.extend((socket_path, selected_runner))

        def serve_forever(self):
            started.append("served")

    monkeypatch.setattr("compiler_sidecar.server.SidecarServer", Server)

    main("/tmp/compiler.sock", runner)

    assert started == ["/tmp/compiler.sock", runner, "served"]


def test_health_probe_exercises_a_live_unix_socket_protocol():
    with tempfile.TemporaryDirectory(prefix="txsc-") as directory:
        socket_path = str(Path(directory) / "compiler.sock")
        listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        listener.bind(socket_path)
        listener.listen(1)
        received = []

        def respond():
            connection, _ = listener.accept()
            with connection:
                request_id, payload = receive_request(connection)
                received.append(payload)
                send_control(connection, request_id, READY)
                receive_control(connection, request_id, START)
                send_response(connection, request_id, {"diagnostics": ""}, b"%PDF-1.7 health")

        thread = threading.Thread(target=respond)
        thread.start()
        try:
            probe(socket_path, timeout=1)
        finally:
            thread.join(timeout=1)
            listener.close()

        assert not thread.is_alive()
        assert received[0]["job_id"] == "healthcheck"


@pytest.mark.parametrize("stale", [False, True])
def test_server_sets_exact_socket_mode_after_binding(monkeypatch, stale):
    with tempfile.TemporaryDirectory(prefix="txsc-") as directory:
        socket_path = Path(directory) / "compiler.sock"
        real_socket = socket.socket
        if stale:
            with real_socket(socket.AF_UNIX, socket.SOCK_STREAM) as abandoned:
                abandoned.bind(str(socket_path))
        observed_modes = []

        class StopServing(Exception):
            pass

        class Listener:
            def __init__(self):
                self.socket = real_socket(socket.AF_UNIX, socket.SOCK_STREAM)

            def __enter__(self):
                return self.socket

            def __exit__(self, *_):
                self.socket.close()

            def bind(self, path):
                self.socket.bind(path)

            def listen(self, backlog):
                observed_modes.append(stat.S_IMODE(os.stat(socket_path).st_mode))
                raise StopServing

            def close(self):
                self.socket.close()

        monkeypatch.setattr("compiler_sidecar.server.socket.socket", lambda *_: Listener())

        with pytest.raises(StopServing):
            SidecarServer(str(socket_path), Runner()).serve_forever()

        assert observed_modes == [0o660]
        assert not socket_path.exists()


def test_server_fails_closed_when_socket_chmod_fails(monkeypatch):
    with tempfile.TemporaryDirectory(prefix="txsc-") as directory:
        socket_path = Path(directory) / "compiler.sock"

        def fail_chmod(*_):
            raise OSError(errno.EINVAL, "invalid mode")

        monkeypatch.setattr("compiler_sidecar.server.os.chmod", fail_chmod)

        with pytest.raises(OSError) as error:
            SidecarServer(str(socket_path), Runner()).serve_forever()

        assert error.value.errno == errno.EINVAL
        assert not socket_path.exists()


@pytest.mark.parametrize("kind", ["file", "directory", "symlink", "dangling", "active"])
def test_server_preserves_unsafe_or_active_socket_path(kind):
    with tempfile.TemporaryDirectory(prefix="txsc-") as directory:
        path = Path(directory) / "compiler.sock"
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as active:
            if kind == "file":
                path.write_text("retain")
            elif kind == "directory":
                path.mkdir()
            elif kind in ("symlink", "dangling"):
                target = Path(directory) / "target"
                if kind == "symlink":
                    target.write_text("retain")
                path.symlink_to(target)
            else:
                active.bind(str(path))
                active.listen(1)
            before = path.lstat()
            with pytest.raises(RuntimeError):
                SidecarServer(str(path), Runner()).serve_forever()
            assert path.lstat() == before


def test_server_preserves_socket_owned_by_another_user(monkeypatch):
    with tempfile.TemporaryDirectory(prefix="txsc-") as directory:
        path = Path(directory) / "compiler.sock"
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as stale:
            stale.bind(str(path))
        before = path.lstat()
        monkeypatch.setattr("compiler_sidecar.server.os.geteuid", lambda: before.st_uid + 1)
        with pytest.raises(RuntimeError, match="unsafe"):
            SidecarServer(str(path), Runner()).serve_forever()
        assert path.lstat() == before


@pytest.mark.parametrize("failure", [TimeoutError(), PermissionError(errno.EACCES, "denied")])
def test_server_preserves_socket_when_probe_is_uncertain(monkeypatch, failure):
    with tempfile.TemporaryDirectory(prefix="txsc-") as directory:
        path = Path(directory) / "compiler.sock"
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as stale:
            stale.bind(str(path))
        before = path.lstat()

        class Probe:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                pass

            def settimeout(self, _):
                pass

            def connect(self, _):
                raise failure

        monkeypatch.setattr("compiler_sidecar.server.socket.socket", lambda *_: Probe())
        with pytest.raises(RuntimeError, match="cannot verify"):
            SidecarServer(str(path), Runner()).serve_forever()
        assert path.lstat() == before


def test_server_directory_lock_prevents_competing_startup():
    with tempfile.TemporaryDirectory(prefix="txsc-") as directory:
        path = Path(directory) / "compiler.sock"
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as stale:
            stale.bind(str(path))
        before = path.lstat()
        lock = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with pytest.raises(BlockingIOError):
                SidecarServer(str(path), Runner()).serve_forever()
            assert path.lstat() == before
        finally:
            os.close(lock)


def test_socket_cleanup_preserves_replacement_and_accepts_missing_path():
    with tempfile.TemporaryDirectory(prefix="txsc-") as directory:
        path = Path(directory) / "compiler.sock"
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as stale:
            stale.bind(str(path))
        before = path.lstat()
        path.rename(Path(directory) / "retained.sock")
        server = SidecarServer(str(path), Runner())
        server._unlink_socket(before)
        path.write_text("retain")
        with pytest.raises(RuntimeError, match="path changed"):
            server._unlink_socket(before)
        assert path.read_text() == "retain"


@pytest.mark.parametrize("kind", ["v1", "missing-start", "wrong-id", "wrong-type", "invalid-job"])
def test_unaccepted_or_unstarted_job_never_invokes_runner(kind):
    runner = Runner()
    server = SidecarServer("unused", runner, framing_timeout=0.05)
    client, connection = socket.socketpair()
    request_id = b"0123456789abcdef"
    payload = _payload()
    if kind == "invalid-job":
        payload["job_id"] = ""
    frame = encode_frame(request_id, payload)
    if kind == "v1":
        frame = frame[:4] + bytes([1]) + frame[5:]
    client.settimeout(1)
    client.sendall(frame)
    worker = threading.Thread(target=server.handle, args=(connection,))
    worker.start()
    try:
        if kind == "invalid-job":
            assert receive_message(client)[1]["failure"] == "invalid"
        elif kind != "v1":
            receive_control(client, request_id, READY)
            assert runner.calls == 0
            if kind == "wrong-id":
                send_control(client, b"fedcba9876543210", START)
            elif kind == "wrong-type":
                send_control(client, request_id, READY)
        worker.join(timeout=1)
        assert not worker.is_alive()
        assert runner.calls == 0
        if kind != "invalid-job":
            assert client.recv(1) == b""
    finally:
        client.close()
        connection.close()
        worker.join(timeout=1)
