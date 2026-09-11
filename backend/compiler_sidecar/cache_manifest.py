"""Offline, deterministic inventory for a pre-populated Tectonic cache."""

from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
import stat
from typing import Mapping


class CacheManifestError(ValueError):
    """The cache tree or its inventory is unsafe or does not match."""


def _digest_file(path: Path) -> tuple[str, int]:
    digest = sha256()
    size = 0
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
    return digest.hexdigest(), size


def _canonical_digest(manifest: Mapping[str, object]) -> str:
    payload = {key: value for key, value in manifest.items() if key != "root_digest"}
    return sha256(json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()).hexdigest()


def build_cache_manifest(
    cache_directory: str | Path,
    *,
    max_files: int,
    max_bytes: int,
    tectonic_version: str,
    archive_paths: Mapping[str, str | Path] = {},
    start_bundle_url: str | None = None,
    resolved_bundle_url: str | None = None,
    internal_bundle_identity: str | None = None,
    corpus_identity: str,
) -> dict[str, object]:
    """Hash an existing cache tree without downloading or executing anything."""
    root = Path(cache_directory)
    if root.is_symlink() or not root.is_dir():
        raise CacheManifestError("cache directory must be a non-symlink directory")
    files: list[dict[str, object]] = []
    total_size = 0
    for path in sorted(root.rglob("*"), key=lambda item: item.relative_to(root).as_posix()):
        relative = path.relative_to(root).as_posix()
        info = path.lstat()
        if stat.S_ISLNK(info.st_mode):
            raise CacheManifestError(f"cache contains symlink: {relative}")
        if path.is_dir():
            continue
        if not stat.S_ISREG(info.st_mode):
            raise CacheManifestError(f"cache contains non-regular file: {relative}")
        if len(files) >= max_files:
            raise CacheManifestError("cache file cap exceeded")
        digest, size = _digest_file(path)
        total_size += size
        if total_size > max_bytes:
            raise CacheManifestError("cache byte cap exceeded")
        files.append({"path": relative, "sha256": digest, "size": size})
    archives: dict[str, dict[str, object]] = {}
    for name, raw_path in sorted(archive_paths.items()):
        path = Path(raw_path)
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or path.is_symlink():
            raise CacheManifestError(f"archive must be a regular file: {name}")
        digest, size = _digest_file(path)
        archives[name] = {"sha256": digest, "size": size}
    manifest: dict[str, object] = {
        "tectonic_version": tectonic_version,
        "archives": archives,
        "start_bundle_url": start_bundle_url,
        "resolved_bundle_url": resolved_bundle_url,
        "internal_bundle_identity": internal_bundle_identity,
        "corpus_identity": corpus_identity,
        "files": files,
        "total_size": total_size,
    }
    manifest["root_digest"] = _canonical_digest(manifest)
    return manifest


def verify_cache_manifest(cache_directory: str | Path, manifest: Mapping[str, object], **kwargs: object) -> None:
    """Rebuild and compare an inventory, detecting cache or metadata tampering."""
    expected = dict(manifest)
    if expected.get("root_digest") != _canonical_digest(expected):
        raise CacheManifestError("manifest root digest does not match its contents")
    files = expected.get("files")
    total_size = expected.get("total_size")
    if not isinstance(files, list) or not isinstance(total_size, int):
        raise CacheManifestError("manifest has invalid inventory fields")
    max_files = kwargs.pop("max_files", len(files))
    max_bytes = kwargs.pop("max_bytes", total_size)
    if not isinstance(max_files, int) or not isinstance(max_bytes, int):
        raise TypeError("manifest caps must be integers")
    rebuilt = build_cache_manifest(
        cache_directory,
        tectonic_version=str(expected["tectonic_version"]),
        archive_paths=kwargs.pop("archive_paths", {}),  # type: ignore[arg-type]
        start_bundle_url=expected.get("start_bundle_url"),  # type: ignore[arg-type]
        resolved_bundle_url=expected.get("resolved_bundle_url"),  # type: ignore[arg-type]
        internal_bundle_identity=expected.get("internal_bundle_identity"),  # type: ignore[arg-type]
        corpus_identity=str(expected["corpus_identity"]),
        max_files=max_files,
        max_bytes=max_bytes,
    )
    if kwargs:
        raise TypeError(f"unexpected verification arguments: {', '.join(kwargs)}")
    if rebuilt != expected:
        raise CacheManifestError("cache inventory does not match manifest")
