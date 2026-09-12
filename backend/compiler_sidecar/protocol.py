"""Versioned, bounded framing for the sidecar's Unix socket."""

import json
import socket
import struct
import time
from typing import Any

MAGIC = b"TXSC"
# Version 2 requires READY/START; a v1 server must reject jobs before execution.
VERSION = 2
REQUEST = 1
RESPONSE = 2
READY = 3
START = 4
REQUEST_ID_BYTES = 16
MAX_SOURCE_BYTES = 256 * 1024
MAX_PDF_BYTES = 10 * 1024 * 1024
MAX_DIAGNOSTICS_BYTES = 4 * 1024
# JSON represents each control byte as a six-byte ``\u00XX`` escape.  The
# fixed envelope is deliberately larger than that worst case plus limits.
MAX_REQUEST_METADATA_BYTES = MAX_SOURCE_BYTES * 6 + 16 * 1024
MAX_RESPONSE_METADATA_BYTES = MAX_DIAGNOSTICS_BYTES * 6 + 1024
MAX_FRAME_BYTES = MAX_REQUEST_METADATA_BYTES + MAX_PDF_BYTES
_HEADER = struct.Struct("!4sBB16sII")
HEADER_SIZE = _HEADER.size
DEFAULT_IO_TIMEOUT_SECONDS = 2.0


class ProtocolError(Exception):
    pass


def _encode_metadata(payload: dict[str, Any], maximum: int) -> bytes:
    try:
        metadata = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    except (TypeError, ValueError, UnicodeEncodeError) as error:
        raise ProtocolError("payload cannot be encoded") from error
    if len(metadata) > maximum:
        raise ProtocolError("declared metadata exceeds maximum size")
    return metadata


def _encode(request_id: bytes, payload: dict[str, Any], message_type: int, pdf: bytes = b"") -> bytes:
    if len(request_id) != REQUEST_ID_BYTES:
        raise ProtocolError("request id has invalid size")
    if message_type == REQUEST:
        _validate_request(payload)
        metadata = _encode_metadata(payload, MAX_REQUEST_METADATA_BYTES)
        if pdf:
            raise ProtocolError("request cannot contain PDF bytes")
    elif message_type == RESPONSE:
        _validate_response(payload, pdf)
        metadata = _encode_metadata(payload, MAX_RESPONSE_METADATA_BYTES)
    elif message_type in (READY, START):
        if payload or pdf:
            raise ProtocolError("control frame must be empty")
        metadata = b""
    else:
        raise ProtocolError("unsupported message type")
    return _HEADER.pack(MAGIC, VERSION, message_type, request_id, len(metadata), len(pdf)) + metadata + pdf


def encode_frame(request_id: bytes, payload: dict[str, Any]) -> bytes:
    return _encode(request_id, payload, REQUEST)


def encode_response(request_id: bytes, payload: dict[str, Any], pdf: bytes = b"") -> bytes:
    return _encode(request_id, payload, RESPONSE, pdf)


def _parse_header(header: bytes) -> tuple[int, bytes, int, int]:
    if len(header) != HEADER_SIZE:
        raise ProtocolError("incomplete header")
    magic, version, message_type, request_id, metadata_length, pdf_length = _HEADER.unpack(header)
    if magic != MAGIC or version != VERSION or message_type not in (REQUEST, RESPONSE, READY, START):
        raise ProtocolError("unsupported protocol header")
    if message_type == REQUEST:
        if metadata_length > MAX_REQUEST_METADATA_BYTES or pdf_length:
            raise ProtocolError("declared payload exceeds maximum size")
    elif message_type in (READY, START):
        if metadata_length or pdf_length:
            raise ProtocolError("control frame must be empty")
    elif metadata_length > MAX_RESPONSE_METADATA_BYTES or pdf_length > MAX_PDF_BYTES:
        raise ProtocolError("declared PDF or metadata exceeds maximum size")
    return message_type, request_id, metadata_length, pdf_length


def _decode(header: bytes, metadata: bytes, pdf: bytes) -> tuple[int, bytes, dict[str, Any], bytes]:
    message_type, request_id, metadata_length, pdf_length = _parse_header(header)
    if len(metadata) != metadata_length or len(pdf) != pdf_length:
        raise ProtocolError("incomplete payload")
    if message_type in (READY, START):
        return message_type, request_id, {}, b""
    try:
        payload = json.loads(metadata.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ProtocolError("invalid JSON metadata") from error
    if message_type == REQUEST:
        _validate_request(payload)
    else:
        _validate_response(payload, pdf)
    return message_type, request_id, payload, pdf


def decode_frame(frame: bytes) -> tuple[bytes, dict[str, Any]]:
    if len(frame) < HEADER_SIZE:
        raise ProtocolError("incomplete header")
    message_type, request_id, metadata_length, pdf_length = _parse_header(frame[:HEADER_SIZE])
    if message_type != REQUEST:
        raise ProtocolError("expected request frame")
    _, decoded_id, payload, _ = _decode(
        frame[:HEADER_SIZE], frame[HEADER_SIZE : HEADER_SIZE + metadata_length], frame[HEADER_SIZE + metadata_length :]
    )
    if decoded_id != request_id or pdf_length:
        raise ProtocolError("invalid request frame")
    return request_id, payload


def _recv_exact(connection: socket.socket, length: int, deadline: float) -> bytes:
    chunks: list[bytes] = []
    while length:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("frame reception timed out")
        connection.settimeout(remaining)
        chunk = connection.recv(length)
        if not chunk:
            raise ProtocolError("unexpected end of stream")
        chunks.append(chunk)
        length -= len(chunk)
    return b"".join(chunks)


def receive_message(connection: socket.socket) -> tuple[bytes, dict[str, Any], bytes]:
    return _receive(connection, RESPONSE)


def receive_request(connection: socket.socket) -> tuple[bytes, dict[str, Any]]:
    request_id, payload, pdf = _receive(connection, REQUEST)
    if pdf:
        raise ProtocolError("request cannot contain PDF")
    return request_id, payload


def _receive(connection: socket.socket, expected_type: int) -> tuple[bytes, dict[str, Any], bytes]:
    timeout = connection.gettimeout()
    deadline = time.monotonic() + (DEFAULT_IO_TIMEOUT_SECONDS if timeout is None else timeout)
    try:
        header = _recv_exact(connection, HEADER_SIZE, deadline)
        message_type, request_id, metadata_length, pdf_length = _parse_header(header)
        if message_type != expected_type:
            raise ProtocolError("unexpected frame type")
        metadata = _recv_exact(connection, metadata_length, deadline)
        pdf = _recv_exact(connection, pdf_length, deadline)
    finally:
        connection.settimeout(timeout)
    _, decoded_id, payload, decoded_pdf = _decode(header, metadata, pdf)
    if decoded_id != request_id:
        raise ProtocolError("mismatched request id")
    return request_id, payload, decoded_pdf


def send_control(connection: socket.socket, request_id: bytes, message_type: int) -> None:
    if message_type not in (READY, START):
        raise ProtocolError("expected control frame")
    _send(connection, _encode(request_id, {}, message_type))


def receive_control(connection: socket.socket, request_id: bytes, message_type: int) -> None:
    if message_type not in (READY, START):
        raise ProtocolError("expected control frame")
    received_id, _, _ = _receive(connection, message_type)
    if received_id != request_id:
        raise ProtocolError("mismatched control request id")


def send_message(connection: socket.socket, request_id: bytes, payload: dict[str, Any]) -> None:
    _send(connection, encode_frame(request_id, payload))


def send_response(connection: socket.socket, request_id: bytes, payload: dict[str, Any], pdf: bytes = b"") -> None:
    _send(connection, encode_response(request_id, payload, pdf))


def _send(connection: socket.socket, frame: bytes) -> None:
    timeout = connection.gettimeout()
    try:
        connection.settimeout(DEFAULT_IO_TIMEOUT_SECONDS if timeout is None else timeout)
        # sendall applies this timeout to the entire write, not to each partial send.
        connection.sendall(frame)
    finally:
        connection.settimeout(timeout)


def _validate_request(payload: object) -> None:
    if not isinstance(payload, dict) or set(payload) != {"job_id", "source", "limits"}:
        raise ProtocolError("invalid request metadata")
    source = payload["source"]
    if not isinstance(source, str) or len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
        raise ProtocolError("source exceeds maximum size")


def _validate_response(payload: object, pdf: bytes) -> None:
    if not isinstance(payload, dict):
        raise ProtocolError("invalid response metadata")
    diagnostics = payload.get("diagnostics", "")
    if not isinstance(diagnostics, str) or len(diagnostics.encode("utf-8")) > MAX_DIAGNOSTICS_BYTES:
        raise ProtocolError("diagnostics exceeds maximum size")
    if len(pdf) > MAX_PDF_BYTES:
        raise ProtocolError("PDF exceeds maximum size")
    if "failure" in payload:
        if set(payload) != {"failure", "diagnostics"} or not isinstance(payload["failure"], str) or pdf:
            raise ProtocolError("invalid failure response")
    elif set(payload) != {"diagnostics"} or not pdf:
        raise ProtocolError("invalid successful response")
