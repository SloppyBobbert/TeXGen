"""Immutable public contracts for untrusted LaTeX compilation."""

from dataclasses import dataclass
from math import isfinite


class CompilationFailure(Exception):
    """Base class for failures that are safe to expose to callers."""

    def __init__(self, message="", *, outcome_unknown=False):
        super().__init__(message)
        self.outcome_unknown = outcome_unknown


class InvalidCompileRequest(CompilationFailure):
    pass


class CompilerSyntaxError(CompilationFailure):
    pass


class CompilerTimeout(CompilationFailure):
    pass


class CompilerResourceLimit(CompilationFailure):
    pass


class CompilerOutputError(CompilationFailure):
    pass


class CompilerBusy(CompilationFailure):
    pass


class CompilerUnavailable(CompilationFailure):
    pass


class CompilerInternalError(CompilationFailure):
    pass


@dataclass(frozen=True, slots=True)
class CompileLimits:
    source_max_bytes: int = 256 * 1024
    timeout_seconds: float = 15.0
    pdf_max_bytes: int = 10 * 1024 * 1024
    diagnostics_max_bytes: int = 4 * 1024
    cpu_seconds: int = 10
    address_space_bytes: int = 512 * 1024 * 1024
    file_size_bytes: int = 10 * 1024 * 1024
    process_count: int = 32
    open_files: int = 64

    def __post_init__(self) -> None:
        integer_limits = (
            self.source_max_bytes,
            self.pdf_max_bytes,
            self.diagnostics_max_bytes,
            self.cpu_seconds,
            self.address_space_bytes,
            self.file_size_bytes,
            self.process_count,
            self.open_files,
        )
        if (
            any(not isinstance(value, int) or isinstance(value, bool) for value in integer_limits)
            or
            self.source_max_bytes < 1
            or self.pdf_max_bytes < 1
            or self.diagnostics_max_bytes < 0
            or not isfinite(self.timeout_seconds)
            or self.timeout_seconds <= 0
            or self.cpu_seconds < 1
            or self.address_space_bytes < 1
            or self.file_size_bytes < 1
            or self.process_count < 1
            or self.open_files < 1
        ):
            raise InvalidCompileRequest("compile limits must be positive")


@dataclass(frozen=True, slots=True)
class CompileRequest:
    job_id: str
    source: str
    limits: CompileLimits

    def __post_init__(self) -> None:
        if not self.job_id or not isinstance(self.job_id, str) or len(self.job_id) > 128:
            raise InvalidCompileRequest("job id is invalid")
        if not isinstance(self.source, str):
            raise InvalidCompileRequest("source must be text")
        try:
            source_bytes = len(self.source.encode("utf-8"))
        except UnicodeEncodeError as error:
            raise InvalidCompileRequest("source must be valid UTF-8") from error
        if source_bytes > self.limits.source_max_bytes:
            raise InvalidCompileRequest("source exceeds configured limit")


@dataclass(frozen=True, slots=True)
class CompileResult:
    pdf: bytes
    diagnostics: str = ""

    def __post_init__(self) -> None:
        if not isinstance(self.pdf, bytes) or not self.pdf.startswith(b"%PDF-"):
            raise CompilerOutputError("compiler did not return a PDF")
