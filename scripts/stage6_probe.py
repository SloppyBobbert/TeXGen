#!/usr/bin/env python3
"""Run one explicitly approved retained-image fixture; never pull or build."""

import argparse
import hashlib
import http.client
import json
import os
import re
import secrets
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'target/stage6-probes'
DOCKER = '/usr/local/bin/docker'
IMAGE = 'sha256:e5d0bc4192004f06fc32f2df5bca1dc90b5918daeb6c8072313493d21edf3b31'
BACKUP = Path('/Users/brandontran/TeXGen-backups/pre-rust-2026-10-17')
MONITOR = BACKUP / 'run_with_budget.py'
MAX_ATTEMPTS = 16
MAX_PDF = 10 * 1024 * 1024
CASES = {'canonical': 'approved_canonical_fixture', 'raw': 'approved_raw_fixture',
         'timeout': 'approved_timeout_fixture', 'cancel': 'approved_cancel_fixture',
         'hostile': 'approved_hostile_fixture', 'layout': 'approved_layout_fixture',
         'browser': 'approved_browser_fixture'}
FAILURE_CASES = ['timeout', 'cancel']
NATIVE_CASES = ['inspect', 'cpu', 'memory', 'pids', 'network', 'fsize', 'scratch', 'readonly']
CASES.update(dict.fromkeys(NATIVE_CASES, ''))


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def decode_json(data):
    try:
        return json.loads(data)
    except (ValueError, TypeError, UnicodeError) as error:
        raise RuntimeError('Metadata is not valid JSON; the operation stopped.') from error


def identifier(value):
    require(isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value), 'Invalid container or job ID.')
    return value


def checked_record(record):
    require(isinstance(record, dict), 'The active record is not an object.')
    identifier(record['job'])
    require(record['containerName'] == 'texgen-' + record['job'], 'The active container name differs.')
    require(record['image'] == IMAGE and type(record['attempt']) is int
            and 1 <= record['attempt'] <= MAX_ATTEMPTS, 'The active approval or attempt number differs.')
    require(record['case'] in CASES, 'The active fixture is not approved.')
    return record


def owned(data, record, identity):
    checked_record(record)
    identifier(identity)
    require(isinstance(data, dict), 'Container metadata is not an object.')
    require(data['Id'] == identity and data['Image'] == IMAGE, 'The container ID or image differs.')
    require(data['Name'] == '/' + record['containerName'], 'The container name differs.')
    labels = data['Config']['Labels']
    require(isinstance(labels, dict) and labels.get('texgen.application') == 'rust-web'
            and labels.get('texgen.job') == record['job'], 'Container ownership is not confirmed.')


def identities(data):
    return {
        'cacheIds': sorted(item['ID'] for item in data.get('BuildCache') or []),
        'imageIds': sorted(item['Id'] for item in data.get('Images') or []),
        'containerIds': sorted(item['Id'] for item in data.get('Containers') or []),
        'volumeNameHashes': sorted(hashlib.sha256(item['Name'].encode()).hexdigest()
                                   for item in data.get('Volumes') or []),
    }


def preserved(before, after):
    for key in before:
        require(set(before[key]).issubset(after[key]), 'Original Docker identities changed: ' + key)


def docker_environment():
    env = dict(os.environ)
    for name in ['DOCKER_CONTEXT', 'DOCKER_HOST', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'DOCKER_API_VERSION']:
        env.pop(name, None)
    return env


def docker(host, *args):
    env = docker_environment()
    prefix = ['--host', host] if host else ['--context', 'desktop-linux']
    result = subprocess.run([DOCKER, *prefix, *args], capture_output=True, env=env, timeout=15)
    require(len(result.stdout) + len(result.stderr) <= 65536, 'Docker metadata exceeded its limit.')
    if result.returncode:
        raise RuntimeError('Docker metadata or owned cleanup command failed: ' + result.stderr[:1500].decode(errors='replace'))
    return result.stdout


def snapshot(host):
    require(host.startswith('unix://') and host[7:].startswith('/'), 'The Docker endpoint is not local.')
    class Local(http.client.HTTPConnection):
        def connect(self):
            self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            self.sock.settimeout(15)
            self.sock.connect(host[7:])
    connection = Local('localhost', timeout=15)
    try:
        connection.request('GET', '/system/df')
        response = connection.getresponse()
        require(response.status == 200, 'Docker storage metadata is unavailable.')
        body = response.read(4 * 1024 * 1024 + 1)
        require(len(body) <= 4 * 1024 * 1024, 'Docker storage metadata exceeded its limit.')
        return identities(decode_json(body))
    finally:
        connection.close()


def write_new(path, value):
    with path.open('x') as output:
        json.dump(value, output, indent=2)
        output.write('\n')
        output.flush()
        os.fsync(output.fileno())


def cleanup_owned(host):
    active = DATA / 'active.json'
    if not active.exists():
        return
    record = checked_record(decode_json(active.read_text()))
    ids = docker(host, 'container', 'ls', '--all', '--no-trunc', '--filter',
                 'name=^/' + record['containerName'] + '$', '--format', '{{.ID}}').decode().split()
    require(len(ids) <= 1, 'The active name matched multiple containers.')
    if ids:
        identity = identifier(ids[0])
        objects = decode_json(docker(host, 'inspect', '--type=container', identity))
        require(isinstance(objects, list) and len(objects) == 1, 'Container inspection is ambiguous.')
        owned(objects[0], record, identity)
        docker(host, 'rm', '--force', identity)
    require(not docker(host, 'container', 'ls', '--all', '--no-trunc', '--filter',
                       'name=^/' + record['containerName'] + '$', '--format', '{{.ID}}').strip(),
            'The owned container is still present.')
    # Keep the active marker until both cleanup and preservation checks have passed.


def allocation():
    paths = [ROOT, BACKUP / 'approved-npm-cache']
    result = subprocess.run(['du', '-sk', *map(str, paths)], capture_output=True, text=True, check=True)
    return sum(int(line.split('\t', 1)[0]) * 1024 for line in result.stdout.splitlines())


def functional_result(case, diagnostics, state, output_size, scratch):
    require(state['Running'] is False and state.get('Status') == 'exited', 'The probe did not finish execution.')
    code = state['ExitCode']
    values = [int(value, 16) for value in re.findall(r'^[0-9a-f]{16}$', diagnostics, flags=re.MULTILINE)]
    values = [value - 2**64 if value >= 2**63 else value for value in values]
    if case == 'memory':
        require(code == 137 and state.get('OOMKilled') is True, 'The memory cap did not produce the expected OOM kill.')
    elif case == 'fsize':
        require(output_size == MAX_PDF and (code == 153 or (code == 0 and -27 in values)),
                'The output-file limit did not stop growth at 10 MiB.')
    else:
        require(code == 0, 'The probe executable failed.')
        if case == 'readonly':
            pairs = {key: int(value, 16) for key, value in re.findall(r'^([a-z_]+)=([0-9a-f]{16})$', diagnostics, re.MULTILINE)}
            pairs = {key: value - 2**64 if value >= 2**63 else value for key, value in pairs.items()}
            require(pairs.get('root_write') in [-30, -13] and pairs.get('input_write') in [-30, -13],
                    'Root or input-file writes were not denied.')
            require(all(pairs.get(key) == -2 for key in ['project_open', 'home_open', 'docker_socket_open', 'host_socket_open', 'shell_exec']),
                    'A project/home path, Docker socket, or shell was visible in the container.')
        elif case == 'pids':
            require(values == [31, -11], 'The PID cap did not reject the 32nd child process.')
        elif case == 'network':
            require((len(values) == 2 and values[0] >= 0 and values[1] == -101)
                    or (values and values[0] in [-1, -13]), 'The isolated network did not reject the connection.')
        elif case == 'scratch':
            require(len(values) == 2 and values[1] == -28 and 0 < values[0] <= scratch,
                    'Scratch storage did not stop writes with ENOSPC.')
        elif case == 'cpu':
            before, separator, after = diagnostics.partition('cpu.after=\n')
            require(bool(separator), 'The CPU probe did not record both observations.')
            first = re.search(r'^nr_throttled (\d+)$', before, re.MULTILINE)
            last = re.search(r'^nr_throttled (\d+)$', after, re.MULTILINE)
            require(first is not None and last is not None and int(last[1]) > int(first[1]),
                    'The CPU quota did not report active throttling.')


def native_inspection(host, number, case):
    probe = DATA / 'inspect-be4dced0770b2ee9.elf'
    content = probe.read_bytes()
    require(len(content) <= 4096 and hashlib.sha256(content).hexdigest()
            == 'be4dced0770b2ee91cfae7cdfb490715c77fdf628c923763fa29af4b2d5e222a',
            'The approved local probe differs from its verified executable.')
    job = secrets.token_hex(32)
    record = {'attempt': number, 'case': case, 'job': job,
              'containerName': 'texgen-' + job, 'image': IMAGE}
    write_new(DATA / 'active.json', record)
    with (DATA / 'attempts.jsonl').open('a') as journal:
        journal.write(json.dumps(record) + '\n')
        journal.flush()
        os.fsync(journal.fileno())
    directory = DATA / f'attempt-{number:02}'
    directory.mkdir(mode=0o700)
    source = directory / 'input.tex'
    output = directory / 'output.pdf'
    source.write_bytes(b'probe')
    source.chmod(0o444)
    output.write_bytes(b'')
    output.chmod(0o666)
    for path in [source, output, probe]:
        require(not any(char in str(path) for char in [',', '"', '\n', '\r']), 'The probe mount path is ambiguous.')
    scratch = ((64 * 1024 * 1024 - source.stat().st_size - len(content) - MAX_PDF - 65536)
               // (1024 * 1024) * (1024 * 1024))
    identity = identifier(docker(host, 'create', '--name', record['containerName'], '--pull=never',
        '--label=texgen.application=rust-web', '--label=texgen.job=' + job,
        '--network=none', '--read-only', '--user=10001:10001', '--cpus=1', '--memory=512m',
        '--memory-swap=512m', '--pids-limit=32', '--cap-drop=ALL', '--security-opt=no-new-privileges',
        '--log-driver=none', '--ipc=none', '--ulimit=fsize=10485760:10485760',
        f'--tmpfs=/scratch:rw,noexec,nosuid,nodev,size={scratch},uid=10001,gid=10001,mode=0700',
        '--mount', f'type=bind,src={source},dst=/scratch/input.tex,readonly',
        '--mount', f'type=bind,src={output},dst=/scratch/input.pdf',
        '--mount', f'type=bind,src={probe},dst=/probe,readonly', '--entrypoint=/probe', IMAGE, case).decode().strip())
    objects = decode_json(docker(host, 'inspect', '--type=container', identity))
    require(len(objects) == 1, 'The probe container inspection is ambiguous.')
    owned(objects[0], record, identity)
    config = objects[0]['HostConfig']
    require(config['ReadonlyRootfs'] and config['NetworkMode'] == 'none'
            and config['Memory'] == config['MemorySwap'] == 536870912
            and config['NanoCpus'] == 1000000000 and config['PidsLimit'] == 32
            and config['CapDrop'] == ['ALL'] and not config['Privileged']
            and config['LogConfig']['Type'] == 'none' and config['IpcMode'] == 'none',
            'The probe container did not request the approved controls.')
    result = subprocess.run([sys.executable, str(MONITOR), DOCKER, '--host', host, 'start', '--attach', identity],
                            cwd=ROOT, env=docker_environment(), capture_output=True, text=True, timeout=55)
    print(result.stdout[-8000:], end='')
    log_lines = [line[5:] for line in result.stdout.splitlines() if line.startswith('Log: ')]
    require(len(log_lines) == 1, 'The probe monitor log is ambiguous.')
    log = Path(log_lines[0])
    require(log.parent == BACKUP and log.name.startswith('approved-command-') and log.suffix == '.log',
            'The probe monitor log is outside its approved directory.')
    audit = decode_json(log.with_suffix('.json').read_text())
    require(audit['stopped'] is False and audit['monitor_error'] is None, 'The output monitor stopped or could not measure the probe.')
    with log.open('rb') as stream:
        diagnostics = stream.read(65537)
    require(len(diagnostics) <= 65536, 'The probe diagnostics exceeded their limit.')
    state = decode_json(docker(host, 'inspect', '--type=container', identity))[0]
    owned(state, record, identity)
    with (directory / 'inspect.txt').open('xb') as report:
        report.write(diagnostics)
    write_new(directory / 'observed-state.json', state['State'])
    functional_result(case, diagnostics.decode(errors='replace'), state['State'], output.stat().st_size, scratch)
    status = 'inspection' if case == 'inspect' else 'resource-probe'
    write_new(directory / 'result.json', {'status': status, 'attempt': number,
              'case': case, 'bytes': len(diagnostics), 'probeBytes': len(content),
              'resourceEnforced': None if case == 'inspect' else case})
    return 0


def approved_case(case):
    os.umask(0o077)
    require(allocation() < 480 * 1024 * 1024, 'The unchanged output allowance needs review.')
    require(not DATA.is_symlink(), 'The probe directory must not be a symlink.')
    DATA.mkdir(mode=0o700, parents=True, exist_ok=True)
    require(DATA.resolve().is_relative_to(ROOT), 'The probe directory is outside the rewrite.')
    for name in ['approval.json', 'attempts.jsonl', 'active.json']:
        require(not (DATA / name).is_symlink(), 'A probe marker must not be a symlink.')
    context = decode_json(docker(None, 'context', 'inspect', 'desktop-linux'))
    host = context[0]['Endpoints']['docker']['Host']
    require(host.startswith('unix://') and host[7:].startswith('/'), 'The Docker endpoint is not local.')
    before = snapshot(host)
    original = decode_json((ROOT / 'target/stage6-assets/local-build-audit-20261019T033653537756Z.json').read_text())['baseline']
    preserved(original, before)
    require(IMAGE in before['imageIds'], 'The approved retained image is absent.')
    image = decode_json(docker(host, 'image', 'inspect', IMAGE))[0]
    require(image['Id'] == IMAGE and image['Os'] == 'linux' and image['Architecture'] == 'arm64',
            'The retained image identity or platform differs.')
    require(image['Config']['User'] == '10001:10001' and image['Config']['Entrypoint'] == ['/compiler/tectonic'],
            'The retained image user or entrypoint differs.')
    require(not image['Config'].get('Volumes'), 'The retained image declares unexpected volumes.')
    approval = {'approved': True, 'maxAttempts': MAX_ATTEMPTS, 'image': IMAGE,
                'controllerRequired': True, 'socket': host[7:]}
    path = DATA / 'approval.json'
    if path.exists():
        require(decode_json(path.read_text()) == approval, 'The original approval marker differs; do not reset it.')
    else:
        write_new(path, approval)
    if (DATA / 'active.json').exists():
        raise RuntimeError('A prior active attempt needs separate recovery; no new attempt was started.')
    ledger = DATA / 'attempts.jsonl'
    records = [checked_record(decode_json(line)) for line in ledger.read_text().splitlines()] if ledger.exists() else []
    require(len(records) < MAX_ATTEMPTS, 'The approved attempt count is exhausted.')
    require([item['attempt'] for item in records] == list(range(1, len(records) + 1)), 'The attempt ledger is not sequential.')
    number = len(records) + 1
    write_new(DATA / f'preflight-{number:02}.json', before)
    code = 1
    try:
        if case in NATIVE_CASES:
            code = native_inspection(host, number, case)
        else:
            result = subprocess.run([sys.executable, str(MONITOR), 'cargo', 'test', '--offline', '--locked',
                '--release', '--test', 'compiler_docker', CASES[case], '--', '--ignored', '--exact', '--test-threads=1'],
                cwd=ROOT, capture_output=True, text=True, timeout=120)
            code = result.returncode
            print(result.stdout[-8000:], end='')
            if result.stderr:
                print(result.stderr[-2000:], file=sys.stderr, end='')
    finally:
        cleanup_owned(host)
        after = snapshot(host)
        preserved(before, after)
        preserved(original, after)
        write_new(DATA / f'after-{number:02}.json', after)
        active = DATA / 'active.json'
        if active.exists():
            record = checked_record(decode_json(active.read_text()))
            require(record['attempt'] == number, 'The active attempt changed.')
            completed = DATA / f'completed-{number:02}.json'
            require(not completed.exists(), 'The completed attempt marker already exists.')
            active.rename(completed)
    output = DATA / f'attempt-{number:02}/candidate.pdf'
    if code == 0:
        if case in NATIVE_CASES:
            expected_output = output.parent / 'inspect.txt'
        elif case in FAILURE_CASES:
            expected_output = output.parent / 'result.json'
        else:
            expected_output = output
        require((DATA / f'completed-{number:02}.json').is_file() and expected_output.is_file(),
                'The command reported success without a completed live attempt and output file.')
        result = decode_json((output.parent / 'result.json').read_text())
        if case in NATIVE_CASES:
            expected_status = 'inspection' if case == 'inspect' else 'resource-probe'
        else:
            expected_status = 'expected-failure' if case in FAILURE_CASES else 'candidate'
        require(result['status'] == expected_status and result['attempt'] == number
                and result['case'] == case, 'The live fixture result does not match this attempt.')
    if output.exists():
        with output.open('rb') as source:
            data = source.read(MAX_PDF + 1)
        require(len(data) <= MAX_PDF, 'The candidate PDF exceeded its limit.')
        write_new(DATA / f'candidate-{number:02}.json', {
            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
            'pdfMetadataVerified': False, 'originalDockerIdentitiesPreserved': True,
        })
    print(f'Attempt {number}/{MAX_ATTEMPTS}: exit={code}; original Docker identities preserved; no pull or build.')
    return code


def self_check():
    record = {'job': 'a' * 64, 'containerName': 'texgen-' + 'a' * 64,
              'image': IMAGE, 'attempt': 1, 'case': 'canonical'}
    data = {'Id': 'b' * 64, 'Image': IMAGE, 'Name': '/' + record['containerName'],
            'Config': {'Labels': {'texgen.application': 'rust-web', 'texgen.job': record['job']}}}
    owned(data, record, 'b' * 64)
    changed = decode_json(json.dumps(data))
    changed['Config']['Labels']['texgen.job'] = 'foreign'
    try:
        owned(changed, record, 'b' * 64)
    except RuntimeError:
        pass
    else:
        raise AssertionError('Foreign ownership passed the self-check.')
    preserved({'ids': ['original']}, {'ids': ['original', 'new']})
    try:
        preserved({'ids': ['original']}, {'ids': []})
    except RuntimeError:
        pass
    else:
        raise AssertionError('Missing original identity passed the self-check.')
    try:
        decode_json('{invalid')
    except RuntimeError:
        pass
    else:
        raise AssertionError('Invalid metadata passed the self-check.')
    exited = {'Running': False, 'Status': 'exited', 'ExitCode': 0, 'OOMKilled': False}
    readonly = 'root_write=ffffffffffffffe2\ninput_write=ffffffffffffffe2\n' + ''.join(
        key + '=fffffffffffffffe\n' for key in ['project_open', 'home_open', 'docker_socket_open', 'host_socket_open', 'shell_exec'])
    functional_result('readonly', readonly, exited, 0, 0)
    functional_result('pids', '000000000000001f\nfffffffffffffff5\n', exited, 0, 53 * 1024 * 1024)
    functional_result('network', '0000000000000003\nffffffffffffff9b\n', exited, 0, 0)
    functional_result('scratch', '0000000003500000\nffffffffffffffe4\n', exited, 0, 53 * 1024 * 1024)
    functional_result('cpu', 'cpu.before=\nnr_throttled 0\ncpu.after=\nnr_throttled 3\n', exited, 0, 0)
    functional_result('memory', '', {**exited, 'ExitCode': 137, 'OOMKilled': True}, 0, 0)
    functional_result('fsize', '', {**exited, 'ExitCode': 153}, MAX_PDF, 0)
    for case in ['readonly', 'pids', 'network', 'scratch', 'cpu', 'memory', 'fsize']:
        try:
            functional_result(case, '', exited, 0, 0)
        except RuntimeError:
            pass
        else:
            raise AssertionError('An invalid resource result passed: ' + case)
    print('Ownership, JSON, preservation, and resource-result self-checks passed. No Docker command ran.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--self-check', action='store_true')
    action.add_argument('--approved-case', choices=CASES)
    args = parser.parse_args()
    try:
        if args.self_check:
            self_check()
        else:
            raise SystemExit(approved_case(args.approved_case))
    except (OSError, ValueError, TypeError, KeyError, RuntimeError, subprocess.SubprocessError) as error:
        print('The probe controller stopped: ' + str(error)[:2000], file=sys.stderr)
        raise SystemExit(1) from error
