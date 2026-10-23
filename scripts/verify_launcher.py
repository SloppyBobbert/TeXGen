#!/usr/bin/env python3
"""Check the actual launcher without opening a browser or creating compiler jobs.

Run only through the approved output monitor. Uses existing assets and local
Docker metadata. No compilation request, image pull/build, or installation.
"""
import hashlib
import http.client
import json
import os
import signal
import socket
import stat
import subprocess
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOCKET = Path.home() / '.docker/run/docker.sock'
LEDGER = ROOT / 'target/stage6-probes/attempts.jsonl'
JOBS = ROOT / 'target/compiler-jobs'


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def docker_metadata():
    env = {key: value for key, value in os.environ.items() if not key.startswith('DOCKER_')}
    result = {}
    for kind, arguments in {
        'containers': ['ps', '--all', '--no-trunc', '--format', '{{.ID}}'],
        'images': ['image', 'ls', '--no-trunc', '--format', '{{.ID}}'],
        'volumes': ['volume', 'ls', '--format', '{{.Name}}'],
    }.items():
        response = subprocess.run(['/usr/local/bin/docker', '--host', 'unix://' + str(SOCKET), *arguments],
                                  env=env, capture_output=True, timeout=10, check=True)
        identifiers = sorted(set(response.stdout.splitlines()))
        result[kind] = {'count': len(identifiers), 'sha256': hashlib.sha256(b'\n'.join(identifiers)).hexdigest()}
    return result


def get(path, headers=None):
    connection = http.client.HTTPConnection('127.0.0.1', 3737, timeout=1)
    try:
        connection.request('GET', path, headers=headers or {})
        response = connection.getresponse()
        status, csp = response.status, response.getheader('content-security-policy', '')
        response.read()
        return status, csp
    finally:
        connection.close()


def run_case(private, name, arguments, enabled, shutdown, home=None):
    env = dict(os.environ, TEXGEN_NO_BROWSER='1')
    if home is not None:
        env['HOME'] = str(home)
    log = private / (name + '.log')
    with log.open('wb') as output:
        process = subprocess.Popen([str(ROOT / 'target/release/texgen'), *arguments], cwd=ROOT,
                                   env=env, stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + 20
            while True:
                require(process.poll() is None, 'The owned launcher exited before readiness: ' + name)
                require(time.monotonic() < deadline, 'The owned launcher startup timed out: ' + name)
                if 'ready at http://127.0.0.1:3737' in log.read_text():
                    break
                time.sleep(0.05)
            text = log.read_text()
            require('#launch=' not in text and 'Bearer ' not in text, 'Launcher output exposed a credential.')
            if enabled:
                require('remains disabled:' not in text, 'The verified runtime was not enabled.')
                require(JOBS.is_dir() and not list(JOBS.iterdir()), 'The real compiler did not prepare an empty private root.')
                require(stat.S_IMODE(JOBS.stat().st_mode) == 0o700, 'The compiler root permissions differ.')
            elif arguments:
                require('remains disabled:' in text, 'Missing runtime did not report disabled compilation.')
            status, csp = get('/')
            require(status == 200 and "worker-src 'self'" in csp, 'Production assets/CSP are unavailable.')
            require(get('/api/health', {'X-TeXGen-Client': '1'})[0] == 401, 'Unauthorized health access was accepted.')
            require(get('/api/health', {'Host': 'evil.example'})[0] == 400, 'An invalid host was accepted.')
            require(get('/api/health', {'Origin': 'https://unrelated.example'})[0] == 403, 'An unrelated origin was accepted.')
            process.send_signal(shutdown)
            code = process.wait(timeout=10)
            require(not JOBS.exists() or not list(JOBS.iterdir()), 'Shutdown left a compiler job behind.')
            return {'case': name, 'runtimeInitialized': enabled, 'unauthorizedHealthDenied': True,
                    'productionAssetsAndCsp': True, 'signal': shutdown.name, 'exitCode': code,
                    'gracefulShutdown': code == 0, 'browserOpened': False, 'compileRequests': 0}
        finally:
            if process.poll() is None:
                process.send_signal(signal.SIGINT)
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


def main():
    os.umask(0o077)
    require((ROOT / 'target/release/texgen').is_file(), 'The existing release launcher is required.')
    require(SOCKET.exists() and stat.S_ISSOCK(SOCKET.stat().st_mode), 'The existing local Docker socket is required.')
    require(len(LEDGER.read_text().splitlines()) == 16 and not (LEDGER.parent / 'active.json').exists(), 'The exhausted image ledger differs.')
    require(not JOBS.exists() or not list(JOBS.iterdir()), 'An existing private job requires review; do not delete it.')
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 3737))
    before = digest(LEDGER)
    objects = docker_metadata()
    with tempfile.TemporaryDirectory(prefix='launcher-check-', dir=ROOT / 'target') as temporary:
        private = Path(temporary)
        cases = [run_case(private, 'default', [], False, signal.SIGINT),
                 run_case(private, 'opt-in', ['--compiler'], True, signal.SIGINT),
                 run_case(private, 'missing-socket', ['--compiler'], False, signal.SIGINT, private / 'missing-home'),
                 run_case(private, 'terminate', ['--compiler'], True, signal.SIGTERM)]
    require(digest(LEDGER) == before and not (LEDGER.parent / 'active.json').exists(), 'The image ledger changed.')
    require(docker_metadata() == objects, 'Docker object identities changed during metadata-only startup checks.')
    report = {'cases': cases, 'imageAttempts': 16, 'imageLedgerUnchanged': True,
              'dockerObjectsUnchanged': True, 'authenticatedBrowserAvailabilityChecked': False,
              'temporaryLogsRemoved': True, 'compileRequests': 0}
    path = ROOT / 'target' / ('launcher-check-' + str(time.time_ns()) + '.json')
    with path.open('x') as output:
        json.dump(report, output, indent=2)
        output.write('\n')
    print(json.dumps(report, sort_keys=True))
    require(all(case['gracefulShutdown'] for case in cases), 'A launcher shutdown signal did not drain gracefully.')


if __name__ == '__main__':
    main()
