import socket
from threading import Thread

import pytest

from compiler_sidecar.protocol import (
    HEADER_SIZE,
    MAX_DIAGNOSTICS_BYTES,
    MAX_FRAME_BYTES,
    MAX_REQUEST_METADATA_BYTES,
    MAX_SOURCE_BYTES,
    ProtocolError,
    decode_frame,
    encode_frame,
    encode_response,
    receive_message,
    receive_request,
)
from compiler_sidecar import protocol


def test_protocol_round_trips_versioned_request_with_fixed_request_id():
    request_id = b"0123456789abcdef"
    payload = {"job_id": "job-1", "source": "hello", "limits": {"timeout_seconds": 1}}

    frame = encode_frame(request_id, payload)

    assert len(frame[:HEADER_SIZE]) == HEADER_SIZE
    assert decode_frame(frame) == (request_id, payload)


def test_protocol_rejects_declared_oversized_payload_before_body_is_needed():
    header = (
        b"TXSC"
        + bytes([1, 1])
        + b"0123456789abcdef"
        + (MAX_FRAME_BYTES + 1).to_bytes(4, "big")
        + (0).to_bytes(4, "big")
    )

    with pytest.raises(ProtocolError, match="declared payload"):
        decode_frame(header)


def test_protocol_receives_fragmented_raw_pdf_larger_than_one_megabyte():
    left, right = socket.socketpair()
    request_id = b"0123456789abcdef"
    pdf = b"%PDF-1.7\n" + b"x" * (1_048_576 + 1)
    frame = encode_response(request_id, {"diagnostics": "ok"}, pdf)
    left.settimeout(1)
    right.settimeout(5)
    errors = []

    def send_fragments():
        try:
            for offset in range(0, len(frame), 17):
                left.sendall(frame[offset:offset + 17])
        except OSError as error:
            errors.append(error)

    sender = Thread(target=send_fragments)
    sender.start()
    try:
        response_id, metadata, received_pdf = receive_message(right)
    finally:
        left.close()
        right.close()
        sender.join(timeout=2)

    assert not sender.is_alive()
    assert errors == []
    assert response_id == request_id
    assert metadata == {"diagnostics": "ok"}
    assert received_pdf == pdf


def test_protocol_rejects_response_pdf_larger_than_approved_limit():
    with pytest.raises(ProtocolError, match="PDF"):
        encode_response(b"0123456789abcdef", {"diagnostics": ""}, b"x" * (10 * 1024 * 1024 + 1))


def test_protocol_accepts_worst_case_source_at_exact_maximum_and_metadata_fits():
    request_id = b"0123456789abcdef"
    source = "\x00" * MAX_SOURCE_BYTES
    payload = {"job_id": "job", "source": source, "limits": {}}

    frame = encode_frame(request_id, payload)

    assert len(frame) - HEADER_SIZE <= MAX_REQUEST_METADATA_BYTES
    assert decode_frame(frame) == (request_id, payload)


@pytest.mark.parametrize("character", ["\x00", "\t", "\n"])
def test_response_round_trips_maximum_escaped_diagnostics(character):
    left, right = socket.socketpair()
    payload = {"diagnostics": character * MAX_DIAGNOSTICS_BYTES}
    frame = encode_response(b"0123456789abcdef", payload, b"%PDF-1.7")
    left.settimeout(1)
    right.settimeout(1)
    sender = Thread(target=left.sendall, args=(frame,))
    sender.start()
    try:
        assert receive_message(right) == (b"0123456789abcdef", payload, b"%PDF-1.7")
    finally:
        left.close()
        right.close()
        sender.join(timeout=2)
    assert not sender.is_alive()


@pytest.mark.parametrize("response, drip_stage", [
    (False, "header"), (True, "header"),
    (False, "metadata"), (True, "metadata"), (True, "pdf"),
])
def test_receive_uses_one_deadline_across_all_chunks(monkeypatch, response, drip_stage):
    frame = (
        encode_response(b"0123456789abcdef", {"diagnostics": "ok"}, b"%PDF-1.7")
        if response else encode_frame(b"0123456789abcdef", {"job_id": "x", "source": "x", "limits": {}})
    )
    now = [0.0]
    monkeypatch.setattr(protocol.time, "monotonic", lambda: now[0])
    start = {"header": 0, "metadata": HEADER_SIZE, "pdf": len(frame) - len(b"%PDF-1.7")}[drip_stage]

    class DripSocket:
        timeout = 0.1
        offset = 0

        def gettimeout(self):
            return self.timeout

        def settimeout(self, value):
            self.timeout = value

        def recv(self, size):
            # Every byte arrives within the original per-recv timeout.
            delay = 0.04 if self.offset >= start else 0.0
            if delay >= self.timeout:
                raise TimeoutError
            now[0] += delay
            chunk = frame[self.offset:self.offset + 1]
            self.offset += len(chunk)
            return chunk

    connection = DripSocket()
    with pytest.raises(TimeoutError):
        (receive_message if response else receive_request)(connection)
    assert connection.offset < len(frame)
    assert connection.timeout == 0.1


def test_protocol_rejects_source_one_byte_over_maximum():
    with pytest.raises(ProtocolError, match="source"):
        encode_frame(
            b"0123456789abcdef",
            {"job_id": "job", "source": "x" * (MAX_SOURCE_BYTES + 1), "limits": {}},
        )
