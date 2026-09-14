"""Regression checks for PR6 review 5183522973."""
import json
import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import Mock, patch

import pytest
from django.contrib.auth.models import User
from django.core.cache import cache
from rest_framework.test import APIClient

from api.compilation.types import CompilerUnavailable
from api.formula_catalog import FORMULAS, FormulaCatalogError, _build_catalog
from api.models import CheatSheet, PracticeProblem
from api.rendering import build_latex_for_formulas, normalize_latex_layout
from compiler_sidecar.container.verify_assets import _manifest_files
from compiler_sidecar.corpus.generator import generate_corpus


@pytest.fixture(autouse=True)
def isolated_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.parametrize("latex", [None, 0, False, [], {}])
@pytest.mark.parametrize("special", [False, True])
def test_catalog_rejects_nonstring_latex(latex, special):
    formula = {"id": "test.formula", "name": "Formula", "latex": latex}
    with pytest.raises(FormulaCatalogError, match="latex must be a string"):
        _build_catalog({} if special else {"Class": {"Category": [formula]}}, {"Class": formula} if special else {})


@pytest.mark.parametrize("latex", [None, 0, False, [], {}])
@pytest.mark.parametrize("category", ["Class", "Category"])
def test_renderer_rejects_nonstring_latex(latex, category):
    with pytest.raises(TypeError, match="formula latex must be a string"):
        build_latex_for_formulas([{"class": "Class", "category": category, "latex": latex}])


@pytest.mark.parametrize("latex", ["", "  \\frac{α}{β}\n% untouched\n"])
@pytest.mark.parametrize("category", ["Class", "Category"])
def test_catalog_and_renderer_preserve_latex(latex, category):
    records, *_ = _build_catalog({"Class": {category: [{"id": "test.formula", "name": "Formula", "latex": latex}]}}, {})
    assert records[0]["latex"] == latex
    assert latex in build_latex_for_formulas(records)


@pytest.mark.django_db
@pytest.mark.parametrize(("mode", "legacy", "effective"), [("empty", "generated", "generated"), ("empty", "manual", "raw"), ("empty", "empty", "raw"), ("raw", "generated", "raw"), ("generated", "manual", "generated")])
@pytest.mark.parametrize("normalize_only", [True, False])
def test_compile_by_id_uses_effective_stored_mode(mode, legacy, effective, normalize_only):
    user = User.objects.create_user(username="review-owner")
    sheet = CheatSheet.objects.create(user=user, title="Stored", source_mode=mode, content_source=legacy, latex_content="Stored α", columns=2)
    client = APIClient()
    client.force_authenticate(user)
    service = Mock()
    service.prepare.side_effect = CompilerUnavailable("test")
    with patch("api.views.get_compiler_service", return_value=service), patch("api.views.normalize_latex_layout", wraps=normalize_latex_layout) as normalize:
        response = client.post("/api/compile/", {"cheat_sheet_id": sheet.pk, "content": "Untrusted replacement", "source_mode": "raw", "normalize_only": normalize_only}, format="json")
    assert response.status_code == (200 if normalize_only else 503)
    assert normalize.call_args.kwargs["source_mode"] == effective
    assert "Stored α" in normalize.call_args.args[0]
    assert "Untrusted replacement" not in normalize.call_args.args[0]
    assert ("% @texgen-generated v1" in sheet.build_full_latex()) == (effective == "generated")
    sheet.refresh_from_db()
    assert sheet.source_mode == mode
    for field in ("source_mode", "content_source"):
        response = client.post("/api/compile/", {"cheat_sheet_id": sheet.pk, field: None}, format="json")
        assert response.status_code == 400


@pytest.mark.parametrize("prefix", ["cache", "formats"])
def test_manifest_requires_strict_prefix_descendants(prefix):
    names = ["tectonic/tectonic", "cache/bundle", "formats/plain.fmt"]
    names = [prefix if name.startswith(prefix + "/") else name for name in names]
    with pytest.raises(SystemExit, match="lacks required"):
        _manifest_files({"files": {name: {"sha256": "0" * 64, "size": 0} for name in names}})


def test_manifest_keeps_required_binary_and_nested_assets():
    files = {name: {"sha256": "0" * 64, "size": 0} for name in ["tectonic/tectonic", "cache/deep/bundle", "formats/deep/plain.fmt"]}
    assert len(_manifest_files({"files": files})) == 3
    del files["tectonic/tectonic"]
    with pytest.raises(SystemExit, match="lacks required"):
        _manifest_files({"files": files})


@pytest.mark.parametrize("dangling", [False, True])
def test_corpus_metadata_refuses_symlink(tmp_path, dangling):
    target = tmp_path / "outside.json"
    if not dangling:
        target.write_bytes(b"keep me")
    output = tmp_path / "corpus"
    output.mkdir()
    (output / "corpus.json").symlink_to(target)
    with pytest.raises((OSError, ValueError)):
        generate_corpus(output)
    assert not target.exists() if dangling else target.read_bytes() == b"keep me"
    assert (output / "corpus.json").is_symlink()


def test_corpus_metadata_regeneration_preserves_exact_bytes(tmp_path):
    first = generate_corpus(tmp_path)
    expected = (tmp_path / "corpus.json").read_bytes()
    (tmp_path / "corpus.json").write_bytes(expected + b"trailing old bytes")
    assert generate_corpus(tmp_path) == first
    assert (tmp_path / "corpus.json").read_bytes() == expected
    assert expected == (json.dumps(json.loads(expected), sort_keys=True, separators=(",", ":"), ensure_ascii=True) + "\n").encode("utf-8")


@pytest.mark.parametrize("reader", [False, True])
def test_corpus_metadata_refuses_fifo_without_blocking(tmp_path, reader):
    os.mkfifo(tmp_path / "corpus.json")
    descriptor = os.open(tmp_path / "corpus.json", os.O_RDONLY | os.O_NONBLOCK) if reader else None
    script = "from compiler_sidecar.corpus.generator import generate_corpus; import sys; generate_corpus(sys.argv[1])"
    try:
        result = subprocess.run([sys.executable, "-c", script, str(tmp_path)], cwd=Path(__file__).resolve().parents[1], capture_output=True, timeout=10)
    finally:
        if descriptor is not None:
            os.close(descriptor)
    assert result.returncode != 0
    assert (b"regular file" if reader else b"OSError") in result.stderr


@pytest.mark.django_db
@pytest.mark.parametrize("source", ["", " \n\t"])
@pytest.mark.parametrize("legacy", ["manual", "generated"])
def test_blank_legacy_records_keep_empty_mode(source, legacy):
    user = User.objects.create_user(username="blank-owner")
    sheet = CheatSheet.objects.create(user=user, latex_content=source, content_source=legacy)
    assert sheet.effective_source_mode == "empty"
    client = APIClient()
    client.force_authenticate(user)
    with patch("api.views.get_compiler_service") as compiler, patch("api.views.admit_compile") as quota:
        response = client.post("/api/compile/", {"cheat_sheet_id": sheet.pk}, format="json")
    assert response.status_code == 400
    compiler.assert_not_called()
    quota.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize("mode", ["empty", "raw"])
def test_raw_stored_complete_document_preserved_with_problems(mode):
    source = "\\documentclass{article}\n\\begin{document}\n% @texgen-generated v1\nα\n\\end{document}\n"
    user = User.objects.create_user(username="raw-owner")
    sheet = CheatSheet.objects.create(user=user, source_mode=mode, content_source="manual", latex_content=source)
    PracticeProblem.objects.create(cheat_sheet=sheet, question_latex="Do not insert")
    assert sheet.build_full_latex() == source
    client = APIClient()
    client.force_authenticate(user)
    response = client.post("/api/compile/", {"cheat_sheet_id": sheet.pk, "source_mode": "generated", "normalize_only": True}, format="json")
    assert response.status_code == 200
    assert response.json()["tex_code"] == source


@pytest.mark.django_db
def test_generation_uses_catalog_latex_not_client_latex():
    formula = FORMULAS[0]
    selection = {"class": formula["class"], "category": formula["category"], "name": formula["name"]}
    response = APIClient().post("/api/generate-sheet/", {"formulas": [{**selection, "latex": None}]}, format="json")
    assert response.status_code == 400
    response = APIClient().post("/api/generate-sheet/", {"formulas": [selection]}, format="json")
    assert response.status_code == 200
    assert formula["latex"] in response.json()["tex_code"]
