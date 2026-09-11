"""Single-worker Unix socket server for untrusted compile jobs."""

import errno
import fcntl
import os
import socket
import stat
from dataclasses import fields

from api.compilation.types import (
    CompileLimits,
    CompileRequest,
    CompilationFailure,
    CompilerInternalError,
    CompilerOutputError,
    CompilerResourceLimit,
    CompilerSyntaxError,
    CompilerTimeout,
    CompilerUnavailable,
    InvalidCompileRequest,
)

from .protocol import MAX_DIAGNOSTICS_BYTES, ProtocolError, receive_request, send_response
from .runner import TectonicRunner

_LIMIT_KEYS = {field.name for field in fields(CompileLimits)}
DEFAULT_SOCKET_PATH = "/run/texgen/compiler.sock"
_FAILURE_CODES = (
    (CompilerSyntaxError, "syntax"),
    (InvalidCompileRequest, "invalid"),
    (CompilerTimeout, "timeout"),
    (CompilerResourceLimit, "resource"),
    (CompilerOutputError, "output"),
    (CompilerUnavailable, "unavailable"),
    (CompilerInternalError, "internal"),
)


class SidecarServer:
    """Processes one connection at a time; backlog permits just one waiter."""

    def __init__(self, socket_path: str, runner: TectonicRunner, framing_timeout: float = 2.0) -> None:
        self.socket_path = socket_path
        self.runner = runner
        self.framing_timeout = framing_timeout

    def serve_forever(self) -> None:
        # Hold the directory lock through cleanup so two sidecars cannot reclaim each other's socket.
        directory = os.open(os.path.dirname(self.socket_path) or ".", os.O_RDONLY | os.O_DIRECTORY)
        try:
            fcntl.flock(directory, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self._remove_stale_socket()
            listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            bound = None
            try:
                listener.bind(self.socket_path)
                bound = os.lstat(self.socket_path)
                os.chmod(self.socket_path, 0o660)
                listener.listen(1)
                while True:
                    connection, _ = listener.accept()
                    with connection:
                        self.handle(connection)
            finally:
                listener.close()
                if bound is not None:
                    self._unlink_socket(bound)
        finally:
            os.close(directory)

    def _remove_stale_socket(self) -> None:
        try:
            existing = os.lstat(self.socket_path)
        except FileNotFoundError:
            return
        if not stat.S_ISSOCK(existing.st_mode) or existing.st_uid != os.geteuid():
            raise RuntimeError("refusing to replace an unsafe sidecar socket path")
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as probe:
            probe.settimeout(self.framing_timeout)
            try:
                probe.connect(self.socket_path)
            except OSError as error:
                if error.errno != errno.ECONNREFUSED:
                    raise RuntimeError("cannot verify that the sidecar socket is stale") from error
            else:
                raise RuntimeError("refusing to replace an active sidecar socket")
        self._unlink_socket(existing)

    def _unlink_socket(self, expected: os.stat_result) -> None:
        try:
            current = os.lstat(self.socket_path)
        except FileNotFoundError:
            return
        if (
            not stat.S_ISSOCK(current.st_mode)
            or (current.st_dev, current.st_ino) != (expected.st_dev, expected.st_ino)
        ):
            raise RuntimeError("sidecar socket path changed")
        os.unlink(self.socket_path)

    def handle(self, connection: socket.socket) -> None:
        request_id: bytes | None = None
        try:
            connection.settimeout(self.framing_timeout)
            request_id, payload = receive_request(connection)
            request = self._request_from_payload(payload)
            result = self.runner.compile(request)
            send_response(
                connection,
                request_id,
                {"diagnostics": _bounded_diagnostics(result.diagnostics)},
                result.pdf,
            )
        except (ProtocolError, TimeoutError):
            # An untrusted peer did not establish a valid job. Closing is fail-closed.
            connection.close()
            return
        except CompilationFailure as error:
            if request_id is None:
                return
            try:
                send_response(connection, request_id, self._failure_payload(error))
            except (OSError, ProtocolError):
                return
        except Exception:
            if request_id is None:
                return
            try:
                send_response(connection, request_id, {"failure": "internal", "diagnostics": ""})
            except (OSError, ProtocolError):
                return

    @staticmethod
    def _request_from_payload(payload: object) -> CompileRequest:
        if not isinstance(payload, dict) or set(payload) != {"job_id", "source", "limits"}:
            raise InvalidCompileRequest("invalid sidecar request")
        limits = payload["limits"]
        if not isinstance(limits, dict) or set(limits) != _LIMIT_KEYS:
            raise InvalidCompileRequest("invalid sidecar limits")
        try:
            requested = CompileLimits(**limits)
            maxima = CompileLimits()
            if any(getattr(requested, field) > getattr(maxima, field) for field in _LIMIT_KEYS):
                raise InvalidCompileRequest("sidecar limits exceed hard maximum")
            return CompileRequest(payload["job_id"], payload["source"], requested)
        except (TypeError, ValueError, InvalidCompileRequest) as error:
            raise InvalidCompileRequest("invalid sidecar request") from error

    @staticmethod
    def _failure_payload(error: CompilationFailure) -> dict[str, str]:
        for failure_type, code in _FAILURE_CODES:
            if isinstance(error, failure_type):
                return {"failure": code, "diagnostics": _bounded_diagnostics(str(error))}
        return {"failure": "internal", "diagnostics": ""}


def _bounded_diagnostics(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return value.encode("utf-8")[:MAX_DIAGNOSTICS_BYTES].decode("utf-8", "ignore")


def main(socket_path: str = DEFAULT_SOCKET_PATH, runner: TectonicRunner | None = None) -> None:
    """Run the sidecar on its fixed deployment socket."""
    SidecarServer(socket_path, runner if runner is not None else TectonicRunner()).serve_forever()


if __name__ == "__main__":
    main()
