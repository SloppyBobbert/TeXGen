import subprocess
from collections import deque
from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings

from api import compiler


@pytest.fixture(autouse=True)
def clear_compile_guards(tmp_path):
    compiler.reset_compile_guards()
    seed = tmp_path / "seed"
    seed.mkdir()
    (seed / "Tectonic").mkdir()
    (seed / "Tectonic" / "seed-file").write_text("seed")
    with override_settings(TECTONIC_CACHE_SEED_DIR=str(seed)):
        yield seed
    compiler.reset_compile_guards()


def test_tectonic_command_uses_offline_untrusted_output_directory():
    assert compiler.tectonic_command("input.tex", "output") == [
        "tectonic",
        "--untrusted",
        "--only-cached",
        "--outdir",
        "output",
        "input.tex",
    ]


@pytest.mark.parametrize(
    ("remote_addr", "expected"),
    [
        ("192.0.2.1", "peer:192.0.2.1"),
        ("2001:0DB8:0:0:0:0:0:1", "peer:2001:db8::1"),
        ("not-an-ip", "peer:unknown"),
        (None, "peer:unknown"),
    ],
)
def test_rate_limit_peer_key_validates_and_canonicalizes(remote_addr, expected):
    assert compiler.rate_limit_peer_key(remote_addr) == expected


def test_rate_limit_peer_key_ignores_forwarded_headers():
    request_metadata = {
        "REMOTE_ADDR": "198.51.100.4",
        "HTTP_X_FORWARDED_FOR": "203.0.113.7",
        "HTTP_X_REAL_IP": "203.0.113.8",
    }

    assert compiler.rate_limit_peer_key(request_metadata["REMOTE_ADDR"]) == "peer:198.51.100.4"


@override_settings(
    LATEX_COMPILE_CPU_SECONDS=2,
    LATEX_MEMORY_LIMIT_BYTES=3,
    LATEX_COMPILE_FILE_SIZE_BYTES=4,
    LATEX_COMPILE_PROCESS_LIMIT=5,
)
def test_prlimit_command_enforces_all_compiler_limits():
    assert compiler.prlimit_command("input.tex", "output") == [
        "prlimit",
        "--cpu=2:2",
        "--as=3:3",
        "--fsize=4:4",
        "--nproc=5:5",
        "--",
        "tectonic",
        "--untrusted",
        "--only-cached",
        "--outdir",
        "output",
        "input.tex",
    ]


@override_settings(TECTONIC_CACHE_SEED_DIR="/cache")
def test_compiler_environment_is_scrubbed(monkeypatch):
    monkeypatch.setenv("SECRET_VALUE", "must-not-reach-tectonic")

    assert compiler.compiler_environment("/private-cache") == {
        "HOME": "/tmp",
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "TMPDIR": "/tmp",
        "XDG_CACHE_HOME": "/private-cache",
    }


@patch("api.compiler.os.killpg")
@patch("api.compiler.subprocess.Popen")
def test_compile_timeout_terminates_process_group(mock_popen, mock_killpg, tmp_path):
    process = MagicMock()
    process.pid = 123
    process.wait.side_effect = [subprocess.TimeoutExpired("tectonic", 1), 0]
    mock_popen.return_value = process

    with pytest.raises(compiler.CompilationTimedOut):
        compiler.compile_tex(
            str(tmp_path / "document.tex"),
            str(tmp_path),
            str(tmp_path / "tectonic.log"),
        )

    assert mock_popen.call_args.kwargs["start_new_session"] is True
    assert "preexec_fn" not in mock_popen.call_args.kwargs
    assert mock_popen.call_args.kwargs["env"]["XDG_CACHE_HOME"] == str(
        tmp_path / "tectonic-cache"
    )
    mock_killpg.assert_called_once_with(123, compiler.signal.SIGKILL)


@patch("api.compiler.subprocess.Popen")
def test_compile_failure_diagnostics_are_bounded(mock_popen, tmp_path):
    process = MagicMock()
    process.wait.return_value = 1

    def write_diagnostic(*_args, **kwargs):
        kwargs["stdout"].write(b"x" * 20)
        return process

    mock_popen.side_effect = write_diagnostic

    diagnostic_path = tmp_path / "tectonic.log"

    with override_settings(LATEX_COMPILE_DIAGNOSTIC_BYTES=10):
        with pytest.raises(compiler.CompilationFailure, match="truncated"):
            compiler.compile_tex(
                str(tmp_path / "document.tex"), str(tmp_path), str(diagnostic_path)
            )


@override_settings(LATEX_COMPILE_RATE_LIMIT=1, LATEX_COMPILE_RATE_WINDOW_SECONDS=60)
def test_compile_throttle_limits_repeated_ip():
    slot = compiler.acquire_compile_slot("127.0.0.1")
    slot.release()

    with pytest.raises(compiler.CompilationRateLimited):
        compiler.acquire_compile_slot("127.0.0.1")


@override_settings(LATEX_COMPILE_MAX_CONCURRENT=1, LATEX_COMPILE_RATE_LIMIT=10)
def test_compile_concurrency_cap_rejects_second_ip():
    slot = compiler.acquire_compile_slot("127.0.0.1")
    try:
        with pytest.raises(compiler.CompilationCapacityExceeded):
            compiler.acquire_compile_slot("127.0.0.2")
    finally:
        slot.release()


def test_positive_integer_environment_parser_is_strict(monkeypatch):
    from cheat_sheet.settings import env_positive_int

    monkeypatch.setenv("TEST_LIMIT", "-1")
    assert env_positive_int("TEST_LIMIT", 5) == 5
    monkeypatch.setenv("TEST_LIMIT", " 2")
    assert env_positive_int("TEST_LIMIT", 5) == 5
    monkeypatch.setenv("TEST_LIMIT", "2")
    assert env_positive_int("TEST_LIMIT", 5) == 2


def test_default_memory_limit_is_320_mib():
    from cheat_sheet.settings import DEFAULT_LATEX_MEMORY_LIMIT_BYTES

    assert DEFAULT_LATEX_MEMORY_LIMIT_BYTES == 320 * 1024 * 1024


@patch("api.compiler.subprocess.Popen")
def test_each_compile_uses_a_distinct_private_cache(mock_popen, tmp_path, clear_compile_guards):
    process = MagicMock()
    process.wait.return_value = 0
    mock_popen.return_value = process
    first_output = tmp_path / "first-output"
    second_output = tmp_path / "second-output"
    first_output.mkdir()
    second_output.mkdir()

    compiler.compile_tex("input.tex", str(first_output), str(tmp_path / "first.log"))
    compiler.compile_tex("input.tex", str(second_output), str(tmp_path / "second.log"))

    first_cache = first_output / "tectonic-cache"
    second_cache = second_output / "tectonic-cache"
    assert first_cache != second_cache
    assert (first_cache / "Tectonic" / "seed-file").read_text() == "seed"
    assert (second_cache / "Tectonic" / "seed-file").read_text() == "seed"
    assert mock_popen.call_args_list[0].kwargs["env"]["XDG_CACHE_HOME"] == str(
        first_cache
    )
    assert mock_popen.call_args_list[1].kwargs["env"]["XDG_CACHE_HOME"] == str(
        second_cache
    )
    assert (clear_compile_guards / "Tectonic" / "seed-file").read_text() == "seed"


@patch("api.compiler.subprocess.Popen")
def test_cache_seed_copy_errors_fail_closed(mock_popen, tmp_path):
    seed = tmp_path / "unsafe-seed"
    seed.mkdir()
    (seed / "unsafe-link").symlink_to(tmp_path / "missing")
    output_dir = tmp_path / "output"
    output_dir.mkdir()

    with override_settings(TECTONIC_CACHE_SEED_DIR=str(seed)):
        with pytest.raises(compiler.CompilationFailure, match="seed is unavailable"):
            compiler.compile_tex("input.tex", str(output_dir), str(tmp_path / "log"))

    mock_popen.assert_not_called()


def test_cache_copy_retries_short_writes(monkeypatch, tmp_path):
    source = tmp_path / "source"
    destination = tmp_path / "destination"
    source.write_bytes(b"copy this data")
    real_write = compiler.os.write
    writes = []

    def short_first_write(file_descriptor, data):
        writes.append(len(data))
        if len(writes) == 1:
            return real_write(file_descriptor, data[:1])
        return real_write(file_descriptor, data)

    monkeypatch.setattr(compiler.os, "write", short_first_write)

    compiler._copy_regular_file(source, destination)

    assert len(writes) > 1
    assert destination.read_bytes() == source.read_bytes()


def test_rate_limit_pruning_removes_expired_clients(monkeypatch):
    compiler._compile_attempts["expired"] = deque([1])
    monkeypatch.setattr(compiler.time, "monotonic", lambda: 100)

    slot = compiler.acquire_compile_slot("current")
    slot.release()

    assert "expired" not in compiler._compile_attempts
