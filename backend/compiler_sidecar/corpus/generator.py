"""Generate the deterministic, catalog-backed compiler corpus without TeX I/O."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import stat
from types import MappingProxyType

from api.formula_catalog import FORMULAS
from api.rendering import (
    DocumentRenderRequest,
    LayoutSpec,
    PracticeProblemSpec,
    build_latex_for_formulas,
    normalize_latex_layout,
    render_document,
)

COMMON_RAW_PACKAGES = (
    "article", "extarticle", "geometry", "amsmath", "amssymb", "enumitem",
    "multicol", "adjustbox", "inputenc", "mathtools", "array", "booktabs",
    "xcolor", "hyperref",
)
UNSUPPORTED_CASES = (
    {"id": "bibliography", "reason": "Bibliography processing is not supported."},
    {"id": "index", "reason": "Index processing is not supported."},
    {"id": "network-dependent-content", "reason": "Network-dependent TeX content is not supported."},
)
_COLUMNS = (1, 2, 3, 4, 5)
_FONT_SIZES = ("8pt", "9pt", "10pt", "11pt", "12pt")
_MARGINS = ("0.15in", "0.25in", "0.5in", "0.75in", "1in", "1.5in", "2in")
_SPACING = ("tiny", "small", "medium", "large")
_ORIENTATIONS = ("portrait", "landscape")
LAYOUT_SENTINEL = MappingProxyType({
    "class": "CORPUS LAYOUT SENTINEL",
    "category": "CORPUS LAYOUT SENTINEL",
    "name": "Visible layout sentinel",
    "latex": r"\text{TeXGen corpus layout sentinel}",
})
_LAYOUTS = tuple(
    LayoutSpec(columns, font_size, margins, spacing, orientation)
    for columns in _COLUMNS
    for font_size in _FONT_SIZES
    for margins in _MARGINS
    for spacing in _SPACING
    for orientation in _ORIENTATIONS
)
_COMPILER_LAYOUTS = (
    LayoutSpec(1, "8pt", "0.15in", "tiny", "portrait"),
    LayoutSpec(5, "12pt", "2in", "large", "landscape"),
    *(LayoutSpec(_COLUMNS[i % 5], _FONT_SIZES[(i + 1) % 5], _MARGINS[i % 7], _SPACING[i % 4], _ORIENTATIONS[i % 2]) for i in range(20)),
)


@dataclass(frozen=True)
class CorpusResult:
    identity: str
    files: tuple[str, ...]
    counts: dict[str, int]
    all_catalog_bytes: int


def _json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True) + "\n"


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def _raw_package_source(package: str) -> str:
    if package in {"article", "extarticle"}:
        return f"\\documentclass{{{package}}}\n\\begin{{document}}{package} package fixture\\end{{document}}\n"
    option = "[utf8]" if package == "inputenc" else ""
    return f"\\documentclass{{article}}\n\\usepackage{option}{{{package}}}\n\\begin{{document}}{package} package fixture\\end{{document}}\n"


def _feature_structures() -> str:
    return r"""\documentclass{article}
\usepackage{amsmath}
\usepackage{booktabs}
\begin{document}
\[f(x)=\begin{cases}x^2&x\geq0\\-x&x<0\end{cases}\quad\begin{bmatrix}1&2\\3&4\end{bmatrix}\quad\begin{vmatrix}a&b\\c&d\end{vmatrix}\]
\begin{tabular}{@{}lr@{}}\toprule Name&Value\\\midrule $\int_0^1x\,dx$&$\frac12$\\\bottomrule\end{tabular}
\end{document}
"""


def _add(fixtures: list[dict[str, object]], path: str | None, source: str | None, classification: str, expected_outcome: str) -> None:
    fixtures.append({"path": path, "source": source, "classification": classification, "expected_outcome": expected_outcome})


def _fixtures() -> list[dict[str, object]]:
    fixtures: list[dict[str, object]] = []
    for formula in FORMULAS:
        _add(fixtures, f"formulas/{formula['id']}.tex", build_latex_for_formulas([formula]), "verify_positive", "compile_success")
    by_class: dict[str, list[dict[str, object]]] = {}
    for formula in FORMULAS:
        by_class.setdefault(formula["class"], []).append(formula)
    for class_name, formulas in by_class.items():
        _add(fixtures, f"batches/{_slug(class_name)}.tex", build_latex_for_formulas(formulas), "warm_positive", "compile_success")
    _add(fixtures, "stress/all-catalog.tex", build_latex_for_formulas(FORMULAS), "warm_positive", "compile_success")
    for index, layout in enumerate(_COMPILER_LAYOUTS):
        _add(fixtures, f"layouts/{index:02d}.tex", build_latex_for_formulas([LAYOUT_SENTINEL], **layout.__dict__), "warm_positive", "compile_success")
    _add(fixtures, "features/structures.tex", _feature_structures(), "warm_positive", "compile_success")
    _add(fixtures, "features/raw-complete-document.tex", r"\documentclass{article}\n\begin{document}Raw complete document $x_1$.\n\end{document}\n".replace("\\n", "\n"), "warm_positive", "compile_success")
    _add(fixtures, "features/raw-fragment-wrapper.tex", render_document(DocumentRenderRequest(source_latex=r"Raw fragment $\sin(\pi/2)=1$.", source_mode="raw")), "warm_positive", "compile_success")
    _add(fixtures, "features/practice-problems.tex", render_document(DocumentRenderRequest(source_latex=r"\[\frac{d}{dx}x^2=2x\]", layout=LayoutSpec(columns=2), practice_problems=(PracticeProblemSpec(1, r"Find $\bar{x}$.", r"$\bar{x}=2$"),))), "warm_positive", "compile_success")
    generated = build_latex_for_formulas([FORMULAS[0]])
    _add(fixtures, "features/normalized-generated.tex", normalize_latex_layout(generated, columns=3, font_size="10pt", margins="0.5in", spacing="medium", orientation="landscape", source_mode="generated"), "warm_positive", "compile_success")
    for package in COMMON_RAW_PACKAGES:
        _add(fixtures, f"raw-packages/{package}.tex", _raw_package_source(package), "warm_positive", "compile_success")
    _add(fixtures, "expected-failures/missing-input.tex", "\\documentclass{article}\n\\begin{document}\n\\input{corpus-missing-input}\n\\end{document}\n", "compile_expected_failure", "compile_failure")
    _add(fixtures, "expected-failures/unavailable-package.tex", "\\documentclass{article}\n\\usepackage{corpusunavailablepackage}\n\\begin{document}Unavailable package fixture\\end{document}\n", "compile_expected_failure", "compile_failure")
    _add(fixtures, "security/shell-escape.tex", "\\documentclass{article}\n\\begin{document}Shell escape security probe\\immediate\\write18{touch corpus-shell-escape-probe}\\end{document}\n", "security_probe", "compile_success_no_side_effect:corpus-shell-escape-probe")
    for case in UNSUPPORTED_CASES:
        _add(fixtures, None, None, "policy_unsupported", case["id"])
    return fixtures


def _identity(fixtures: list[dict[str, object]]) -> str:
    digest = sha256()
    for fixture in fixtures:
        digest.update(_json({key: value for key, value in fixture.items() if key != "source"}).encode())
        if fixture["source"] is not None:
            digest.update(str(fixture["source"]).encode() + b"\0")
    return digest.hexdigest()


def corpus_identity() -> str:
    """Return the identity of the catalog, renderer sources, and classifications."""
    return _identity(_fixtures())


def generate_corpus(output_directory: str | Path) -> CorpusResult:
    """Write only below ``output_directory``; never execute TeX or download data."""
    output = Path(output_directory)
    if output.exists() and output.is_symlink():
        raise ValueError("corpus output directory must not be a symlink")
    output.mkdir(parents=True, exist_ok=True)
    if not output.is_dir():
        raise ValueError("corpus output path must be a directory")
    fixtures = _fixtures()
    identity = _identity(fixtures)
    records: list[dict[str, object]] = []
    for fixture in fixtures:
        record = {key: value for key, value in fixture.items() if key != "source"}
        path, source = fixture["path"], fixture["source"]
        if path is not None and source is not None:
            destination = output / str(path)
            destination.parent.mkdir(parents=True, exist_ok=True)
            if destination.parent.is_symlink() or (destination.exists() and destination.is_symlink()):
                raise ValueError(f"corpus destination must not be a symlink: {path}")
            destination.write_text(str(source), encoding="utf-8", newline="\n")
            record["sha256"] = sha256(str(source).encode()).hexdigest()
        records.append(record)
    counts = {classification: sum(item["classification"] == classification for item in records) for classification in ("warm_positive", "verify_positive", "compile_expected_failure", "security_probe", "policy_unsupported")}
    metadata = {
        "corpus_identity": identity,
        "formula_ids": [formula["id"] for formula in FORMULAS],
        "common_raw_packages": COMMON_RAW_PACKAGES,
        "fixtures": records,
        "layout_matrix": [layout.__dict__ for layout in _LAYOUTS],
        "compiler_layout_count": len(_COMPILER_LAYOUTS),
        "all_catalog_bytes": len(str(fixtures[len(FORMULAS) + len({formula['class'] for formula in FORMULAS})]["source"]).encode()),
    }
    # Validate the opened inode before truncating; reject links and never block on FIFOs.
    descriptor = os.open(output / "corpus.json", os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW | os.O_NONBLOCK, 0o666)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as manifest:
        if not stat.S_ISREG(os.fstat(manifest.fileno()).st_mode):
            raise ValueError("corpus metadata must be a regular file")
        manifest.truncate(0)
        manifest.write(_json(metadata))
    return CorpusResult(identity, tuple(sorted(str(item["path"]) for item in fixtures if item["path"] is not None) + ["corpus.json"]), counts, int(metadata["all_catalog_bytes"]))
