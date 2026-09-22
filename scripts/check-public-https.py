"""Bounded loopback-only TLS probe; no public deployment or certificate provisioning."""

import http.client
import importlib.util
import json
import os
from pathlib import Path
import signal
import ssl
import subprocess
import tempfile
import time
from uuid import UUID, uuid4

from verification_support import LABEL, ROOT, cleanup, interrupted

spec = importlib.util.spec_from_file_location("scheme_probe", ROOT / "scripts/check-proxy-scheme.py")
assert spec is not None and spec.loader is not None
scheme_probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scheme_probe)
docker = scheme_probe.docker
HOST = "texgen.example.test"


def request(port, path="/api/probe", *, context=None, host=HOST, headers=None):
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    connection.connect()
    if context is not None:
        connection.sock = context.wrap_socket(connection.sock, server_hostname=HOST)
    try:
        connection.request("GET", path, headers={"Host": host, **(headers or {})})
        response = connection.getresponse()
        return response.status, dict(response.getheaders()), response.read()
    finally:
        connection.close()


def main():
    backend = docker("image", "inspect", os.getenv("TEXGEN_BACKEND_IMAGE", "texgen-e01s03-backend:test"), "--format", "{{.Id}}")
    frontend = docker("image", "inspect", os.getenv("TEXGEN_FRONTEND_IMAGE", "texgen-e01s03-frontend:test"), "--format", "{{.Id}}")
    run_id = os.getenv("TEXGEN_VERIFICATION_ID", uuid4().hex)
    assert UUID(run_id).hex == run_id
    volume = "texgen-https-" + run_id
    common = ["--label", f"{LABEL}={run_id}", "--pull=never", "--user=10001:10001",
              "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges:true",
              "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=16m,uid=10001,gid=10001,mode=0700"]
    frontend_limits = ["--pids-limit=16", "--memory=64m", "--memory-swap=64m", "--cpus=0.50"]
    try:
        docker("volume", "create", "--label", f"{LABEL}={run_id}", volume)
        with tempfile.TemporaryDirectory(prefix="texgen-https-") as directory:
            directory = Path(directory)
            tls = directory / "tls"
            tls.mkdir()
            subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
                            "-subj", f"/CN={HOST}", "-addext", f"subjectAltName=DNS:{HOST}",
                            "-keyout", str(tls / "privkey.pem"), "-out", str(tls / "fullchain.pem")],
                           check=True, capture_output=True, timeout=15)
            # Synthetic disposable key only; mount readable by the non-root image UID.
            (tls / "privkey.pem").chmod(0o644)
            probe = directory / "probe.py"
            probe.write_text(scheme_probe.PROBE)
            probe.chmod(0o644)
            static = directory / "static"
            static.mkdir()
            (static / "probe.css").write_text("/* static probe */\n")
            docker("run", "--detach", "--name", volume + "-backend", *common,
                   "--pids-limit=64", "--memory=512m", "--memory-swap=512m", "--cpus=1", "--network=none",
                   "--mount", f"type=volume,src={volume},dst=/run/texgen-web",
                   "--mount", f"type=bind,src={probe},dst=/probe/probe.py,readonly",
                   backend, "gunicorn", "--config", "/app/gunicorn.conf.py", "--chdir", "/probe", "probe:application")
            mounts = ["--mount", f"type=volume,src={volume},dst=/run/texgen-web,readonly",
                      "--mount", f"type=bind,src={static},dst=/srv/django-static,readonly",
                      "--mount", f"type=bind,src={tls},dst=/run/texgen-tls,readonly",
                      "--mount", f"type=bind,src={ROOT}/frontend/nginx.public.conf.template,dst=/etc/nginx/public.conf.template,readonly",
                      "--mount", f"type=bind,src={ROOT}/scripts/start-public-nginx.sh,dst=/opt/texgen/start-public-nginx.sh,readonly"]
            proxy = volume + "-proxy"
            docker("run", "--detach", "--name", proxy, *common, *frontend_limits,
                   "--publish", "127.0.0.1::8443", "--publish", "127.0.0.1::8081", *mounts,
                   "--env", f"TEXGEN_PUBLIC_HOST={HOST}", "--entrypoint", "sh", frontend, "/opt/texgen/start-public-nginx.sh")
            bindings = json.loads(docker("inspect", proxy))[0]["NetworkSettings"]["Ports"]
            ports = {}
            for target in ("8443/tcp", "8081/tcp"):
                binding = bindings[target][0]
                assert binding["HostIp"] == "127.0.0.1"
                ports[target] = int(binding["HostPort"])
            assert not bindings.get("8080/tcp")
            context = ssl.create_default_context(cafile=str(tls / "fullchain.pem"))
            https, http_port = ports["8443/tcp"], ports["8081/tcp"]
            deadline = time.monotonic() + 15
            while True:
                try:
                    status, _, body = request(https, context=context)
                    if status == 200:
                        break
                except (OSError, http.client.HTTPException):
                    pass
                if time.monotonic() >= deadline:
                    raise RuntimeError("TLS probe did not become ready")
                time.sleep(0.1)
            forged = {"X-Forwarded-Proto": "http", "X-Forwarded-For": "203.0.113.10",
                      "X-Real-IP": "203.0.113.11", "X-Forwarded-Host": "evil.invalid",
                      "X-Forwarded-Port": "80", "Forwarded": "for=203.0.113.12;proto=http"}
            status, headers, body = request(https, context=context, headers=forged)
            values = json.loads(body)
            assert status == 200
            assert values["wsgi.url_scheme"] == values["HTTP_X_FORWARDED_PROTO"] == "https"
            assert values["HTTP_X_REAL_IP"] == values["HTTP_X_FORWARDED_FOR"]
            assert values["HTTP_X_REAL_IP"] not in (None, "203.0.113.10", "203.0.113.11")
            assert all(values[key] is None for key in ("HTTP_X_FORWARDED_HOST", "HTTP_X_FORWARDED_PORT", "HTTP_FORWARDED"))
            assert headers["X-Content-Type-Options"] == "nosniff"
            assert headers["X-Frame-Options"] == "DENY"
            assert headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
            assert headers["Cache-Control"] == "no-store"
            status, headers, _ = request(http_port, "/a?b=1", headers=forged)
            assert status == 308 and headers["Location"] == f"https://{HOST}/a?b=1"
            for port, ctx in ((http_port, None), (https, context)):
                for path in ("/api/probe", f"https://{HOST}/api/probe"):
                    try:
                        request(port, path, context=ctx, host="evil.invalid")
                    except (http.client.RemoteDisconnected, ConnectionResetError):
                        pass
                    else:
                        raise AssertionError("Unknown Host accepted")
            assert request(https, "/healthz", context=context)[::2] == (200, b"ok\n")
            status, _, body = request(https, "/admin/", context=context)
            assert status == 200 and json.loads(body)["wsgi.url_scheme"] == "https"
            status, headers, body = request(https, "/static/probe.css", context=context)
            assert status == 200 and body == b"/* static probe */\n" and headers["Cache-Control"] == "no-store"
            status, headers, body = request(https, "/", context=context)
            assert status == 200 and b"<html" in body and headers["Cache-Control"] == "no-store"
            assets = docker("exec", proxy, "sh", "-c", "find /usr/share/nginx/html/assets -type f").splitlines()
            asset = next(path for path in assets if path.endswith(".js"))
            status, headers, body = request(https, asset.removeprefix("/usr/share/nginx/html"), context=context)
            assert status == 200 and body and headers["Cache-Control"] == "public, max-age=31536000, immutable"
            assert docker("exec", proxy, "wget", "-qO-", "http://127.0.0.1:8080/healthz") == "ok"
            # Failures use the same entrypoint and mounts, with no network or published ports.
            for index, hostname in enumerate(("evil.invalid;", HOST, HOST)):
                if index == 1:
                    (tls / "privkey.pem").unlink()
                if index == 2:
                    (tls / "privkey.pem").write_text("invalid key\n")
                name = volume + f"-failure-{index}"
                docker("run", "--detach", "--name", name, *common, *frontend_limits, "--network=none", *mounts,
                       "--env", f"TEXGEN_PUBLIC_HOST={hostname}", "--entrypoint", "sh", frontend, "/opt/texgen/start-public-nginx.sh")
                assert docker("wait", name) != "0"
            print("PASS: verified TLS trust/hostname, Unix HTTPS scheme, sanitized headers, fixed redirect, Host rejection, health/static/cache, fail-closed inputs")
            print("Verified images:", backend, frontend)
    finally:
        # As in verification_support.run, ignore repeated cancellation while cleaning up.
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        cleanup(run_id)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    main()
