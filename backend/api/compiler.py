import os
import signal
import stat
import subprocess
import threading
import time
from collections import defaultdict, deque
from ipaddress import ip_address
from itertools import islice
from pathlib import Path

from django.conf import settings


class CompilationFailure(Exception):
    pass


class CompilationTimedOut(CompilationFailure):
    pass


class CompilationCapacityExceeded(CompilationFailure):
    pass


class CompilationRateLimited(CompilationFailure):
    pass


_compile_lock = threading.Lock()
# These guards are intentionally process-local; the production image uses one worker.
_compile_attempts = defaultdict(deque)
_compile_slots = None
_compile_slot_count = None
RATE_LIMIT_PRUNE_BATCH_SIZE = 100


def rate_limit_peer_key(remote_addr):
    """Use the direct peer only; Render may make this a shared proxy bucket."""
    try:
        return f"peer:{ip_address(remote_addr).compressed}"
    except (TypeError, ValueError):
        return "peer:unknown"


def tectonic_command(tex_file_path, output_dir):
    return [
        "tectonic",
        "--untrusted",
        "--only-cached",
        "--outdir",
        output_dir,
        tex_file_path,
    ]


def prlimit_command(tex_file_path, output_dir):
    limits = (
        ("cpu", settings.LATEX_COMPILE_CPU_SECONDS),
        ("as", settings.LATEX_MEMORY_LIMIT_BYTES),
        ("fsize", settings.LATEX_COMPILE_FILE_SIZE_BYTES),
        ("nproc", settings.LATEX_COMPILE_PROCESS_LIMIT),
    )
    return [
        "prlimit",
        *(f"--{name}={value}:{value}" for name, value in limits),
        "--",
        *tectonic_command(tex_file_path, output_dir),
    ]


def compiler_environment(cache_dir):
    return {
        "HOME": "/tmp",
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "TMPDIR": "/tmp",
        "XDG_CACHE_HOME": cache_dir,
    }


def _copy_regular_file(source, destination):
    source_fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        if not stat.S_ISREG(os.fstat(source_fd).st_mode):
            raise OSError("cache seed contains a non-regular file")
        destination_fd = os.open(
            destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600
        )
        try:
            while chunk := os.read(source_fd, 65536):
                remaining = memoryview(chunk)
                while remaining:
                    written = os.write(destination_fd, remaining)
                    if written <= 0:
                        raise OSError("cache seed write failed")
                    remaining = remaining[written:]
        finally:
            os.close(destination_fd)
    finally:
        os.close(source_fd)


def _copy_cache_tree(source, destination):
    for entry in os.scandir(source):
        if entry.is_symlink():
            raise OSError("cache seed contains a symlink")
        destination_entry = destination / entry.name
        if entry.is_dir(follow_symlinks=False):
            destination_entry.mkdir(mode=0o700)
            _copy_cache_tree(Path(entry.path), destination_entry)
        elif entry.is_file(follow_symlinks=False):
            _copy_regular_file(entry.path, destination_entry)
        else:
            raise OSError("cache seed contains an unsupported file")


def create_request_cache(output_dir):
    seed = Path(settings.TECTONIC_CACHE_SEED_DIR)
    request_cache = Path(output_dir) / "tectonic-cache"
    try:
        if seed.is_symlink() or not seed.is_dir() or not os.access(seed, os.R_OK | os.X_OK):
            raise OSError("cache seed is unavailable")
        request_cache.mkdir(mode=0o700)
        _copy_cache_tree(seed, request_cache)
    except OSError as exc:
        raise CompilationFailure("Tectonic cache seed is unavailable.") from exc
    return str(request_cache)


def _diagnostic(path):
    with open(path, "rb") as output:
        content = output.read(settings.LATEX_COMPILE_DIAGNOSTIC_BYTES + 1)
    truncated = len(content) > settings.LATEX_COMPILE_DIAGNOSTIC_BYTES
    content = content[: settings.LATEX_COMPILE_DIAGNOSTIC_BYTES]
    message = content.decode("utf-8", errors="replace").strip()
    if truncated:
        message += "\n[compiler diagnostics truncated]"
    return message or "LaTeX compilation failed without additional output."


def _slot_semaphore():
    global _compile_slots, _compile_slot_count
    with _compile_lock:
        if _compile_slots is None or _compile_slot_count != settings.LATEX_COMPILE_MAX_CONCURRENT:
            _compile_slot_count = settings.LATEX_COMPILE_MAX_CONCURRENT
            _compile_slots = threading.BoundedSemaphore(_compile_slot_count)
        return _compile_slots


def acquire_compile_slot(client_ip):
    now = time.monotonic()
    with _compile_lock:
        cutoff = now - settings.LATEX_COMPILE_RATE_WINDOW_SECONDS
        for stale_client in tuple(islice(_compile_attempts, RATE_LIMIT_PRUNE_BATCH_SIZE)):
            stale_attempts = _compile_attempts[stale_client]
            while stale_attempts and stale_attempts[0] <= cutoff:
                stale_attempts.popleft()
            if not stale_attempts:
                del _compile_attempts[stale_client]

        attempts = _compile_attempts[client_ip]
        while attempts and attempts[0] <= cutoff:
            attempts.popleft()
        if len(attempts) >= settings.LATEX_COMPILE_RATE_LIMIT:
            raise CompilationRateLimited()
        attempts.append(now)

    slots = _slot_semaphore()
    if not slots.acquire(blocking=False):
        raise CompilationCapacityExceeded()
    return slots


def reset_compile_guards():
    global _compile_slots, _compile_slot_count
    with _compile_lock:
        _compile_attempts.clear()
        _compile_slots = None
        _compile_slot_count = None


def compile_tex(tex_file_path, output_dir, diagnostic_path):
    request_cache = create_request_cache(output_dir)
    with open(diagnostic_path, "wb") as diagnostic_file:
        try:
            process = subprocess.Popen(
                prlimit_command(tex_file_path, output_dir),
                cwd=output_dir,
                env=compiler_environment(request_cache),
                stdout=diagnostic_file,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
        except FileNotFoundError:
            raise

        try:
            return_code = process.wait(timeout=settings.LATEX_COMPILE_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired as exc:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()
            raise CompilationTimedOut("LaTeX compilation timed out.") from exc

    if return_code:
        raise CompilationFailure(_diagnostic(diagnostic_path))
