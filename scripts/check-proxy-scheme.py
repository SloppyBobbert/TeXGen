"""Verify the installed proxy/server configuration using a temporary WSGI probe."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import signal
from urllib.error import URLError
from urllib.request import ProxyHandler, Request, build_opener
from uuid import UUID, uuid4

from verification_support import LABEL, cleanup, interrupted


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True, timeout=30).strip()


PROBE = '''import json
def application(environ, start_response):
    keys = ['wsgi.url_scheme', 'HTTP_X_FORWARDED_PROTO', 'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_HOST', 'HTTP_X_FORWARDED_PORT', 'HTTP_FORWARDED']
    body = json.dumps({key: environ.get(key) for key in keys}).encode()
    start_response('200 OK', [('Content-Type', 'application/json'), ('Content-Length', str(len(body)))])
    return [body]
'''

UNIX_HTTPS = r'''import http.client,json,socket,os,stat
path='/run/texgen-web/app.sock'
s=os.stat(path)
assert s.st_uid == s.st_gid == 10001
assert stat.S_IMODE(s.st_mode) == 0o770
c=socket.socket(socket.AF_UNIX);c.settimeout(5);c.connect(path)
c.sendall(b'GET / HTTP/1.1\r\nHost: localhost\r\nX-Forwarded-Proto: https\r\nConnection: close\r\n\r\n')
r=http.client.HTTPResponse(c);r.begin();assert r.status == 200
assert json.loads(r.read())['wsgi.url_scheme'] == 'https'
c.close();print('PASS: trusted Unix HTTPS and socket ownership/mode')
'''

DENIED = '''import socket
s=socket.socket(socket.AF_UNIX);s.settimeout(5)
try:
    s.connect('/run/texgen-web/app.sock')
except PermissionError:
    print('PASS: another UID cannot connect')
else:
    raise AssertionError('Untrusted UID connected to the server socket')
finally:
    s.close()
'''


def main():
    backend = docker('image', 'inspect', os.getenv('TEXGEN_BACKEND_IMAGE', 'texgen-e01s03-backend:test'), '--format', '{{.Id}}')
    frontend = docker('image', 'inspect', os.getenv('TEXGEN_FRONTEND_IMAGE', 'texgen-e01s03-frontend:test'), '--format', '{{.Id}}')
    run_id = os.getenv('TEXGEN_VERIFICATION_ID', uuid4().hex)
    assert UUID(run_id).hex == run_id
    volume = 'texgen-scheme-' + run_id
    app, proxy, denied = (volume + suffix for suffix in ('-backend', '-proxy', '-denied'))
    common = ['--label', f'{LABEL}={run_id}', '--pull=never', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges:true',
              '--pids-limit=64', '--memory=512m', '--memory-swap=512m', '--cpus=1',
              '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=16m,uid=10001,gid=10001,mode=0700']
    try:
        docker('volume', 'create', '--label', f'{LABEL}={run_id}', volume)
        with tempfile.TemporaryDirectory(prefix='texgen-scheme-') as directory:
            probe = Path(directory) / 'probe.py'
            probe.write_text(PROBE)
            probe.chmod(0o644)
            docker('run', '--detach', '--name', app, *common, '--network=none',
                         '--mount', f'type=volume,src={volume},dst=/run/texgen-web',
                         '--mount', f'type=bind,src={probe},dst=/probe/probe.py,readonly',
                         backend, 'gunicorn', '--config', '/app/gunicorn.conf.py', '--chdir', '/probe', 'probe:application')
            docker('run', '--detach', '--name', proxy, *common, '--publish', '127.0.0.1::8080',
                           '--mount', f'type=volume,src={volume},dst=/run/texgen-web,readonly', frontend)
            info = json.loads(docker('inspect', proxy))[0]
            binding = info['NetworkSettings']['Ports']['8080/tcp'][0]
            assert binding['HostIp'] == '127.0.0.1'
            url = 'http://127.0.0.1:' + str(int(binding['HostPort'])) + '/api/probe'
            opener = build_opener(ProxyHandler({}))
            deadline = time.monotonic() + 15
            while True:
                try:
                    with opener.open(url, timeout=2) as response:
                        response.read()
                    break
                except (OSError, URLError):
                    if time.monotonic() >= deadline:
                        raise
                    time.sleep(0.1)
            forged = {'X-Forwarded-Proto': 'https', 'X-Forwarded-For': '203.0.113.10',
                      'X-Real-IP': '203.0.113.11', 'X-Forwarded-Host': 'untrusted.invalid',
                      'X-Forwarded-Port': '443', 'Forwarded': 'for=203.0.113.12;proto=https'}
            with opener.open(Request(url, headers=forged), timeout=5) as response:
                values = json.load(response)
            assert values['wsgi.url_scheme'] == values['HTTP_X_FORWARDED_PROTO'] == 'http'
            assert values['HTTP_X_FORWARDED_FOR'] == values['HTTP_X_REAL_IP']
            assert values['HTTP_X_REAL_IP'] not in (None, '203.0.113.10', '203.0.113.11')
            assert all(values[key] is None for key in ('HTTP_X_FORWARDED_HOST', 'HTTP_X_FORWARDED_PORT', 'HTTP_FORWARDED'))
            print('PASS: client scheme/address/forwarded headers are replaced or removed')
            print(docker('exec', app, 'python', '-c', UNIX_HTTPS))
            print(docker('run', '--rm', '--name', denied, *common, '--network=none', '--user=10002:10002',
                         '--mount', f'type=volume,src={volume},dst=/run/texgen-web,readonly',
                         backend, 'python', '-c', DENIED))
            print('Verified images:', backend, frontend)
    finally:
        cleanup(run_id)


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    main()
