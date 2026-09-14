"""Deterministic TeX sources used to define the supported compiler corpus."""

from .generator import (
    COMMON_RAW_PACKAGES,
    UNSUPPORTED_CASES,
    CorpusResult,
    corpus_identity,
    generate_corpus,
)

__all__ = [
    "COMMON_RAW_PACKAGES",
    "UNSUPPORTED_CASES",
    "CorpusResult",
    "corpus_identity",
    "generate_corpus",
]
