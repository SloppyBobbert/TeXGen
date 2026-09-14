"""Live Unix-socket protocol probe for the compiler sidecar health check."""

from __future__ import annotations

import socket
import sys
import uuid
from dataclasses import asdict

from api.compilation.types import CompileLimits
from compiler_sidecar.protocol import READY, START, ProtocolError, encode_frame, receive_control, receive_message, send_control
from compiler_sidecar.server import DEFAULT_SOCKET_PATH

_HEALTH_SOURCE = "\\documentclass{article}\n\\begin{document}\nhealthcheck\n\\end{document}\n"


# Allow one running job and this probe (15 seconds each), plus cleanup/framing time.
HEALTHCHECK_TIMEOUT_SECONDS = 40.0


def probe(socket_path: str = DEFAULT_SOCKET_PATH, timeout: float = HEALTHCHECK_TIMEOUT_SECONDS) -> None:
    """Compile a minimal document through the live sidecar protocol."""
    request_id = uuid.uuid4().bytes
    payload = {"job_id": "healthcheck", "source": _HEALTH_SOURCE, "limits": asdict(CompileLimits())}
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as connection:
        connection.settimeout(timeout)
        connection.connect(socket_path)
        connection.sendall(encode_frame(request_id, payload))
        receive_control(connection, request_id, READY)
        send_control(connection, request_id, START)
        response_id, response, pdf = receive_message(connection)
    if response_id != request_id or response.get("failure") or not pdf:
        raise RuntimeError("compiler sidecar health check failed")


def main() -> None:
    socket_path = sys.argv[1] if len(sys.argv) == 2 else DEFAULT_SOCKET_PATH
    if len(sys.argv) > 2:
        raise SystemExit("usage: healthcheck.py [SOCKET_PATH]")
    try:
        probe(socket_path)
    except (OSError, ProtocolError, RuntimeError) as error:
        raise SystemExit("compiler sidecar health check failed") from error


if __name__ == "__main__":
    main()
