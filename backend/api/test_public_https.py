"""Opt-in public configuration, input rejection and owned probe cleanup."""

import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parents[2]


def compose_environment(tmp_path):
    ambient = {key: value for key, value in os.environ.items()
               if key not in {"TEXGEN_PUBLIC_BIND", "TEXGEN_PUBLIC_HTTP_PORT", "TEXGEN_PUBLIC_HTTPS_PORT"}}
    return {**ambient, "DJANGO_SECRET_KEY": "test-only", "JWT_SIGNING_KEY": "test-only",
            "DATABASE_URL": "postgres://test:test@db/test", "POSTGRES_PASSWORD": "test-only",
            "POSTGRES_APP_PASSWORD": "test-only", "DJANGO_ALLOWED_HOSTS": "untrusted.invalid",
            "TEXGEN_BACKEND_IMAGE": "texgen-e01s03-backend:test",
            "TEXGEN_FRONTEND_IMAGE": "texgen-e01s03-frontend:test",
            "TEXGEN_COMPILER_IMAGE": "texgen-e01s03-compiler:test",
            "TEXGEN_PUBLIC_HOST": "texgen.example.test", "TEXGEN_TLS_DIRECTORY": str(tmp_path),
            "TEXGEN_LOCAL_HTTP": "1"}


def test_rendered_public_overlay_preserves_boundary(tmp_path):
    command = ["docker", "compose", "--env-file", "/dev/null", "-f", str(ROOT / "docker-compose.production.yml")]
    env = compose_environment(tmp_path)
    def render(args):
        return json.loads(subprocess.check_output([*command, *args, "config", "--format", "json"], env=env, text=True, timeout=30))["services"]
    baseline = render([])
    public = render(["-f", str(ROOT / "docker-compose.public.yml")])
    assert public["compiler"] == baseline["compiler"]
    assert public["db"] == baseline["db"]
    ports = public["frontend"]["ports"]
    assert {p["target"] for p in ports} == {8081, 8443}
    assert len(ports) == 2 and all(p["host_ip"] == "127.0.0.1" and p["published"] == "0" for p in ports)
    for name in ("backend", "migrate", "frontend"):
        for field in ("user", "read_only", "cap_drop", "security_opt", "pids_limit", "mem_limit", "memswap_limit", "cpus", "tmpfs", "networks", "healthcheck"):
            assert public[name].get(field) == baseline[name].get(field)
        for mount in baseline[name].get("volumes", []):
            assert mount in public[name]["volumes"]
    for name in ("backend", "migrate"):
        assert public[name]["environment"]["TEXGEN_LOCAL_HTTP"] == "0"
        assert public[name]["environment"]["DJANGO_ALLOWED_HOSTS"] == "texgen.example.test,localhost"
        assert not public[name].get("ports")
    binds = [m for m in public["frontend"]["volumes"] if m["type"] == "bind"]
    assert len(binds) == 3
    assert all(m["read_only"] and not m["bind"].get("create_host_path", False) for m in binds)
    assert not public["db"].get("ports")
    assert public["compiler"]["network_mode"] == "none"


@pytest.mark.parametrize("hostname", ["", "localhost", "1.2.3.4", "A.example.test", "a..test", "-a.test",
                                      "a-.test", "a_test.test", "a.test.", "a.test:443", "a.test/path",
                                      "a.test;return 200", "a.test\nb.test", "a.test b.test",
                                      "a" * 64 + ".test", ".".join(["a" * 63] * 4) + ".test"])
def test_hostname_rejected_before_tls(hostname):
    result = subprocess.run(["sh", str(ROOT / "scripts/start-public-nginx.sh")],
                            env={**os.environ, "TEXGEN_PUBLIC_HOST": hostname}, capture_output=True, text=True, timeout=5)
    assert result.returncode != 0
    assert "Invalid public DNS hostname" in result.stderr


def test_missing_tls_fails_before_commands(tmp_path):
    # Isolate absolute certificate paths without requiring root or system files.
    script = (ROOT / "scripts/start-public-nginx.sh").read_text().replace("/run/texgen-tls", str(tmp_path))
    result = subprocess.run(["sh", "-c", script], env={**os.environ, "TEXGEN_PUBLIC_HOST": "a-b.example.test"},
                            capture_output=True, text=True, timeout=5)
    assert result.returncode != 0 and "Missing or unreadable TLS file" in result.stderr


@pytest.mark.parametrize("failure", [SystemExit(143), subprocess.TimeoutExpired("docker", 30)])
def test_probe_cleans_owned_resources_on_cancel_or_failed_startup(failure):
    sys.path.insert(0, str(ROOT / "scripts"))
    try:
        spec = importlib.util.spec_from_file_location("public_probe", ROOT / "scripts/check-public-https.py")
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        run_id = "a" * 32
        with patch.dict(os.environ, {"TEXGEN_VERIFICATION_ID": run_id}), \
                patch.object(module, "docker", side_effect=["backend", "frontend", failure]), \
                patch.object(module, "cleanup") as cleanup, patch.object(signal, "signal"):
            with pytest.raises(type(failure)):
                module.main()
            cleanup.assert_called_once_with(run_id)
    finally:
        sys.path.pop(0)
