"""Unix-domain-socket adapter for the isolated compiler sidecar."""

import socket
import uuid
from contextlib import contextmanager
from dataclasses import asdict
from functools import partial

from compiler_sidecar.protocol import READY, START, ProtocolError, receive_control, receive_message, send_control, send_message

from .types import (
    CompileRequest,
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

_RESPONSE_GRACE_SECONDS = 2.0
_FAILURES = {
    "invalid": InvalidCompileRequest,
    "syntax": CompilerSyntaxError,
    "timeout": CompilerTimeout,
    "resource": CompilerResourceLimit,
    "output": CompilerOutputError,
    "busy": CompilerBusy,
    "unavailable": CompilerUnavailable,
    "internal": CompilerInternalError,
}


class SidecarCompilerClient:
    def __init__(self, socket_path: str, connect_timeout: float = 1.0,
                 admission_timeout: float | None = None) -> None:
        self.socket_path = socket_path
        self.connect_timeout = connect_timeout
        self.admission_timeout = connect_timeout if admission_timeout is None else admission_timeout

    def compile(self, request: CompileRequest) -> CompileResult:
        with self.prepare(request) as execute:
            return execute()

    @contextmanager
    def prepare(self, request: CompileRequest):
        """Reserve a validated job; closing without START never invokes the runner."""
        request_id = uuid.uuid4().bytes
        payload = {"job_id": request.job_id, "source": request.source, "limits": asdict(request.limits)}
        try:
            connection = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        except OSError as error:
            raise CompilerUnavailable("compiler sidecar socket is unavailable") from error
        with connection:
            try:
                connection.settimeout(self.connect_timeout)
                connection.connect(self.socket_path)
                send_message(connection, request_id, payload)
                # A live peer may still be completing its bounded health probe.
                connection.settimeout(self.admission_timeout)
                receive_control(connection, request_id, READY)
            except (OSError, ProtocolError) as error:
                raise CompilerUnavailable("compiler sidecar is unavailable before acceptance") from error
            # Keep caller/admission exceptions outside the transport exception mapping.
            yield partial(self._execute, connection, request_id, request)

    @staticmethod
    def _execute(connection: socket.socket, request_id: bytes, request: CompileRequest) -> CompileResult:
        try:
            send_control(connection, request_id, START)
            connection.settimeout(request.limits.timeout_seconds + _RESPONSE_GRACE_SECONDS)
            response_id, response, pdf = receive_message(connection)
        except socket.timeout as error:
            raise CompilerTimeout("compiler sidecar response timed out") from error
        except ProtocolError as error:
            raise CompilerUnavailable("invalid compiler sidecar response") from error
        except OSError as error:
            raise CompilerUnavailable("compiler sidecar is unavailable") from error
        if response_id != request_id:
            raise CompilerUnavailable("mismatched compiler sidecar response")
        if "failure" in response:
            failure = _FAILURES.get(response["failure"], CompilerInternalError)
            raise failure(response["diagnostics"])
        if len(pdf) > request.limits.pdf_max_bytes:
            raise CompilerOutputError("compiler PDF exceeds configured limit")
        if len(response["diagnostics"].encode("utf-8")) > request.limits.diagnostics_max_bytes:
            raise CompilerOutputError("compiler diagnostics exceed configured limit")
        return CompileResult(pdf=pdf, diagnostics=response["diagnostics"])
