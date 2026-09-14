"""Static guardrails for the isolated compiler deployment scaffold."""

import json
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
DOCKERFILE = BACKEND / "compiler_sidecar" / "Dockerfile"
COMPOSE_FILE = BACKEND.parent / "docker-compose.yml"


def test_sidecar_dockerfile_is_pinned_offline_and_non_root():
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    assert "FROM python:3.14-slim-bookworm@sha256:416f0db2a2b561945630cef9877a7ea0581b27449eb9fd9df42f03e1b74b5b63" in dockerfile
    assert "COPY --chown=10001:10001 .compiler-assets/ /opt/compiler-assets/" in dockerfile
    assert "RUN python /usr/local/bin/verify-compiler-assets /opt/compiler-assets" in dockerfile
    assert "USER 10001:10001" in dockerfile
    assert 'CMD ["python", "-m", "compiler_sidecar.server"]' in dockerfile
    assert "XDG_CACHE_HOME=/opt/compiler-assets/formats" in dockerfile
    assert "TECTONIC_CACHE_DIR=/opt/compiler-assets/cache" in dockerfile
    forbidden = ("apt-get", "apk add", "yum install", "dnf install", "curl ", "wget ", "pip install")
    assert not any(token in dockerfile.lower() for token in forbidden)


def test_runner_pins_the_cached_web_bundle_without_shell_execution():
    runner = (BACKEND / "compiler_sidecar" / "runner.py").read_text(encoding="utf-8")

    assert 'TECTONIC_WEB_BUNDLE = "https://relay.fullyjustified.net/default_bundle_v33.tar"' in runner
    assert 'TECTONIC_EXECUTABLE = "/opt/compiler-assets/tectonic/tectonic"' in runner
    assert "executable: str = TECTONIC_EXECUTABLE" in runner
    assert '_TECTONIC_FIXED_ARGS = ("--web-bundle", TECTONIC_WEB_BUNDLE, "--only-cached", "--untrusted")' in runner
    assert "shell=True" not in runner


def test_compose_isolates_the_sidecar_and_shares_only_the_socket_volume():
    compose = COMPOSE_FILE.read_text(encoding="utf-8")

    for required in (
        "network_mode: none",
        "read_only: true",
        "- ALL",
        "- no-new-privileges:true",
        "pids_limit: 32",
        "mem_limit: 256m",
        'cpus: "0.50"',
        "/work:rw,noexec,nosuid,nodev,size=64m",
        "- compiler_socket:/run/texgen",
        "- COMPILER_BACKEND=sidecar",
        "- COMPILER_SIDECAR_SOCKET=/run/texgen/compiler.sock",
        "condition: service_healthy",
        'test: ["CMD", "python", "-S", "-m", "compiler_sidecar.container.healthcheck", "/run/texgen/compiler.sock"]',
        "interval: 30s",
        "timeout: 45s",
        "retries: 3",
        "start_period: 20s",
    ):
        assert required in compose
    backend_section = compose.split("  backend:\n", 1)[1].split("  compiler:\n", 1)[0]
    assert 'group_add: ["10001"]' in backend_section
    compiler_section = compose.split("  compiler:\n", 1)[1].split("  frontend:\n", 1)[0]
    assert 'restart: "on-failure:3"' in compiler_section
    assert "mem_limit: 256m" in compiler_section
    assert "memswap_limit: 256m" in compiler_section
    assert "environment:" not in compiler_section
    assert "env_file:" not in compiler_section
    assert "secrets:" not in compiler_section
    assert 'test: ["CMD", "python", "-S", "-m", "compiler_sidecar.container.healthcheck", "/run/texgen/compiler.sock"]' in compiler_section
    assert "interval: 30s" in compiler_section
    assert "timeout: 45s" in compiler_section
    assert "retries: 3" in compiler_section
    assert "start_period: 20s" in compiler_section


def test_backend_specific_ignore_excludes_assets_without_breaking_compiler_build():
    default_ignore = (BACKEND / ".dockerignore").read_text(encoding="utf-8").splitlines()
    backend_ignore = (BACKEND / "Dockerfile.dockerignore").read_text(encoding="utf-8").splitlines()
    # Dockerfile-specific rules replace the root rules, so retain all existing exclusions.
    assert set(default_ignore) <= set(backend_ignore)
    for pattern in (".compiler-assets/", "build/", "dist/", "coverage/", "htmlcov/", ".pytest_cache/", ".coverage*", ".env.*"):
        assert pattern in backend_ignore
    assert ".compiler-assets/" not in default_ignore
    assert not (BACKEND / "compiler_sidecar/Dockerfile.dockerignore").exists()


def test_asset_manifest_schema_is_committed_while_staged_assets_are_ignored():
    schema = BACKEND / "compiler_sidecar" / "container" / "manifest.schema.json"
    files = json.loads(schema.read_text(encoding="utf-8"))["properties"]["files"]
    assert files["additionalProperties"]["required"] == ["sha256", "size"]
    assert "backend/.compiler-assets/**" in (BACKEND.parent / ".gitignore").read_text(encoding="utf-8")


def test_healthcheck_is_a_standard_library_live_protocol_probe():
    healthcheck = (BACKEND / "compiler_sidecar" / "container" / "healthcheck.py").read_text(encoding="utf-8")

    assert "socket.AF_UNIX" in healthcheck
    assert "encode_frame(request_id, payload)" in healthcheck
    assert "receive_message(connection)" in healthcheck
    assert "subprocess" not in healthcheck


def test_browser_ci_verifies_pinned_arm64_assets_before_compose():
    workflow = (BACKEND.parent / ".github/workflows/ci.yml").read_text(encoding="utf-8")
    browser_job = workflow.split("  browser-e2e:\n", 1)[1]
    assert "runs-on: ubuntu-24.04-arm" in browser_job
    assert 'test "$(uname -m)" = aarch64' in browser_job
    assert "--max-filesize 25255835" in browser_job
    assert "releases/download/compiler-assets-0.15.0-238864f4e9df/texgen-compiler-assets-0.15.0-corpus-238864f4e9df.tar.gz" in browser_job
    assert "add28e26a3af62f800b8171070501bf1ecb4f5b0f79244c5f14b11023fe9bce3" in browser_job
    checksum = browser_job.index("sha256sum --check --strict")
    extract = browser_job.index("tar --extract")
    verify = browser_job.index("python3 -S backend/compiler_sidecar/container/verify_assets.py backend/.compiler-assets")
    build = browser_job.index("docker compose -f docker-compose.yml")
    assert checksum < extract < verify < build


def test_healthcheck_budget_covers_running_job_and_probe():
    from api.compilation.types import CompileLimits
    from compiler_sidecar.container.healthcheck import HEALTHCHECK_TIMEOUT_SECONDS

    assert HEALTHCHECK_TIMEOUT_SECONDS > 2 * CompileLimits().timeout_seconds
    assert HEALTHCHECK_TIMEOUT_SECONDS < 45
