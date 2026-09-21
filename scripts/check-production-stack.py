"""Probe an owned loopback test stack without builds, pulls, or installs."""

import json
import subprocess
import sys
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True, timeout=30).strip()


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


OPENER = build_opener(ProxyHandler({}), NoRedirect)


def main(project):
    assert project.startswith("texgen-e01s03-"), "Only owned verification projects are supported"
    ids = docker("ps", "--all", "--filter", f"label=com.docker.compose.project={project}",
                 "--format", "{{.ID}}").splitlines()
    services = {}
    for cid in ids:
        item = json.loads(docker("inspect", cid))[0]
        services[item["Config"]["Labels"]["com.docker.compose.service"]] = item
    assert set(services) == {"backend", "frontend", "db", "compiler", "migrate"}
    assert services["migrate"]["State"]["Status"] == "exited"
    assert services["migrate"]["State"]["ExitCode"] == 0
    for name in ("backend", "frontend", "db", "compiler"):
        assert services[name]["State"]["Running"], name
        assert services[name]["State"]["Health"]["Status"] == "healthy", name
    limits = {"backend": (64, 512, 1_000_000_000), "migrate": (64, 512, 1_000_000_000),
              "frontend": (16, 64, 500_000_000), "compiler": (32, 256, 500_000_000)}
    for name, (pids, memory_mb, nano_cpus) in limits.items():
        item = services[name]
        host = item["HostConfig"]
        assert item["Config"]["User"] == "10001:10001", name
        assert host["ReadonlyRootfs"] and host["CapDrop"] == ["ALL"], name
        assert "no-new-privileges:true" in host["SecurityOpt"], name
        assert host["PidsLimit"] == pids, name
        assert host["Memory"] == host["MemorySwap"] == memory_mb * 1024 * 1024, name
        assert host["NanoCpus"] == nano_cpus, name
        restart = {"Name": "no", "MaximumRetryCount": 0} if name == "migrate" else {"Name": "on-failure", "MaximumRetryCount": 3}
        assert host["RestartPolicy"] == restart, name
        if name != "frontend":
            assert not host["PortBindings"], name
        print(f"PASS: {name} restrictions; image {item['Image']}")
    compiler = services["compiler"]
    assert compiler["HostConfig"]["NetworkMode"] == "none"
    assert set(compiler["NetworkSettings"]["Networks"]) <= {"none"}
    assert "size=64m" in compiler["HostConfig"]["Tmpfs"]["/work"]
    assert set(compiler["HostConfig"]["Tmpfs"]["/work"].split(",")) >= {"noexec", "nosuid", "nodev"}
    assert {mount["Destination"] for mount in compiler["Mounts"]} == {"/run/texgen"}
    socket = next(mount for mount in services["backend"]["Mounts"] if mount["Destination"] == "/run/texgen")
    assert not socket["RW"]
    binding = services["frontend"]["NetworkSettings"]["Ports"]["8080/tcp"][0]
    assert binding["HostIp"] == "127.0.0.1"
    base = "http://127.0.0.1:" + str(int(binding["HostPort"]))
    backend = services["backend"]["Id"]

    def request(path, headers=None):
        try:
            with OPENER.open(Request(base + path, headers=headers or {}), timeout=10) as response:
                return response.status
        except HTTPError as error:
            status = error.code
            error.close()
            return status

    def python(code):
        return json.loads(docker("exec", backend, "python", "-c",
                                "import django,json;django.setup();" + code))

    def windows():
        return python("from api.models import RequestThrottleWindow;"
                      "print(json.dumps({r.key:[r.window_start,r.count] "
                      "for r in RequestThrottleWindow.objects.all()}))")

    assert request("/api/health/") == 200
    assert request("/static/admin/css/base.css") == 200
    assert request("/api/classes/", {"Host": "untrusted.invalid",
                                   "X-Forwarded-Host": "localhost"}) == 400
    keys = []
    before = windows()
    for headers in ({}, {"X-Forwarded-For": "203.0.113.10", "X-Real-IP": "203.0.113.11",
                         "X-Forwarded-Host": "untrusted.invalid", "X-Forwarded-Proto": "https",
                         "Forwarded": "for=203.0.113.12;proto=https;host=untrusted.invalid"},
                    {"X-Forwarded-For": "198.51.100.20, 198.51.100.21"}):
        assert request("/api/classes/", headers) == 200
        after = windows()
        changed = [key for key, value in after.items() if before.get(key) != value]
        assert len(changed) == 1, "Expected one admitted request identity"
        keys.extend(changed)
        before = after
    assert len(set(keys)) == 1, "Forwarded client headers changed the request identity"
    print("PASS: startup, static collection, API proxy, Host rejection, stable throttle identity")

    flags = python("from django.db import connection;c=connection.cursor();"
                   "c.execute('SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles "
                   "WHERE rolname = current_user');print(json.dumps(c.fetchone()))")
    assert flags == [False, False, False], "Application database role has administrative privileges"
    print("PASS: application database role has no superuser, database-create, or role-create privileges")
    pending = python("from django.db import connection;from django.db.migrations.executor import MigrationExecutor;"
                     "e=MigrationExecutor(connection);print(json.dumps(bool(e.migration_plan(e.loader.graph.leaf_nodes()))))")
    assert not pending, "Database migrations are pending"
    limits = python("from api.compilation.service import compile_limits_from_settings;"
                    "from dataclasses import asdict;print(json.dumps(asdict(compile_limits_from_settings())))")
    assert limits == {"source_max_bytes": 262144, "timeout_seconds": 15.0,
                      "pdf_max_bytes": 10485760, "diagnostics_max_bytes": 4096,
                      "cpu_seconds": 10, "address_space_bytes": 536870912,
                      "file_size_bytes": 10485760, "process_count": 32, "open_files": 64}
    print("PASS: no pending migrations; compiler source/time/output/process limits match the approved defaults")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/check-production-stack.py OWNED_PROJECT")
    main(sys.argv[1])
