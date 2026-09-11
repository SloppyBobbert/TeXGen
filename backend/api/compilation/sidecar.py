"""Unix-domain-socket adapter for the isolated compiler sidecar."""

import socket
import uuid
from dataclasses import asdict

from compiler_sidecar.protocol import ProtocolError, receive_message, send_message

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
    def __init__(self, socket_path: str, connect_timeout: float = 1.0) -> None:
        self.socket_path = socket_path
        self.connect_timeout = connect_timeout

    def compile(self, request: CompileRequest) -> CompileResult:
        request_id = uuid.uuid4().bytes
        payload = {"job_id": request.job_id, "source": request.source, "limits": asdict(request.limits)}
        try:
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as connection:
                connection.settimeout(self.connect_timeout)
                try:
                    connection.connect(self.socket_path)
                except (OSError, TimeoutError) as error:
                    raise CompilerUnavailable("compiler sidecar is unavailable") from error
                connection.settimeout(request.limits.timeout_seconds + _RESPONSE_GRACE_SECONDS)
                send_message(connection, request_id, payload)
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
        try:
            if len(pdf) > request.limits.pdf_max_bytes:
                raise CompilerOutputError("compiler PDF exceeds configured limit")
            if len(response["diagnostics"].encode("utf-8")) > request.limits.diagnostics_max_bytes:
                raise CompilerOutputError("compiler diagnostics exceed configured limit")
            return CompileResult(pdf=pdf, diagnostics=response["diagnostics"])
        except (KeyError, TypeError) as error:
            raise CompilerUnavailable("invalid compiler sidecar response") from error
