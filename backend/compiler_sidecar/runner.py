"""Resource-limited Tectonic invocation for the isolated sidecar."""

import os
import re
import shutil
import signal
import stat
import subprocess
import tempfile
import time
from collections.abc import Callable
from pathlib import Path

from api.compilation.types import (
    CompileRequest,
    CompileResult,
    CompilerInternalError,
    CompilerOutputError,
    CompilerResourceLimit,
    CompilerSyntaxError,
    CompilerTimeout,
    CompilerUnavailable,
)

try:
    import resource
except ImportError:  # pragma: no cover - Windows does not provide resource.
    resource = None  # type: ignore[assignment]

LimitSetter = Callable[[CompileRequest], Callable[[], None] | None]

TECTONIC_WEB_BUNDLE = "https://relay.fullyjustified.net/default_bundle_v33.tar"
TECTONIC_EXECUTABLE = "/opt/compiler-assets/tectonic/tectonic"
_TECTONIC_FIXED_ARGS = ("--web-bundle", TECTONIC_WEB_BUNDLE, "--only-cached", "--untrusted")
_XMALLOC_RESOURCE_FAILURE = re.compile(
    r"(?m)^[^\S\r\n]*xmalloc request for [1-9][0-9]* bytes failed[^\S\r\n]*$"
)


class TectonicRunner:
    def __init__(
        self,
        executable: str = TECTONIC_EXECUTABLE,
        fixed_args: tuple[str, ...] = (),
        limit_setter: LimitSetter | None = None,
    ) -> None:
        self._executable = executable
        self._fixed_args = fixed_args
        self._limit_setter_factory = limit_setter or self._limit_setter

    def compile(self, request: CompileRequest) -> CompileResult:
        workspace = Path(tempfile.mkdtemp(prefix="texgen-"))
        failure: BaseException | None = None
        process: subprocess.Popen[bytes] | None = None
        try:
            source_path = workspace / "job.tex"
            output_path = workspace / "out"
            output_path.mkdir(mode=0o700)
            source_path.write_text(request.source, encoding="utf-8")
            diagnostics_path = workspace / "diagnostics.log"
            with diagnostics_path.open("xb") as diagnostics_file:
                try:
                    preexec_fn = self._limit_setter_factory(request)
                    process = subprocess.Popen(
                    [
                        self._executable,
                        *self._fixed_args,
                        *_TECTONIC_FIXED_ARGS,
                        "--outdir",
                        str(output_path),
                        str(source_path),
                    ],
                    cwd=workspace,
                    stdin=subprocess.DEVNULL,
                    stdout=diagnostics_file,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                    preexec_fn=preexec_fn,  # noqa: PLW1509 -- required for per-child resource limits.
                    )
                except FileNotFoundError as error:
                    raise CompilerUnavailable("compiler executable is unavailable") from error
                except (OSError, subprocess.SubprocessError) as error:
                    raise CompilerResourceLimit("compiler resource limits could not be applied") from error
                try:
                    process.wait(timeout=request.limits.timeout_seconds)
                except subprocess.TimeoutExpired:
                    raise CompilerTimeout("compiler timed out")
            with diagnostics_path.open("rb") as diagnostics_file:
                diagnostics = diagnostics_file.read(request.limits.diagnostics_max_bytes).decode("utf-8", "replace")
            resource_signals = tuple(
                -value for value in (getattr(signal, "SIGXCPU", None), getattr(signal, "SIGXFSZ", None)) if value
            )
            if process.returncode in (*resource_signals, -signal.SIGKILL, 137):
                # SIGKILL can indicate a resource failure; it does not prove OOM.
                raise CompilerResourceLimit(diagnostics or "compiler was killed or exceeded a resource limit")
            if process.returncode < 0:
                raise CompilerInternalError("compiler terminated by a signal")
            if _XMALLOC_RESOURCE_FAILURE.search(diagnostics):
                raise CompilerResourceLimit(diagnostics)
            if process.returncode != 0:
                raise CompilerSyntaxError(diagnostics or "compiler failed")
            return CompileResult(pdf=self._read_pdf(output_path / "job.pdf", request), diagnostics=diagnostics)
        except FileNotFoundError as error:
            failure = error
            raise CompilerUnavailable("compiler executable is unavailable") from error
        except BaseException as error:
            failure = error
            raise
        finally:
            if process is not None:
                try:
                    self._stop_process_group(process)
                except OSError:
                    if failure is None:
                        raise CompilerInternalError("compiler process cleanup failed")
            try:
                shutil.rmtree(workspace)
            except OSError as error:
                if failure is None:
                    raise CompilerInternalError("compiler workspace cleanup failed") from error

    @staticmethod
    def _read_pdf(path: Path, request: CompileRequest) -> bytes:
        flags = os.O_RDONLY | os.O_NONBLOCK | getattr(os, "O_NOFOLLOW", 0)
        try:
            descriptor = os.open(path, flags)
        except OSError as error:
            raise CompilerOutputError("compiler did not create a regular PDF") from error
        try:
            info = os.fstat(descriptor)
            if not stat.S_ISREG(info.st_mode) or info.st_size > request.limits.pdf_max_bytes:
                raise CompilerOutputError("compiler PDF is invalid or exceeds configured limit")
            pdf = os.read(descriptor, info.st_size)
            if len(pdf) != info.st_size:
                raise CompilerOutputError("compiler PDF could not be read safely")
            return pdf
        finally:
            os.close(descriptor)

    @staticmethod
    def _stop_process_group(process: subprocess.Popen[bytes]) -> None:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=1)
        except subprocess.TimeoutExpired:
            pass
        # The direct child can exit before descendants.  Always kill the group
        # after the bounded TERM grace rather than treating that as cleanup.
        time.sleep(0.1)
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        TectonicRunner._reap(process)

    @staticmethod
    def _reap(process: subprocess.Popen[bytes]) -> None:
        try:
            process.wait(timeout=1)
        except subprocess.TimeoutExpired as error:
            raise OSError("compiler process group could not be reaped") from error

    @staticmethod
    def _limit_setter(request: CompileRequest) -> Callable[[], None] | None:
        resource_module = resource
        if resource_module is None:
            raise CompilerResourceLimit("compiler resource limits are unavailable")
        limits = request.limits
        required_limits = ("RLIMIT_CPU", "RLIMIT_AS", "RLIMIT_FSIZE", "RLIMIT_NPROC", "RLIMIT_NOFILE")
        if any(getattr(resource_module, name, None) is None for name in required_limits):
            raise CompilerResourceLimit("compiler resource limits are unavailable")

        def apply_limits() -> None:
            for name, value in (
                ("RLIMIT_CPU", limits.cpu_seconds),
                ("RLIMIT_AS", limits.address_space_bytes),
                ("RLIMIT_FSIZE", limits.file_size_bytes),
                ("RLIMIT_NPROC", limits.process_count),
                ("RLIMIT_NOFILE", limits.open_files),
            ):
                limit = getattr(resource_module, name)
                resource_module.setrlimit(limit, (value, value))

        return apply_limits
