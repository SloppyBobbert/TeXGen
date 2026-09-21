import json
import os
from pathlib import Path
import shutil
import re
import runpy
import subprocess
import sys


BACKEND = Path(__file__).resolve().parents[1]


def test_gunicorn_binds_only_a_private_socket_with_bounded_workers():
    config = runpy.run_path(str(BACKEND / "gunicorn.conf.py"))

    assert config["bind"] == "unix:/run/texgen-web/app.sock"
    assert config["workers"] == 2
    assert config["worker_class"] == "sync"
    assert config["timeout"] == 30
    assert config["graceful_timeout"] == 30
    assert config["umask"] == 0o007
    from gunicorn.config import Config

    parsed = Config()
    for name in ("forwarded_allow_ips", "forwarder_headers"):
        parsed.set(name, config[name])
        assert getattr(parsed, name) == []
    assert config["secure_scheme_headers"] == {"X-FORWARDED-PROTO": "https"}
    assert config["reload"] is False
    assert config["preload_app"] is False
    # Disable access logs to avoid recording request URLs and headers.
    assert config["accesslog"] is None
    assert config["errorlog"] == "-"


def test_gunicorn_accepts_production_configuration_without_starting_server():
    result = subprocess.run(
        [sys.executable, "-m", "gunicorn", "--check-config", "--config", "gunicorn.conf.py",
         "cheat_sheet.wsgi:application"],
        cwd=BACKEND,
        env={
            **os.environ,
            "DJANGO_DEBUG": "False",
            "DJANGO_SECRET_KEY": "runtime-config-test-only-" + "x" * 64,
            "JWT_SIGNING_KEY": "runtime-jwt-test-only-" + "y" * 64,
            "DATABASE_URL": "postgres://test:test@127.0.0.1/test",
            "DJANGO_ALLOWED_HOSTS": "localhost,127.0.0.1",
            "COMPILER_BACKEND": "disabled",
            "GUNICORN_CMD_ARGS": "",
        },
        capture_output=True, text=True, timeout=15, check=False,
    )
    assert result.returncode == 0, result.stderr


def verifier_fixture(tmp_path):
    for directory in ("scripts", ".pi", "frontend/scripts", "frontend/node_modules/.bin", "backend/tests", "bin"):
        (tmp_path / directory).mkdir(parents=True, exist_ok=True)
    verifier = BACKEND.parent / "scripts/verify-production.sh"
    shutil.copyfile(verifier, tmp_path / "scripts/verify-production.sh")
    shutil.copyfile(BACKEND.parent / "scripts/verification_support.py", tmp_path / "scripts/verification_support.py")
    shutil.copyfile(BACKEND.parent / "docker-compose.production.yml", tmp_path / "docker-compose.production.yml")
    (tmp_path / ".pi/production-test.project").write_text("texgen-e01s03-fixture\n")
    (tmp_path / ".pi/production-test.env").write_text("TEST_ONLY=1\n")
    for script in ("scripts/check-production-stack.py", "scripts/check-production-failures.py",
                   "scripts/check-proxy-scheme.py", "frontend/scripts/check-production-image.py",
                   "backend/tests/seed_e2e_template.py"):
        (tmp_path / script).write_text("pass\n")
    browser = tmp_path / "frontend/node_modules/.bin/playwright"
    browser.write_text("#!/bin/sh\nexit 23\n")
    browser.chmod(0o755)
    docker = tmp_path / "bin/docker"
    docker.write_text(f"#!{sys.executable}\n" + '''import json,os,sys,subprocess,time
from pathlib import Path
args=sys.argv[1:]
with Path(os.environ['PROBE_LOG']).open('a') as log:
    log.write(json.dumps({'args':args,'budget':os.getenv('REQUEST_THROTTLE_ANON_LIMIT')})+'\\n')
stage=os.getenv('PROBE_PREFLIGHT_STAGE')
preflight={'preparation':'--format' in args and args[-1]=='json',
           'preflight-config':'--quiet' in args,
           'preflight-images':'--images' in args,
           'preflight-inspect':args[:2]==['image','inspect']}
if preflight.get(stage,False):
    subprocess.Popen([sys.executable,'-c',os.environ['PROBE_CHILD_SCRIPT']])
    time.sleep(60)
if '--format' in args and args[-1]=='json':
    environment={'DATABASE_URL':os.getenv('PROBE_DATABASE_URL','postgres://texgen:fixture@db:5432/texgen')}
    print(json.dumps({'services':{name:{'environment':environment} for name in ('backend','migrate')}}))
elif '--images' in args: print('prepared:image')
elif args[0]=='inspect' and 'HostPort' in args[2] and os.getenv('PROBE_LOOKUP_SCRIPT'):
    subprocess.Popen([sys.executable,'-c',os.environ['PROBE_LOOKUP_SCRIPT']])
    time.sleep(60)
elif args[0]=='inspect': print('5173' if 'HostPort' in args[2] else 'sha256:prepared')
elif args[0]=='compose' and 'ps' in args: print('fixture-container')
elif args[0]=='ps' and os.getenv('PROBE_ORPHAN'):
    marker=Path(os.environ['PROBE_ORPHAN'])
    if marker.exists() and 'label=texgen.verification.run='+marker.read_text() in args:
        print('owned-probe')
elif args[:2]==['rm','--force'] and args[-1]=='owned-probe':
    Path(os.environ['PROBE_ORPHAN']).unlink()
''')
    docker.chmod(0o755)
    log = tmp_path / "commands.jsonl"
    names = set(re.findall(r"\$\{([A-Z][A-Z0-9_]*)", (tmp_path / "docker-compose.production.yml").read_text()))
    env = {key: value for key, value in os.environ.items() if key not in names}
    env.update(PATH=str(tmp_path / "bin") + os.pathsep + os.environ["PATH"], PROBE_LOG=str(log))
    return log, env


def test_verifier_restores_default_budget_when_browser_tests_fail(tmp_path):
    log, env = verifier_fixture(tmp_path)
    result = subprocess.run(["bash", "scripts/verify-production.sh"], cwd=tmp_path,
                            env=env, capture_output=True, text=True, timeout=15)
    assert result.returncode != 0
    commands = [json.loads(line) for line in log.read_text().splitlines()]
    starts = [row for row in commands if "up" in row["args"]]
    assert [row["budget"] for row in starts] == ["60", "600", "60"]
    assert all("--no-build" in row["args"] and row["args"][row["args"].index("--pull") + 1] == "never" for row in starts)
    assert all(row["args"][0] not in {"pull", "build", "rm"} for row in commands)
    assert "PASS: local production verification" not in result.stdout
