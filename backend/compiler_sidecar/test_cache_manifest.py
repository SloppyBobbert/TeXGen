from pathlib import Path

import pytest

from compiler_sidecar.cache_manifest import CacheManifestError, build_cache_manifest, verify_cache_manifest


def manifest(directory: Path):
    return build_cache_manifest(directory, max_files=10, max_bytes=100, tectonic_version="0.15.0", corpus_identity="corpus")


def test_manifest_is_deterministic_and_detects_tampering(tmp_path):
    (tmp_path / "b").write_bytes(b"two")
    (tmp_path / "a").write_bytes(b"one")
    first = manifest(tmp_path)
    assert first == manifest(tmp_path)
    verify_cache_manifest(tmp_path, first)
    (tmp_path / "a").write_bytes(b"two")
    with pytest.raises(CacheManifestError, match="does not match"):
        verify_cache_manifest(tmp_path, first)


def test_manifest_rejects_caps_and_symlinks(tmp_path):
    (tmp_path / "data").write_bytes(b"1234")
    (tmp_path / "other").write_bytes(b"5")
    with pytest.raises(CacheManifestError, match="file cap"):
        build_cache_manifest(tmp_path, max_files=1, max_bytes=10, tectonic_version="v", corpus_identity="c")
    with pytest.raises(CacheManifestError, match="byte cap"):
        build_cache_manifest(tmp_path, max_files=2, max_bytes=3, tectonic_version="v", corpus_identity="c")
    (tmp_path / "link").symlink_to(tmp_path / "data")
    with pytest.raises(CacheManifestError, match="symlink"):
        manifest(tmp_path)
