import json
from hashlib import sha256

from api.formula_catalog import FORMULAS
from api.rendering import GENERATED_MARKER
from compiler_sidecar.corpus.generator import COMMON_RAW_PACKAGES, UNSUPPORTED_CASES, corpus_identity, generate_corpus


def test_corpus_identity_and_fixture_classification_are_deterministic(tmp_path):
    first = generate_corpus(tmp_path / "one")
    second = generate_corpus(tmp_path / "two")
    metadata = json.loads((tmp_path / "one" / "corpus.json").read_text())
    tex_paths = {path.relative_to(tmp_path / "one").as_posix() for path in (tmp_path / "one").rglob("*.tex")}
    classified = {fixture["path"] for fixture in metadata["fixtures"] if fixture["path"]}
    assert first.identity == second.identity == corpus_identity()
    assert tex_paths == classified
    assert metadata["formula_ids"] == [formula["id"] for formula in FORMULAS]
    assert len(metadata["formula_ids"]) == 402
    assert all(fixture["sha256"] == sha256((tmp_path / "one" / fixture["path"]).read_bytes()).hexdigest() for fixture in metadata["fixtures"] if fixture["path"])
    assert all((tmp_path / "one" / fixture["path"]).read_text().strip() for fixture in metadata["fixtures"] if fixture["classification"].endswith("positive"))
    assert all("\\begin{document}" in (tmp_path / "one" / fixture["path"]).read_text() and "\\end{document}" in (tmp_path / "one" / fixture["path"]).read_text() for fixture in metadata["fixtures"] if fixture["classification"].endswith("positive"))


def test_layout_matrix_batches_features_packages_and_expected_outcomes(tmp_path):
    result = generate_corpus(tmp_path)
    metadata = json.loads((tmp_path / "corpus.json").read_text())
    matrix = metadata["layout_matrix"]
    assert len(matrix) == 1400
    assert {item["columns"] for item in matrix} == {1, 2, 3, 4, 5}
    assert {item["font_size"] for item in matrix} == {"8pt", "9pt", "10pt", "11pt", "12pt"}
    assert {item["margins"] for item in matrix} == {"0.15in", "0.25in", "0.5in", "0.75in", "1in", "1.5in", "2in"}
    assert {item["spacing"] for item in matrix} == {"tiny", "small", "medium", "large"}
    assert {item["orientation"] for item in matrix} == {"portrait", "landscape"}
    layouts = sorted((tmp_path / "layouts").glob("*.tex"))
    assert len(layouts) == 22
    assert all("TeXGen corpus layout sentinel" in path.read_text() and GENERATED_MARKER in path.read_text() for path in layouts)
    assert all(("\\begin{multicols}" in path.read_text()) == ("\\end{multicols}" in path.read_text()) for path in layouts)
    assert len(list((tmp_path / "batches").glob("*.tex"))) == len({formula["class"] for formula in FORMULAS})
    assert (tmp_path / "batches" / "unit-circle.tex").exists()
    assert result.all_catalog_bytes < 256 * 1024
    assert result.counts == {"warm_positive": 58, "verify_positive": 402, "compile_expected_failure": 2, "security_probe": 1, "policy_unsupported": 3}
    assert tuple(metadata["common_raw_packages"]) == COMMON_RAW_PACKAGES
    assert [case["id"] for case in UNSUPPORTED_CASES] == ["bibliography", "index", "network-dependent-content"]
    outcomes = {item["path"]: item["expected_outcome"] for item in metadata["fixtures"] if item["path"]}
    assert outcomes["expected-failures/missing-input.tex"] == outcomes["expected-failures/unavailable-package.tex"] == "compile_failure"
    assert outcomes["security/shell-escape.tex"].startswith("compile_success_no_side_effect:")


def test_structures_fixture_uses_single_command_prefixes(tmp_path):
    generate_corpus(tmp_path)
    source = (tmp_path / "features" / "structures.tex").read_text()
    assert r"\usepackage{amsmath}" in source
    assert r"\begin{cases}" in source
    assert r"\begin{tabular}" in source
    assert r"1&2\\3&4" in source
    assert not any(line.startswith(r"\\") for line in source.splitlines())
