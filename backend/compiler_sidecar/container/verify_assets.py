"""Verify the locally staged Tectonic asset manifest during image construction."""

from __future__ import annotations

import hashlib
import json
import os
import stat
import sys
from pathlib import Path, PurePosixPath


_MANIFEST_PATH = PurePosixPath("provenance/manifest.json")
_REQUIRED_FILES = (PurePosixPath("tectonic/tectonic"),)
_REQUIRED_PREFIXES = (PurePosixPath("cache"), PurePosixPath("formats"))


def _digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as asset:
        for block in iter(lambda: asset.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _manifest_files(manifest: object) -> dict[PurePosixPath, tuple[str, int]]:
    if not isinstance(manifest, dict) or set(manifest) != {"files"}:
        raise SystemExit("missing or invalid compiler asset manifest")
    files = manifest["files"]
    if not isinstance(files, dict) or not files:
        raise SystemExit("compiler asset manifest has no files")

    parsed: dict[PurePosixPath, tuple[str, int]] = {}
    for name, metadata in files.items():
        if not isinstance(name, str) or not isinstance(metadata, dict) or set(metadata) != {"sha256", "size"}:
            raise SystemExit("compiler asset manifest has invalid entries")
        path = PurePosixPath(name)
        digest = metadata["sha256"]
        size = metadata["size"]
        if (
            path.is_absolute()
            or ".." in path.parts
            or path == PurePosixPath(".")
            or str(path) != name
            or path == _MANIFEST_PATH
            or not isinstance(digest, str)
            or len(digest) != 64
            or any(character not in "0123456789abcdef" for character in digest)
            or isinstance(size, bool)
            or not isinstance(size, int)
            or size < 0
        ):
            raise SystemExit("compiler asset manifest has invalid entries")
        parsed[path] = (digest, size)

    if not all(path in parsed for path in _REQUIRED_FILES) or not all(
        any(path != prefix and path.is_relative_to(prefix) for path in parsed) for prefix in _REQUIRED_PREFIXES
    ):
        raise SystemExit("compiler asset manifest lacks required Tectonic assets")
    return parsed


def _asset_tree(asset_root: Path) -> tuple[set[PurePosixPath], set[PurePosixPath]]:
    directories: set[PurePosixPath] = set()
    files: set[PurePosixPath] = set()

    def walk(directory: Path, relative_directory: PurePosixPath) -> None:
        with os.scandir(directory) as entries:
            for entry in entries:
                relative_path = relative_directory / entry.name
                info = entry.stat(follow_symlinks=False)
                if stat.S_ISDIR(info.st_mode):
                    directories.add(relative_path)
                    walk(Path(entry.path), relative_path)
                elif stat.S_ISREG(info.st_mode):
                    files.add(relative_path)
                else:
                    raise SystemExit(f"compiler asset is not a regular file or directory: {relative_path}")

    walk(asset_root, PurePosixPath("."))
    return directories, files


def main(asset_root: Path) -> None:
    manifest_path = asset_root / "provenance" / "manifest.json"
    try:
        if not stat.S_ISREG(manifest_path.lstat().st_mode):
            raise OSError("manifest is not a regular file")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise SystemExit("missing or invalid compiler asset manifest") from error
    files = _manifest_files(manifest)
    expected_files = set(files) | {_MANIFEST_PATH}
    expected_directories = {parent for path in expected_files for parent in path.parents if parent != PurePosixPath(".")}
    try:
        directories, actual_files = _asset_tree(asset_root)
    except OSError as error:
        raise SystemExit("could not inspect compiler assets") from error
    if directories != expected_directories or actual_files != expected_files:
        raise SystemExit("compiler asset tree does not match manifest")

    for relative_path, (expected_digest, expected_size) in files.items():
        path = asset_root / relative_path
        info = path.lstat()
        if info.st_size != expected_size or _digest(path) != expected_digest:
            raise SystemExit(f"compiler asset verification failed: {relative_path}")

    tectonic = asset_root / _REQUIRED_FILES[0]
    mode = tectonic.lstat().st_mode
    if not mode & stat.S_IXUSR or mode & (stat.S_IWGRP | stat.S_IWOTH):
        raise SystemExit("Tectonic executable has unsafe permissions")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: verify_assets.py ASSET_ROOT")
    main(Path(sys.argv[1]))
