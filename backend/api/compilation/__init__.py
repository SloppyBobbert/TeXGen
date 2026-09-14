"""Backend-agnostic compiler contracts and adapters.

Django-backed selection and configuration live in ``service`` and must be
imported explicitly so the compiler sidecar can use these contracts alone.
"""

from .adapter import CompilerAdapter, LocalCompilerAdapter
from .types import CompileLimits, CompileRequest, CompileResult

__all__ = [
    "CompileLimits",
    "CompileRequest",
    "CompileResult",
    "CompilerAdapter",
    "LocalCompilerAdapter",
]
