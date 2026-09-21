"""Failure checks use fake Docker commands or disposable local Python children only."""

import importlib.util
import json
import os
import select
import signal
import subprocess
import sys

import pytest

from api.test_production_runtime import BACKEND, verifier_fixture

ROOT = BACKEND.parent


@pytest.mark.parametrize("ambient", [True, False])
@pytest.mark.parametrize("url", [
    "postgres://texgen:secret-marker@external.invalid:5432/texgen",
    "postgres://texgen:secret-marker@db:5432/texgen?hostaddr=203.0.113.1",
])
def test_verifier_rejects_external_database_before_mutation(tmp_path, ambient, url):
    log, env = verifier_fixture(tmp_path)
    env["DATABASE_URL" if ambient else "PROBE_DATABASE_URL"] = url
    result = subprocess.run(["bash", "scripts/verify-production.sh"], cwd=tmp_path,
                            env=env, capture_output=True, text=True, timeout=15)
    assert result.returncode != 0
    commands = [json.loads(line)["args"] for line in log.read_text().splitlines()] if log.exists() else []
    assert all("config" in command for command in commands)
    assert "secret-marker" not in result.stdout + result.stderr
    assert not list((tmp_path / ".pi").glob("verification.*"))


def test_verifier_restores_budget_and_cleans_orphan_after_interrupted_probe(tmp_path):
    log, env = verifier_fixture(tmp_path)
    orphan = tmp_path / "orphan"
    env["PROBE_ORPHAN"] = str(orphan)
    (tmp_path / "frontend/scripts/check-production-image.py").write_text(
        "import os,signal,time\nfrom pathlib import Path\n"
        "Path(os.environ['PROBE_ORPHAN']).write_text(os.environ['TEXGEN_VERIFICATION_ID'])\n"
        "os.kill(os.getppid(),signal.SIGTERM)\ntime.sleep(60)\n"
    )
    result = subprocess.run(["bash", "scripts/verify-production.sh"], cwd=tmp_path,
                            env=env, capture_output=True, text=True, timeout=15)
    assert result.returncode != 0
    commands = [json.loads(line) for line in log.read_text().splitlines()]
    assert [row["budget"] for row in commands if "up" in row["args"]] == ["60", "60"]
    assert [row["args"] for row in commands if row["args"][0] == "rm"] == [["rm", "--force", "owned-probe"]]
    assert not orphan.exists()
    assert "PASS: local production verification" not in result.stdout


@pytest.mark.parametrize("stage", ["browser", "captured-lookup", "preparation", "preflight-config", "preflight-images", "preflight-inspect"])
def test_outer_verifier_cancellation_stops_browser_and_restores_budget(tmp_path, stage):
    log, env = verifier_fixture(tmp_path)
    ready = tmp_path / "browser-ready"
    os.mkfifo(ready)
    ready_fd = os.open(ready, os.O_RDWR | os.O_NONBLOCK)
    env["PROBE_READY"] = str(ready)
    descendant = (
        "import json,os,signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);"
        "f=open(os.environ['PROBE_READY'],'w');"
        "f.write(json.dumps([os.getpid(),os.getpgrp()]));f.close();time.sleep(60)"
    )
    preflight = stage not in {"browser", "captured-lookup"}
    if preflight:
        env.update(PROBE_PREFLIGHT_STAGE=stage, PROBE_CHILD_SCRIPT=descendant)
    elif stage == "captured-lookup":
        env["PROBE_LOOKUP_SCRIPT"] = descendant
    (tmp_path / "frontend/node_modules/.bin/playwright").write_text(
        f"#!{sys.executable}\nimport subprocess,sys,time\n"
        f"subprocess.Popen([sys.executable,'-c',{descendant!r}])\ntime.sleep(60)\n"
    )
    process = subprocess.Popen(["bash", "scripts/verify-production.sh"], cwd=tmp_path,
                               env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True, start_new_session=True)
    group = None
    try:
        assert select.select([ready_fd], [], [], 10)[0], "Browser did not report readiness"
        child_pid, group = json.loads(os.read(ready_fd, 4096))
        # Signal ONLY the outer shell, not its supervisor or process group.
        process.send_signal(signal.SIGTERM)
        stdout, _stderr = process.communicate(timeout=12)
        assert process.returncode != 0
        commands = [json.loads(line) for line in log.read_text().splitlines()]
        starts = [row["budget"] for row in commands if "up" in row["args"]]
        assert starts == ([] if preflight else ["60", "600", "60"])
        if preflight:
            assert all(not set(row["args"]) & {"up", "exec", "rm", "stop", "start"} for row in commands)
        assert not list((tmp_path / ".pi").glob("verification.*"))
        assert "PASS: local production verification" not in stdout
        state = subprocess.run(["ps", "-o", "stat=", "-p", str(child_pid)], capture_output=True, text=True, timeout=5)
        assert not state.stdout.strip() or state.stdout.strip().startswith("Z"), "Browser descendant is still running"
    finally:
        os.close(ready_fd)
        if group is not None:
            try:
                os.killpg(group, signal.SIGKILL)
            except ProcessLookupError:
                pass
        try:
            process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate(timeout=5)


def load_script(path, monkeypatch):
    monkeypatch.syspath_prepend(str(ROOT / "scripts"))
    spec = importlib.util.spec_from_file_location("verification_test_subject", ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_cleanup_attempts_every_owned_resource_after_first_failure(monkeypatch):
    support = load_script("scripts/verification_support.py", monkeypatch)
    calls = []
    run_id = "a" * 32

    def docker(args, **_kwargs):
        calls.append(args)
        if args[1] == "ps":
            return subprocess.CompletedProcess(args, 0, stdout="first\nsecond\n")
        if args[1:3] == ["volume", "ls"]:
            return subprocess.CompletedProcess(args, 0, stdout="socket-volume\n")
        if args[-1] == "first":
            raise subprocess.TimeoutExpired(args, 30)
        return subprocess.CompletedProcess(args, 0)

    monkeypatch.setattr(support.subprocess, "run", docker)
    with pytest.raises(RuntimeError, match="cleanup failed"):
        support.cleanup(run_id)
    assert ["docker", "rm", "--force", "second"] in calls
    assert ["docker", "volume", "rm", "socket-volume"] in calls
    assert all(f"label={support.LABEL}={run_id}" in args for args in calls if "--filter" in args)


@pytest.mark.parametrize("path", ["frontend/scripts/check-production-image.py", "scripts/check-proxy-scheme.py"])
def test_probe_creation_timeout_still_runs_owned_cleanup(monkeypatch, path):
    probe = load_script(path, monkeypatch)
    run_id = "b" * 32
    monkeypatch.setenv("TEXGEN_VERIFICATION_ID", run_id)
    calls, cleaned = [], []

    def docker(*args):
        calls.append(args)
        if args[0] == "image":
            return json.dumps([{"Config": {"User": "10001:10001"}, "Id": "prepared"}])
        if args[0] == "run":
            assert "--name" in args
            assert f"texgen.verification.run={run_id}" in args
            # The daemon created the named/labeled container but the CLI lost its response.
            raise subprocess.TimeoutExpired(args, 30)
        return "prepared"

    monkeypatch.setattr(probe, "docker", docker)
    monkeypatch.setattr(probe, "cleanup", cleaned.append)
    with pytest.raises(subprocess.TimeoutExpired):
        probe.main()
    assert any(args[0] == "run" for args in calls)
    assert cleaned == [run_id]


@pytest.mark.parametrize("interrupt", [False, True])
def test_bounded_runner_stops_descendants_after_timeout_or_signal(interrupt):
    descendant = "import os,signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);print(os.getpid(),flush=True);time.sleep(60)"
    launcher = f"import subprocess,sys,time;subprocess.Popen([sys.executable,'-c',{descendant!r}]);time.sleep(60)"
    program = f"import sys;sys.path.insert(0,{str(ROOT / 'scripts')!r});from verification_support import run;run([sys.executable,'-c',{launcher!r}],timeout={600 if interrupt else 1})"
    process = subprocess.Popen([sys.executable, "-c", program], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    child_pid = None
    try:
        assert select.select([process.stdout], [], [], 5)[0], "Child did not report readiness"
        child_pid = int(process.stdout.readline())
        if interrupt:
            process.send_signal(signal.SIGTERM)
        process.communicate(timeout=12)
        assert process.returncode != 0
        state = subprocess.run(["ps", "-o", "stat=", "-p", str(child_pid)], capture_output=True, text=True, timeout=5)
        assert not state.stdout.strip() or state.stdout.strip().startswith("Z"), "Owned descendant is still running"
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        if child_pid is not None:
            try:
                os.kill(child_pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
