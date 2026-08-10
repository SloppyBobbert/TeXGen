from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_dockerignore_excludes_sensitive_and_generated_build_context_files():
    ignored = set((BACKEND_DIR / ".dockerignore").read_text().splitlines())

    assert {
        ".env*",
        ".coverage",
        "htmlcov/",
        ".pytest_cache/",
        ".ruff_cache/",
        "api/tests.py",
        "api/test_*.py",
    } <= ignored
    assert "api/views.py" not in ignored
    assert "cheat_sheet/settings.py" not in ignored
    assert "requirements.txt" not in ignored


def test_dockerfile_verifies_pinned_tectonic_assets_before_extraction():
    dockerfile = (BACKEND_DIR / "Dockerfile").read_text()
    assets = {
        "tectonic-0.15.0-x86_64-unknown-linux-musl.tar.gz": (
            "dfb82876f2986862996e564fa507a9e576e0c1e3bee63c2c1bd677c2543e6407"
        ),
        "tectonic-0.15.0-aarch64-unknown-linux-musl.tar.gz": (
            "1f59f9fb8eb65e8ba18658fc9016767e7d3e12488ded8b8fffa34254e51ce42c"
        ),
    }

    for asset, checksum in assets.items():
        assert asset in dockerfile
        assert checksum in dockerfile
    assert dockerfile.index("sha256sum -c -") < dockerfile.index("tar -xzf /tmp/tectonic.tar.gz")
