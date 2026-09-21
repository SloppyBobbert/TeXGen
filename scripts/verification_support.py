"""Configuration isolation and bounded process/resource cleanup for local verification."""

from copy import deepcopy
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
LABEL = "texgen.verification.run"


def prepare(project, destination):
    source = ROOT / "docker-compose.production.yml"
    names = set(re.findall(r"\$\{([A-Z][A-Z0-9_]*)", source.read_text()))
    if any(name in os.environ for name in names):
        raise ValueError("Unset exported Compose configuration variables; use the dedicated fixture file")
    result = subprocess.run(
        ["docker", "compose", "--env-file", str(ROOT / ".pi/production-test.env"),
         "-p", project, "-f", str(source), "config", "--format", "json"],
        capture_output=True, text=True, check=True, timeout=30,
    )
    config = json.loads(result.stdout)
    for name in ("backend", "migrate"):
        raw = config["services"][name]["environment"]["DATABASE_URL"]
        url = urlsplit(raw)
        if (any(c.isspace() for c in raw) or url.scheme not in {"postgres", "postgresql"}
                or url.hostname != "db" or url.port != 5432 or url.username != "texgen"
                or not url.password or url.path != "/texgen" or url.query or url.fragment):
            raise ValueError("Verification requires the owned db:5432/texgen application database")
    for budget in (60, 600):
        snapshot = deepcopy(config)
        for name in ("backend", "migrate"):
            snapshot["services"][name]["environment"]["REQUEST_THROTTLE_ANON_LIMIT"] = str(budget)
        path = Path(destination) / f"{budget}.json"
        # Compose must not expand literal dollar signs in the already resolved configuration.
        data = json.dumps(snapshot).replace("$", "$$")
        with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as output:
            output.write(data)


def interrupted(signum, _frame):
    raise SystemExit(128 + signum)


def kill_group(pid, sig):
    try:
        os.killpg(pid, sig)
    except ProcessLookupError:
        pass


def run(command, timeout=600):
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    child = subprocess.Popen(command, start_new_session=True)
    try:
        status = child.wait(timeout=timeout)
        if status:
            raise subprocess.CalledProcessError(status, command)
    finally:
        # Also remove descendants if their launcher exited before them.
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        kill_group(child.pid, signal.SIGTERM)
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass
        finally:
            kill_group(child.pid, signal.SIGKILL)
            child.wait(timeout=5)


def cleanup(run_id):
    if not re.fullmatch(r"[0-9a-f]{32}", run_id):
        raise ValueError("Invalid verification ownership identifier")
    failures = []
    for kind, listing, formatting in (("container", ["ps", "--all"], "{{.ID}}"),
                                      ("volume", ["volume", "ls"], "{{.Name}}")):
        try:
            result = subprocess.run(
                ["docker", *listing, "--filter", f"label={LABEL}={run_id}", "--format", formatting],
                capture_output=True, text=True, check=True, timeout=30,
            )
        except (subprocess.SubprocessError, OSError) as error:
            failures.append(type(error).__name__)
            continue
        for identifier in result.stdout.splitlines():
            try:
                args = ["docker", "rm", "--force", identifier] if kind == "container" else ["docker", "volume", "rm", identifier]
                subprocess.run(args, capture_output=True, check=True, timeout=30)
            except (subprocess.SubprocessError, OSError) as error:
                failures.append(type(error).__name__)
    if failures:
        raise RuntimeError("Owned probe cleanup failed; inspect resources with this run's ownership label")


if __name__ == "__main__":
    try:
        if sys.argv[1] == "prepare":
            prepare(sys.argv[2], sys.argv[3])
        elif sys.argv[1] == "cleanup":
            cleanup(sys.argv[2])
        elif sys.argv[1] == "run":
            run(sys.argv[2:])
        else:
            raise ValueError("Unknown verification operation")
    except (ValueError, KeyError, OSError, subprocess.SubprocessError, RuntimeError):
        # Configuration and command errors must not expose resolved credentials.
        raise SystemExit("Verification support operation failed; no configuration values were printed") from None
