"""Local verifier follow-ups: no external requests or real Docker resources."""

import json
import subprocess
import sys
from urllib import request
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.utils import timezone
import pytest

from api.models import CompileQuotaWindow
from api.test_production_runtime import verifier_fixture
from api.test_verification_safety import load_script


@pytest.mark.parametrize("path", ["scripts/check-production-stack.py", "frontend/scripts/check-production-image.py"])
def test_loopback_opener_ignores_environment_proxy(monkeypatch, path):
    monkeypatch.setattr(request, "getproxies", lambda: {"http": "http://external.invalid:8080"})
    monkeypatch.setattr(request, "proxy_bypass", lambda _host: False)
    probe = load_script(path, monkeypatch)
    seen = []

    class Captured(Exception):
        pass

    class Capture(request.BaseHandler):
        handler_order = 499  # After proxy handling, before any actual HTTP connection.

        def http_open(self, req):
            seen.append((req.host, req.has_proxy()))
            raise Captured

    probe.OPENER.add_handler(Capture())
    with pytest.raises(Captured):
        probe.OPENER.open("http://127.0.0.1:5173/healthz", timeout=1)
    assert seen == [("127.0.0.1:5173", False)]


@pytest.mark.django_db
def test_outer_recovery_cleans_exact_fixture_after_outage_interruption(tmp_path, monkeypatch):
    log, env = verifier_fixture(tmp_path)
    marker = tmp_path / "outage-run"
    env["PROBE_RUN"] = str(marker)
    (tmp_path / "scripts/check-production-failures.py").write_text(
        "import os,signal,time\nfrom pathlib import Path\n"
        "Path(os.environ['PROBE_RUN']).write_text(os.environ['TEXGEN_VERIFICATION_ID'])\n"
        "os.kill(os.getppid(),signal.SIGTERM)\ntime.sleep(60)\n"
    )
    result = subprocess.run(["bash", "scripts/verify-production.sh"], cwd=tmp_path,
                            env=env, capture_output=True, text=True, timeout=15)
    assert result.returncode != 0
    run_id = marker.read_text()
    commands = [json.loads(line) for line in log.read_text().splitlines()]
    cleanups = [(i, row["args"]) for i, row in enumerate(commands)
                if "-c" in row["args"] and "get_user_model" in row["args"][row["args"].index("-c") + 1]]
    assert len(cleanups) == 1
    index, args = cleanups[0]
    assert args[-1] == run_id
    starts = [i for i, row in enumerate(commands) if "up" in row["args"]]
    assert len(starts) == 2 and index > starts[-1]
    assert commands[starts[-1]]["budget"] == "60"
    assert "--wait" in commands[starts[-1]]["args"]

    # Execute the actual recovery payload against the isolated test database.
    users = get_user_model().objects
    fixture = users.create_user(username="readiness_" + run_id)
    other = users.create_user(username="readiness_" + uuid4().hex)
    quota = CompileQuotaWindow.objects.create(user=fixture, window_start=timezone.now(), count=1)
    monkeypatch.setattr(sys, "argv", ["-c", run_id])
    code = args[args.index("-c") + 1]
    exec(code, {})
    assert not users.filter(pk=fixture.pk).exists()
    assert not CompileQuotaWindow.objects.filter(pk=quota.pk).exists()
    assert users.filter(pk=other.pk).exists()
    protected = users.create_user(username="readiness_" + run_id, password="test-only-password")
    exec(code, {})
    assert users.filter(pk=protected.pk).exists()
    assert "PASS: local production verification" not in result.stdout


@pytest.mark.django_db
def test_outage_probe_cleans_fixture_when_creation_response_is_lost(tmp_path, monkeypatch):
    verifier_fixture(tmp_path)
    probe = load_script("scripts/check-production-failures.py", monkeypatch)
    monkeypatch.setattr(probe, "ROOT", tmp_path)
    run_id = uuid4().hex
    monkeypatch.setenv("TEXGEN_VERIFICATION_ID", run_id)
    services = {name: {
        "Id": name,
        "Config": {"Labels": {"com.docker.compose.project.working_dir": str(tmp_path),
                              "com.docker.compose.service": name}, "Env": ["TEXGEN_LOCAL_HTTP=1"]},
        "NetworkSettings": {"Ports": {"8080/tcp": [{"HostIp": "127.0.0.1", "HostPort": "5173"}]}},
    } for name in ("backend", "frontend", "db", "compiler")}
    users = get_user_model().objects
    other = users.create_user(username="readiness_" + uuid4().hex)

    def docker(*args):
        if args[0] == "ps":
            return "\n".join(services)
        if args[0] == "inspect":
            return json.dumps([services[args[1]]])
        assert args[0] == "exec"
        code = args[-1]
        if "create_user" in code:
            users.create_user(username="readiness_" + run_id)
            raise subprocess.TimeoutExpired(args, 40)
        exec(code, {})
        return "true"

    monkeypatch.setattr(probe, "docker", docker)
    with pytest.raises(subprocess.TimeoutExpired):
        probe.main("texgen-e01s03-fixture")
    assert not users.filter(username="readiness_" + run_id).exists()
    assert users.filter(pk=other.pk).exists()
