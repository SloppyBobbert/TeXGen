"""Fail-closed compiler selection point."""

from contextlib import contextmanager
from functools import partial
from typing import Protocol

from django.conf import settings

from .adapter import CompilerAdapter, LocalCompilerAdapter
from .sidecar import SidecarCompilerClient
from .types import CompileLimits, CompileRequest, CompileResult, CompilerUnavailable


class CompilerSelector(Protocol):
    def select(self) -> CompilerAdapter: ...


def compile_limits_from_settings():
    return CompileLimits(
        source_max_bytes=settings.COMPILER_SOURCE_MAX_BYTES,
        timeout_seconds=settings.COMPILER_TIMEOUT_SECONDS,
        pdf_max_bytes=settings.COMPILER_PDF_MAX_BYTES,
        diagnostics_max_bytes=settings.COMPILER_DIAGNOSTICS_MAX_BYTES,
        cpu_seconds=settings.COMPILER_CPU_SECONDS,
        address_space_bytes=settings.COMPILER_ADDRESS_SPACE_BYTES,
        file_size_bytes=settings.COMPILER_FILE_SIZE_BYTES,
        process_count=settings.COMPILER_PROCESS_COUNT,
        open_files=settings.COMPILER_OPEN_FILES,
    )


class UnavailableCompilerSelector:
    def select(self) -> CompilerAdapter:
        raise CompilerUnavailable("no compiler adapter is configured")


class SettingsCompilerSelector:
    """Select exactly the configured adapter; never silently downgrade."""

    def __init__(self, limits: CompileLimits) -> None:
        self._limits = limits

    def select(self) -> CompilerAdapter:
        backend = settings.COMPILER_BACKEND
        if backend == "disabled":
            raise CompilerUnavailable("compiler is disabled")
        if backend == "sidecar":
            return SidecarCompilerClient(settings.COMPILER_SIDECAR_SOCKET)
        if backend == "local":
            if not settings.DEBUG:
                raise CompilerUnavailable("local compiler is disabled outside DEBUG")
            from compiler_sidecar.runner import TectonicRunner

            return LocalCompilerAdapter(TectonicRunner())
        raise CompilerUnavailable("compiler adapter is unavailable")


class CompilerService:
    def __init__(self, selector: CompilerSelector) -> None:
        self._selector = selector

    def compile(self, request: CompileRequest) -> CompileResult:
        with self.prepare(request) as execute:
            return execute()

    @contextmanager
    def prepare(self, request: CompileRequest):
        """Own the selected job until execution or admission cancellation."""
        adapter = self._selector.select()
        if isinstance(adapter, SidecarCompilerClient):
            with adapter.prepare(request) as execute:
                yield execute
        else:
            yield partial(adapter.compile, request)
