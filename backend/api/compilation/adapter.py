"""Compiler adapter boundary kept independent from Django settings."""

from collections.abc import Callable
from typing import Protocol, runtime_checkable

from .types import CompileRequest, CompileResult


@runtime_checkable
class CompilerAdapter(Protocol):
    def compile(self, request: CompileRequest) -> CompileResult: ...


class LocalCompilerAdapter:
    """Adapter for a runner hosted in the application process."""

    def __init__(self, runner: Callable[[CompileRequest], CompileResult] | CompilerAdapter) -> None:
        self._runner = runner

    def compile(self, request: CompileRequest) -> CompileResult:
        if isinstance(self._runner, CompilerAdapter):
            return self._runner.compile(request)
        return self._runner(request)
