import hashlib
import json
import os
from pathlib import Path

import pytest

from compiler_sidecar.container.verify_assets import main


def _metadata(path: Path) -> dict[str, int | str]:
    return {"sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "size": path.stat().st_size}


def _assets(tmp_path: Path) -> Path:
    files = {
        "tectonic/tectonic": b"tectonic",
        "cache/bundle": b"cache",
        "formats/plain.fmt": b"format",
    }
    for relative_path, contents in files.items():
        path = tmp_path / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(contents)
    (tmp_path / "tectonic" / "tectonic").chmod(0o700)
    manifest = {relative_path: _metadata(tmp_path / relative_path) for relative_path in files}
    provenance = tmp_path / "provenance"
    provenance.mkdir()
    (provenance / "manifest.json").write_text(json.dumps({"files": manifest}), encoding="utf-8")
    return tmp_path


def test_verifier_accepts_exact_regular_asset_closure(tmp_path):
    main(_assets(tmp_path))


@pytest.mark.parametrize(("path", "is_directory"), (("extra", False), ("unexpected", True)))
def test_verifier_rejects_unlisted_files_and_directories(tmp_path, path, is_directory):
    root = _assets(tmp_path)
    extra = root / path
    if is_directory:
        extra.mkdir()
    else:
        extra.write_bytes(b"extra")

    with pytest.raises(SystemExit, match="tree does not match"):
        main(root)


def test_verifier_rejects_symlink(tmp_path):
    root = _assets(tmp_path)
    (root / "cache" / "link").symlink_to(root / "cache" / "bundle")

    with pytest.raises(SystemExit, match="not a regular file or directory"):
        main(root)


def test_verifier_rejects_tampering_and_size_mismatch(tmp_path):
    root = _assets(tmp_path)
    (root / "cache" / "bundle").write_bytes(b"tampered")

    with pytest.raises(SystemExit, match="verification failed"):
        main(root)


def test_verifier_rejects_non_executable_or_writable_tectonic(tmp_path):
    root = _assets(tmp_path)
    tectonic = root / "tectonic" / "tectonic"
    tectonic.chmod(0o600)

    with pytest.raises(SystemExit, match="unsafe permissions"):
        main(root)

    tectonic.chmod(0o722)
    with pytest.raises(SystemExit, match="unsafe permissions"):
        main(root)


def test_verifier_rejects_non_regular_entries(tmp_path):
    root = _assets(tmp_path)
    fifo = root / "cache" / "pipe"
    os.mkfifo(fifo)

    with pytest.raises(SystemExit, match="not a regular file or directory"):
        main(root)
