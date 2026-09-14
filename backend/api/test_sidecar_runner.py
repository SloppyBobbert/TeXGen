import os
import signal
import subprocess
import sys
import time

import pytest

from api.compilation.types import (
    CompileLimits,
    CompileRequest,
    CompilerInternalError,
    CompilerOutputError,
    CompilerResourceLimit,
    CompilerSyntaxError,
    CompilerTimeout,
)
from compiler_sidecar import runner
from compiler_sidecar.runner import TectonicRunner


def test_runner_uses_fixed_untrusted_arguments_and_returns_regular_pdf(tmp_path):
    script = tmp_path / "fake_tectonic.py"
    script.write_text(
        "import pathlib, sys\n"
        "args = sys.argv[1:]\n"
        "assert '--untrusted' in args and '--only-cached' in args\n"
        "outdir = pathlib.Path(args[args.index('--outdir') + 1])\n"
        "outdir.joinpath('job.pdf').write_bytes(b'%PDF-1.7 fake')\n"
    )
    request = CompileRequest("job", "\\documentclass{article}", CompileLimits(timeout_seconds=2))

    result = TectonicRunner(sys.executable, (str(script),), limit_setter=lambda _: None).compile(request)

    assert result.pdf == b"%PDF-1.7 fake"


def test_linux_limit_setter_configures_every_required_rlimit(monkeypatch):
    calls = []

    class FakeResource:
        RLIMIT_CPU = 1
        RLIMIT_AS = 2
        RLIMIT_FSIZE = 3
        RLIMIT_NPROC = 4
        RLIMIT_NOFILE = 5

        @staticmethod
        def setrlimit(limit, values):
            calls.append((limit, values))

    monkeypatch.setattr(runner, "resource", FakeResource)
    limits = CompileLimits()

    TectonicRunner._limit_setter(CompileRequest("job", "x", limits))()

    assert [limit for limit, _ in calls] == [1, 2, 3, 4, 5]
    assert calls[1] == (FakeResource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))


@pytest.mark.parametrize("resource_module", (None, object()))
def test_default_limit_setter_fails_closed_without_all_required_rlimits(monkeypatch, resource_module):
    monkeypatch.setattr(runner, "resource", resource_module)

    with pytest.raises(CompilerResourceLimit):
        TectonicRunner._limit_setter(CompileRequest("job", "x", CompileLimits()))


def test_limit_setup_failure_is_typed():
    with pytest.raises(CompilerResourceLimit):
        TectonicRunner("missing", limit_setter=lambda _: _raise_limit_error).compile(
            CompileRequest("job", "x", CompileLimits())
        )


def test_runner_bounds_flooded_diagnostics_without_a_pipe_and_removes_workspace(tmp_path, monkeypatch):
    script = tmp_path / "fake_tectonic.py"
    script.write_text(
        "import pathlib, sys\n"
        "outdir = pathlib.Path(sys.argv[sys.argv.index('--outdir') + 1])\n"
        "outdir.joinpath('job.pdf').write_bytes(b'%PDF-1.7 fake')\n"
        "sys.stdout.write('x' * 10000)\n"
    )
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    real_mkdtemp = runner.tempfile.mkdtemp
    monkeypatch.setattr(runner.tempfile, "mkdtemp", lambda **_: str(workspace))
    observed = {}
    real_popen = runner.subprocess.Popen

    def popen(*args, **kwargs):
        observed.update(kwargs)
        return real_popen(*args, **kwargs)

    monkeypatch.setattr(runner.subprocess, "Popen", popen)
    request = CompileRequest("job", "x", CompileLimits(diagnostics_max_bytes=10, timeout_seconds=2))

    result = TectonicRunner(sys.executable, (str(script),), limit_setter=lambda _: None).compile(request)

    assert result.diagnostics == "x" * 10
    assert observed["stdout"] is not runner.subprocess.PIPE
    assert observed["stderr"] is not runner.subprocess.PIPE
    assert not workspace.exists()
    monkeypatch.setattr(runner.tempfile, "mkdtemp", real_mkdtemp)


def test_runner_bounds_flooded_failure_diagnostics(tmp_path):
    script = tmp_path / "fake_tectonic.py"
    script.write_text("import sys\nsys.stdout.write('x' * 10000)\nsys.exit(1)\n")
    request = CompileRequest("job", "x", CompileLimits(diagnostics_max_bytes=10, timeout_seconds=2))

    with pytest.raises(CompilerSyntaxError, match="^xxxxxxxxxx$"):
        TectonicRunner(sys.executable, (str(script),), limit_setter=lambda _: None).compile(request)


def test_runner_classifies_exact_xmalloc_diagnostic_as_resource_limit(tmp_path):
    script = tmp_path / "fake_tectonic.py"
    script.write_text("import sys\nprint('  xmalloc request for 64000008 bytes failed  ')\nsys.exit(1)\n")

    with pytest.raises(CompilerResourceLimit, match="xmalloc request for 64000008 bytes failed"):
        TectonicRunner(sys.executable, (str(script),), limit_setter=lambda _: None).compile(
            CompileRequest("job", "x", CompileLimits(timeout_seconds=2))
        )


@pytest.mark.parametrize(
    "diagnostic",
    (
        "xmalloc request for 0 bytes failed",
        "xmalloc request for 12 bytes failed unexpectedly",
        "error: xmalloc request for 12 bytes failed",
        "prose xmalloc request for 12 bytes failed",
    ),
)
def test_runner_keeps_non_exact_xmalloc_diagnostics_as_syntax_errors(tmp_path, diagnostic):
    script = tmp_path / "fake_tectonic.py"
    script.write_text(f"import sys\nprint({diagnostic!r})\nsys.exit(1)\n")

    with pytest.raises(CompilerSyntaxError, match="compiler failed|xmalloc"):
        TectonicRunner(sys.executable, (str(script),), limit_setter=lambda _: None).compile(
            CompileRequest("job", "x", CompileLimits(timeout_seconds=2))
        )


def test_read_pdf_rejects_symlink_and_never_reads_more_than_stat_size(tmp_path, monkeypatch):
    target = tmp_path / "target.pdf"
    target.write_bytes(b"%PDF-1.7" + b"x" * 100)
    link = tmp_path / "job.pdf"
    link.symlink_to(target)
    request = CompileRequest("job", "x", CompileLimits(pdf_max_bytes=200))

    with pytest.raises(CompilerOutputError):
        TectonicRunner._read_pdf(link, request)

    pdf = tmp_path / "regular.pdf"
    pdf.write_bytes(b"%PDF-1.7")
    reads = []
    real_read = os.read
    monkeypatch.setattr(runner.os, "read", lambda fd, amount: reads.append(amount) or real_read(fd, amount))
    assert TectonicRunner._read_pdf(pdf, request) == b"%PDF-1.7"
    assert reads == [len(b"%PDF-1.7")]


@pytest.mark.skipif(os.name != "posix", reason="process groups require POSIX")
def test_runner_kills_descendant_after_leader_exits_on_sigterm(tmp_path):
    pid_file = tmp_path / "descendant.pid"
    script = tmp_path / "fake_tectonic.py"
    script.write_text(
        "import os, pathlib, signal, sys, time\n"
        "outdir = pathlib.Path(sys.argv[sys.argv.index('--outdir') + 1])\n"
        "outdir.joinpath('job.pdf').write_bytes(b'%PDF-1.7 fake')\n"
        f"pid_file = pathlib.Path({str(pid_file)!r})\n"
        "pid = os.fork()\n"
        "if pid:\n"
        "    pid_file.write_text(str(pid))\n"
        "    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))\n"
        "    time.sleep(30)\n"
        "else:\n"
        "    signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
        "    time.sleep(30)\n"
    )
    request = CompileRequest("job", "x", CompileLimits(timeout_seconds=0.1))

    with pytest.raises(CompilerTimeout):
        TectonicRunner(sys.executable, (str(script),), limit_setter=lambda _: None).compile(request)

    descendant = int(pid_file.read_text())
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        try:
            os.kill(descendant, 0)
        except ProcessLookupError:
            break
        time.sleep(0.02)
    else:
        pytest.fail("descendant survived process group cleanup")


def test_runner_cleans_process_group_when_pdf_validation_fails(tmp_path, monkeypatch):
    script = tmp_path / "fake_tectonic.py"
    script.write_text(
        "import pathlib, sys\n"
        "outdir = pathlib.Path(sys.argv[sys.argv.index('--outdir') + 1])\n"
        "outdir.joinpath('job.pdf').write_bytes(b'%PDF-1.7 fake')\n"
    )
    stopped = []
    monkeypatch.setattr(TectonicRunner, "_read_pdf", lambda *_: (_ for _ in ()).throw(CompilerOutputError("bad")))
    monkeypatch.setattr(TectonicRunner, "_stop_process_group", lambda _, process: stopped.append(process.pid))

    with pytest.raises(CompilerOutputError):
        TectonicRunner(sys.executable, (str(script),), limit_setter=lambda _: None).compile(
            CompileRequest("job", "x", CompileLimits(timeout_seconds=2))
        )

    assert stopped


@pytest.mark.parametrize("child_signal, failure", [(signal.SIGKILL, CompilerResourceLimit), (signal.SIGTERM, CompilerInternalError)])
def test_runner_classifies_direct_child_signal(tmp_path, child_signal, failure):
    script = tmp_path / "signaled_child.py"
    script.write_text(f"import os\nos.kill(os.getpid(), {int(child_signal)})\n")
    with pytest.raises(failure):
        TectonicRunner(sys.executable, (str(script),), limit_setter=lambda _: None).compile(
            CompileRequest("signal-test", "x", CompileLimits(timeout_seconds=2))
        )


def test_pdf_fifo_is_rejected_without_blocking(tmp_path):
    fifo = tmp_path / "job.pdf"
    os.mkfifo(fifo)
    result = subprocess.run(
        [sys.executable, "-c", "\n".join([
            "from pathlib import Path",
            "from compiler_sidecar.runner import TectonicRunner",
            "from api.compilation.types import CompileRequest, CompileLimits, CompilerOutputError",
            "try:",
            f"    TectonicRunner._read_pdf(Path({str(fifo)!r}), CompileRequest('fifo', 'x', CompileLimits()))",
            "except CompilerOutputError:",
            "    pass",
            "else:",
            "    raise AssertionError('FIFO accepted')",
        ])],
        timeout=2, capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr


def _raise_limit_error():
    raise OSError("cannot set limit")
