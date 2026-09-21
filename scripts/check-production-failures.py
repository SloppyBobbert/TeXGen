"""Stop and restore dependencies only in the recorded disposable test project."""

from concurrent.futures import ThreadPoolExecutor
import json
import os
import signal
from pathlib import Path
import subprocess
import sys
import time
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener
from uuid import UUID, uuid4

from verification_support import interrupted

ROOT = Path(__file__).resolve().parents[1]


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True, timeout=40).strip()


def inspect(container):
    return json.loads(docker("inspect", container))[0]


def wait_healthy(container):
    deadline = time.monotonic() + 120
    while True:
        state = inspect(container)["State"]
        if state["Running"] and state.get("Health", {}).get("Status") == "healthy":
            return
        if time.monotonic() >= deadline:
            raise AssertionError("Dependency did not recover within 120 seconds")
        time.sleep(0.5)


def main(project):
    assert project.startswith("texgen-e01s03-")
    assert (ROOT / ".pi/production-test.project").read_text().strip() == project
    services = {}
    ids = docker("ps", "--filter", f"label=com.docker.compose.project={project}",
                 "--format", "{{.ID}}").splitlines()
    for cid in ids:
        item = inspect(cid)
        labels = item["Config"]["Labels"]
        assert Path(labels["com.docker.compose.project.working_dir"]).resolve() == ROOT
        services[labels["com.docker.compose.service"]] = item
    assert set(services) == {"backend", "frontend", "db", "compiler"}
    assert "TEXGEN_LOCAL_HTTP=1" in services["backend"]["Config"]["Env"]
    binding = services["frontend"]["NetworkSettings"]["Ports"]["8080/tcp"][0]
    assert binding["HostIp"] == "127.0.0.1"
    base = "http://127.0.0.1:" + str(int(binding["HostPort"]))
    backend = services["backend"]["Id"]
    opener = build_opener(ProxyHandler({}))

    def python(code):
        return json.loads(docker("exec", backend, "python", "-c",
                                "import django,json;django.setup();" + code))

    def request(path, data=None, token=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        req = Request(base + path, data=None if data is None else json.dumps(data).encode(), headers=headers)
        try:
            response = opener.open(req, timeout=35)
        except HTTPError as error:
            response = error
        with response:
            return response.status, response.read()

    def not_ready(name):
        result = subprocess.run([sys.executable, str(ROOT / "scripts/check-production-stack.py"), project],
                                capture_output=True, text=True, timeout=40)
        assert result.returncode != 0 and f"AssertionError: {name}" in result.stderr

    run_id = os.getenv("TEXGEN_VERIFICATION_ID", uuid4().hex)
    assert UUID(run_id).hex == run_id
    username = "readiness_" + run_id
    stopped = set()
    try:
        fixture = python("from django.contrib.auth import get_user_model;"
                         "from rest_framework_simplejwt.tokens import AccessToken;"
                         f"u=get_user_model().objects.create_user(username={username!r});"
                         "print(json.dumps({'id':u.pk,'token':str(AccessToken.for_user(u))}))")
        compiler = services["compiler"]["Id"]
        stopped.add(compiler)
        docker("stop", "--time", "10", compiler)
        not_ready("compiler")
        payload = {"content": r"\documentclass{article}\begin{document}Readiness probe\end{document}", "source_mode": "raw"}
        status, _ = request("/api/compile/", payload, fixture["token"])
        assert status == 503, f"Unavailable compiler returned {status}"
        quota_code = ("from api.models import CompileQuotaWindow;"
                      f"print(json.dumps(sum(CompileQuotaWindow.objects.filter(user_id={fixture['id']}).values_list('count',flat=True))))")
        assert python(quota_code) == 0, "Unavailable compiler consumed accepted-compile quota"
        docker("start", compiler)
        wait_healthy(compiler)
        stopped.remove(compiler)
        status, pdf = request("/api/compile/", payload, fixture["token"])
        assert status == 200 and pdf.startswith(b"%PDF-"), "Compilation did not recover"
        assert python(quota_code) == 1
        print("PASS: compiler outage rejects readiness and returns 503 without quota charge; offline PDF compilation recovers")

        # Warm both worker connections so a single healthy worker cannot hide stale reuse.
        connections = 0
        with ThreadPoolExecutor(max_workers=2) as pool:
            for _ in range(5):
                assert all(status == 200 for status, _ in pool.map(lambda _: request("/api/classes/"), range(2)))
                connections = python("from django.db import connection;c=connection.cursor();"
                                     "c.execute(\"SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() "
                                     "AND usename=current_user AND client_addr=inet_client_addr() "
                                     "AND pid<>pg_backend_pid() AND backend_type='client backend'\");"
                                     "print(json.dumps(c.fetchone()[0]))")
                if connections == 2:
                    break
        assert connections == 2, "Both Gunicorn workers must have an open database connection"
        database = services["db"]["Id"]
        stopped.add(database)
        docker("stop", "--time", "10", database)
        not_ready("db")
        status, _ = request("/api/classes/")
        assert status == 503, f"Unavailable throttle database returned {status}"
        assert request("/api/health/")[0] == 200, "Liveness endpoint changed meaning"
        docker("start", database)
        wait_healthy(database)
        stopped.remove(database)
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = [status for status, _ in pool.map(lambda _: request("/api/classes/"), range(6))]
        assert statuses == [200] * 6, f"Database recovery failed without request retries: {statuses}"
        print("PASS: database outage rejects readiness and fails shared admission closed; liveness stays separate; reads recover")
    finally:
        failures = []
        for container in stopped:
            try:
                docker("start", container)
                wait_healthy(container)
            except Exception as error:
                failures.append(type(error).__name__)
        if failures:
            raise RuntimeError(f"Could not restore test dependencies: {failures}")
        python("from django.contrib.auth import get_user_model;"
               f"get_user_model().objects.filter(username={username!r},password__startswith='!').delete();"
               "print(json.dumps(True))")


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/check-production-failures.py OWNED_PROJECT")
    main(sys.argv[1])
