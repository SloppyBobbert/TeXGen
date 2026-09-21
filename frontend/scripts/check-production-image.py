"""Check an existing local frontend image; never build, pull, or install."""

import json
import os
from pathlib import Path, PurePosixPath
import signal
import subprocess
import sys
import time
from uuid import UUID, uuid4
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, build_opener

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from verification_support import LABEL, cleanup, interrupted


OPENER = build_opener(ProxyHandler({}))


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True, timeout=30).strip()


def main():
    image = os.environ.get("TEXGEN_FRONTEND_IMAGE", "texgen-e01s03-frontend:test")
    metadata = json.loads(docker("image", "inspect", image))[0]
    assert metadata["Config"]["User"] == "10001:10001"
    run_id = os.getenv('TEXGEN_VERIFICATION_ID', uuid4().hex)
    assert UUID(run_id).hex == run_id
    container = 'texgen-static-' + run_id
    try:
        docker(
            "run", "--detach", "--name", container, "--label", f"{LABEL}={run_id}",
            "--pull=never", "--read-only", "--cap-drop=ALL",
            "--security-opt=no-new-privileges:true", "--pids-limit=16",
            "--memory=64m", "--memory-swap=64m", "--cpus=0.5",
            "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=16m",
            "--publish", "127.0.0.1::8080", image,
        )
        info = json.loads(docker("inspect", container))[0]
        binding = info["NetworkSettings"]["Ports"]["8080/tcp"][0]
        assert binding["HostIp"] == "127.0.0.1"
        base = f"http://127.0.0.1:{int(binding['HostPort'])}"
        deadline = time.monotonic() + 15
        while True:
            try:
                with OPENER.open(base + "/healthz", timeout=2) as response:
                    assert response.read() == b"ok\n"
                break
            except (OSError, URLError):
                if time.monotonic() >= deadline:
                    raise
                time.sleep(0.1)

        for path in ("/", "/client-route"):
            with OPENER.open(base + path, timeout=5) as response:
                assert response.headers.get_content_type() == "text/html"
                assert b"<!doctype html>" in response.read().lower()
                assert response.headers["Cache-Control"] == "no-store"
                assert response.headers["X-Content-Type-Options"] == "nosniff"

        for path, status in (("/.env", 403), ("/assets/missing.js", 404)):
            try:
                with OPENER.open(base + path, timeout=5):
                    raise AssertionError(f"Unexpected success for {path}")
            except HTTPError as error:
                assert error.code == status, (path, error.code)
                error.close()

        workers = docker("exec", container, "find", "/usr/share/nginx/html/assets",
                         "-name", "*.mjs", "-type", "f").splitlines()
        assert workers, "PDF module worker is missing"
        for worker in workers:
            with OPENER.open(base + "/assets/" + PurePosixPath(worker).name, timeout=5) as response:
                assert response.headers.get_content_type() in ("application/javascript", "text/javascript"), response.headers
                assert "immutable" in response.headers["Cache-Control"]
                assert response.headers["X-Content-Type-Options"] == "nosniff"
        print(f"PASS: {metadata['Id']}; HTML, SPA fallback, blocked files, PDF worker MIME and cache headers")
    finally:
        cleanup(run_id)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    main()
