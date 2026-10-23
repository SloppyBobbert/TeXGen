#!/usr/bin/env python3
"""Review the live UI in owned Chrome, with browser-only API/PDF fixtures.

Run through the approved output monitor. No listener, compiler, container,
downloaded package, or original browser profile is used. Existing PDF bytes
are replayed in the browser; this does not verify authenticated API behavior.
"""
import argparse
import base64
from contextlib import suppress
import hashlib
import http.client
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CHROME = Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
ORIGIN = 'http://127.0.0.1:3737'
LEDGER = ROOT / 'target/stage6-probes/attempts.jsonl'
PDF = ROOT / 'target/stage6-probes/attempt-16/candidate.pdf'
MAX_PROFILE_BYTES = 16 * 1024 * 1024
# A closed proxy blocks background transfers without disabling Chrome's own sandbox.
NETWORK_ARGS = [
    '--proxy-server=http://127.0.0.1:9',
    '--proxy-bypass-list=127.0.0.1;localhost',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost',
    '--disable-quic',
]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def downloads_metadata() -> str:
    directory = Path.home() / 'Downloads'
    rows = []
    if directory.exists():
        for path in directory.iterdir():
            value = path.lstat()
            rows.append((path.name, value.st_ino, value.st_size, value.st_mtime_ns))
    return hashlib.sha256(json.dumps(sorted(rows)).encode()).hexdigest()


def prepare_profile(private: Path) -> Path:
    downloads = private / 'downloads'
    downloads.mkdir()
    profile = private / 'profile'
    default = profile / 'Default'
    default.mkdir(parents=True)
    (default / 'Preferences').write_text(json.dumps({'download': {
        'default_directory': str(downloads), 'prompt_for_download': False,
    }}))
    return profile


def profile_bytes(private: Path) -> int:
    total = 0
    for path in private.rglob('*'):
        with suppress(FileNotFoundError):
            total += path.lstat().st_blocks * 512
    return total


def watch_profile(chrome: subprocess.Popen, private: Path, stop: threading.Event, failures: list[str]) -> None:
    while not stop.wait(0.1):
        if chrome.poll() is not None:
            return
        try:
            if profile_bytes(private) <= MAX_PROFILE_BYTES:
                continue
            failures.append('The owned browser profile exceeded 16 MiB.')
        except OSError as error:
            failures.append('Browser profile measurement failed: ' + str(error))
        with suppress(ProcessLookupError):
            chrome.terminate()
        return


def main(expected_pid: int) -> None:
    os.umask(0o077)
    require(CHROME.is_file() and PDF.is_file(), 'Installed Chrome and the retained replay PDF are required.')
    require(not (LEDGER.parent / 'active.json').exists(), 'An image attempt is active.')
    ledger_before = digest(LEDGER)
    downloads_before = downloads_metadata()
    listener = subprocess.check_output(['lsof', '-nP', '-iTCP:3737', '-sTCP:LISTEN', '-t'], text=True).strip()
    require(listener == str(expected_pid), 'The known live listener differs; do not start or stop a server.')
    connection = http.client.HTTPConnection('127.0.0.1', 3737, timeout=5)
    try:
        connection.request('GET', '/')
        response = connection.getresponse()
        require(response.status == 200, 'The live static UI is unavailable.')
        response.read(65536)
    finally:
        connection.close()
    proxy = subprocess.run(['lsof', '-nP', '-iTCP:9', '-sTCP:LISTEN', '-t'], capture_output=True, text=True)
    require(proxy.returncode == 1 and not proxy.stdout and not proxy.stderr, 'The deny-proxy port is not closed.')
    output = ROOT / 'target' / ('current-layout-' + str(time.time_ns()))
    output.mkdir(mode=0o700)
    report: dict[str, Any] = {'passed': False, 'apiMode': 'browser-only fixtures; live server serves static assets only',
              'nativeCompilation': False, 'authenticatedApiVerified': False,
              'serverPid': int(listener), 'screenshots': [], 'networkRestriction': 'closed proxy plus DNS block',
              'chromiumSandboxDisabled': False,
              'profileStopThresholdBytes': MAX_PROFILE_BYTES, 'profileGuardPollingMs': 100,
              'strictFilesystemQuota': False, 'imageLedgerBeforeSha256': ledger_before,
              'defaultDownloadsBeforeSha256': downloads_before}
    with tempfile.TemporaryDirectory(prefix='layout-browser-', dir=ROOT / 'target') as temporary:
        private = Path(temporary)
        profile = prepare_profile(private)
        report['privateDirectory'] = str(private)
        (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
        with (private / 'chrome.log').open('wb') as chrome_log:
            chrome = subprocess.Popen([
                str(CHROME), *NETWORK_ARGS, '--headless=new', '--remote-debugging-address=127.0.0.1',
                '--remote-debugging-port=0', '--user-data-dir=' + str(profile),
                '--disable-background-networking', '--disable-component-update', '--disable-sync',
                '--disable-default-apps', '--disable-extensions', '--disable-breakpad',
                '--disable-features=OptimizationHints,OptimizationGuideModelDownloading,OptimizationGuideOnDeviceModel',
                '--disable-gpu-shader-disk-cache', '--disk-cache-size=1048576',
                '--media-cache-size=1048576', '--no-first-run', '--no-default-browser-check', 'about:blank',
            ], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=chrome_log)
        report['ownedChromePid'] = chrome.pid
        (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
        profile_failures: list[str] = []
        stop = threading.Event()
        watcher = threading.Thread(target=watch_profile, args=(chrome, private, stop, profile_failures), daemon=True)
        cli = ['agent-browser', '--session', 'texgen-layout-' + str(os.getpid())]
        attached = False

        def browser(*args: str, code: str | None = None, structured: bool = False) -> Any:
            require('--cdp' in cli, 'No owned CDP connection exists. Do not start another browser.')
            result = subprocess.run([*cli, *(['--json'] if structured else []), *args],
                                    input=code, capture_output=True, text=True, timeout=40)
            require(result.returncode == 0, 'Browser command failed: ' + (result.stderr + result.stdout)[-1800:])
            if structured:
                try:
                    value = json.loads(result.stdout)
                except ValueError as error:
                    raise RuntimeError('The browser returned invalid JSON.') from error
                require(value.get('success'), 'Browser evaluation failed: ' + str(value)[:1000])
                return value['data'].get('result', value['data'])

        def evaluate(code: str) -> Any:
            return browser('eval', '--stdin', code=code, structured=True)

        def click(name: str) -> None:
            # Focus and Enter avoid stale pointer coordinates after sticky-pane scrolling.
            focused = evaluate('''(() => { const button = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === ''' + json.dumps(name) + ''');
              if (!button || button.matches(':disabled')) return false;
              button.scrollIntoView({block:'center'}); button.focus();
              return document.activeElement === button; })()''')
            require(focused, 'The requested button cannot receive focus: ' + name)
            browser('press', 'Enter')

        def screenshot(name: str) -> None:
            path = output / name
            browser('screenshot', str(path), '--full')
            require(path.is_file(), 'A screenshot is missing.')
            report['screenshots'].append(str(path.relative_to(ROOT)))

        def downloaded(name: str) -> Path:
            path = private / 'downloads' / name
            deadline = time.monotonic() + 10
            while not path.is_file():
                require(time.monotonic() < deadline, 'A download did not reach the private directory: ' + name)
                time.sleep(0.05)
            return path

        try:
            watcher.start()
            require(os.getpgid(chrome.pid) == os.getpgrp(), 'Chrome escaped the monitored command group.')
            port_file = profile / 'DevToolsActivePort'
            deadline = time.monotonic() + 20
            while not port_file.exists():
                require(chrome.poll() is None and time.monotonic() < deadline, 'Owned Chrome did not start.')
                time.sleep(0.05)
            port = int(port_file.read_text().splitlines()[0])
            require(0 < port < 65536, 'The owned CDP port is invalid.')
            cli.extend(['--cdp', str(port), '--download-path', str(private / 'downloads')])
            attached = True
            blocked = subprocess.run([*cli, 'open', 'http://192.0.2.1:8080'], capture_output=True, text=True, timeout=20)
            require(blocked.returncode != 0 and 'ERR_PROXY_CONNECTION_FAILED' in blocked.stderr + blocked.stdout,
                    'External navigation did not fail at the closed proxy.')
            report['externalNavigationBlocked'] = True
            browser('set', 'viewport', '1440', '1000')
            browser('open', ORIGIN)
            browser('wait', '--text', 'This tab owns the editable draft.')
            # Install guards on the final page, not the initial about:blank target.
            browser('network', 'route', '**/api/compile', '--abort')
            browser('network', 'route', '**/api/compile/cancel', '--abort')
            browser('network', 'route', '**/api/render', '--abort')
            catalog = (ROOT / 'data/catalog.json').read_text()
            evaluate('''(() => { const original = window.fetch;
              const catalog = ''' + catalog + ''';
              window.__fixturePdfEnabled = false; window.__fixtureRequests = [];
              window.fetch = async (url, options) => {
                const path = new URL(typeof url === 'string' ? url : url.url, location.href).pathname;
                window.__fixtureRequests.push(path);
                if (path === '/api/health') return new Response(JSON.stringify({status: 'ready', version: 'layout-fixture', pdfCompilation: window.__fixturePdfEnabled ? 'enabled' : 'disabled', compilerReason: 'Browser fixture only'}));
                if (path === '/api/catalog') return new Response(JSON.stringify(catalog));
                if (path.startsWith('/api/')) throw new Error('Unstubbed API request blocked by layout fixture');
                return original(url, options);
              }; return true; })()''')
            click('Check connection')
            browser('wait', '--text', 'The protected server is ready.')
            screenshot('desktop-empty.png')
            evaluate('''(() => { const original = Storage.prototype.setItem;
              window.__failDraft = true;
              Storage.prototype.setItem = function(key, value) {
                if (key === 'texgen.draft.v1' && window.__failDraft) throw new Error('Synthetic quota failure');
                return original.call(this, key, value);
              }; return true; })()''')
            browser('fill', 'input[name=newAllowance]', '1')
            click('Create document')
            browser('wait', '--text', 'Replacement stopped')
            require(evaluate('document.querySelector("input[name=newAllowance]").value === "1" && localStorage.getItem("texgen.draft.v1") === null'), 'Failed creation lost the allowance or changed the draft.')
            evaluate('window.__failDraft = false; true')
            click('Create document')
            browser('find', 'label', 'Document title', 'fill', 'Layout review - synthetic document')
            evaluate('''(() => { const inputs = [...document.querySelectorAll('.formula-choice input')].slice(0, 2);
              inputs.forEach((input, index) => { input.dataset.layoutFormula = String(index);
                for (const detail of document.querySelectorAll('details')) if (detail.contains(input)) detail.open = true;
              }); return true; })()''')
            browser('check', 'input[data-layout-formula="0"]')
            browser('check', 'input[data-layout-formula="1"]')
            click('Add text block')
            browser('find', 'label', 'Block 3 text', 'fill', 'Synthetic notes for desktop and mobile layout review.')
            pdf_data = base64.b64encode(PDF.read_bytes()).decode()
            evaluate('''(() => { const original = window.fetch; window.__fixtureCompiles = 0; window.__fixturePdfEnabled = true;
              window.fetch = async (url, options) => {
                const path = new URL(typeof url === 'string' ? url : url.url, location.href).pathname;
                if (path === '/api/compile') {
                  const request = JSON.parse(options.body); window.__fixtureCompiles++;
                  const bytes = Uint8Array.from(atob(''' + json.dumps(pdf_data) + '''), ch => ch.charCodeAt(0));
                  return new Response(bytes, {headers: {'Content-Type': 'application/pdf',
                    'X-TeXGen-Document-Id': request.document.id, 'X-TeXGen-Revision': String(request.revision),
                    'X-TeXGen-Request-Id': request.requestId}});
                }
                return original(url, options);
              }; return true; })()''')
            click('Check connection')
            browser('wait', '--fn', '[...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Compile PDF" && !b.disabled)')
            click('Compile PDF')
            browser('wait', '--fn', 'document.querySelector("canvas")?.dataset.renderedPage === "1"')
            require(evaluate('document.body.textContent.includes("All 2 pages are retained")'), 'The replay page allowance warning is missing.')
            geometry = evaluate('''(() => { const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width}; };
              return {library:box('.library-column'),preview:box('.preview-panel'),tools:box('.document-toolbar'),overflow:document.documentElement.scrollWidth > innerWidth}; })()''')
            require(not geometry['overflow'] and geometry['library']['x'] < geometry['preview']['x'] < geometry['tools']['x'], 'Desktop columns overlap or appear in the wrong order.')
            require(geometry['preview']['width'] > geometry['tools']['width'], 'The central preview is not the largest column.')
            report['desktopGeometry'] = geometry
            screenshot('desktop-pdf.png')
            click('Next page')
            browser('wait', '--fn', 'document.querySelector("canvas")?.dataset.renderedPage === "2"')
            require(evaluate('''(() => { const c = document.querySelector('canvas'); const data = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
              for (let i=0;i<data.length;i+=4) if (data[i]<230 && data[i+1]<230 && data[i+2]<230) return true; return false; })()'''), 'The second PDF page has no painted content.')
            evaluate('window.__originalObjectURL = URL.createObjectURL; URL.createObjectURL = () => { throw new Error("Synthetic export failure"); }; true')
            click('Export PDF')
            browser('wait', '--text', 'PDF export failed.')
            require(evaluate('document.querySelector("canvas").dataset.renderedPage === "2"'), 'An export failure discarded the selected PDF page.')
            evaluate('URL.createObjectURL = window.__originalObjectURL; true')
            click('Export PDF')
            require(digest(downloaded('texgen-document.pdf')) == digest(PDF), 'Exported PDF bytes differ from the retained replay PDF.')
            click('Export document JSON')
            exported = json.loads(downloaded('texgen-document.json').read_text())
            require(exported == evaluate('JSON.parse(localStorage.getItem("texgen.draft.v1")).active'), 'JSON export differs from the saved synthetic draft.')
            browser('find', 'label', 'Document title', 'fill', 'Edited synthetic document')
            browser('wait', '--text', 'This PDF is outdated.')
            browser('set', 'viewport', '320', '900')
            evaluate('window.scrollTo(0, 0); true')
            mobile = evaluate('''(() => { const top = selector => document.querySelector(selector).getBoundingClientRect().top + scrollY;
              return {overflow:document.documentElement.scrollWidth > innerWidth,library:top('.library-column'),tools:top('.document-toolbar'),editor:top('.document-pane'),preview:top('.preview-panel'),creationInSidebar:!!document.querySelector('.creation-form').closest('.library-column')}; })()''')
            require(not mobile['overflow'] and mobile['creationInSidebar'], 'The 320px layout overflows or moves creation out of the sidebar.')
            require(mobile['library'] < mobile['tools'] < mobile['editor'] < mobile['preview'], 'Mobile workspace order is incorrect.')
            report['mobileGeometry'] = mobile
            screenshot('mobile-full.png')
            report['fixtureCompiles'] = evaluate('window.__fixtureCompiles')
            require(report['fixtureCompiles'] == 1, 'Unexpected replay compilation count.')
            report.update(passed=True, creationFailureRetry=True, twoPaintedPages=True,
                          exportFailureRetry=True, exactPdfAndJsonDownloads=True, stalePdfWarning=True)
        except Exception as error:
            report['failure'] = str(error)[:1800]
            try:
                report['failurePage'] = evaluate('document.body.innerText.slice(0, 8000)')
                report['fixtureState'] = evaluate('({enabled:window.__fixturePdfEnabled, requests:window.__fixtureRequests, compiles:window.__fixtureCompiles})')
                screenshot('failure.png')
            except Exception as diagnostic_error:
                report['diagnosticError'] = str(diagnostic_error)[:500]
            raise
        finally:
            if attached:
                try:
                    browser('close')
                except Exception as error:
                    report['browserCloseError'] = str(error)[:500]
            if chrome.poll() is None:
                chrome.terminate()
                try:
                    chrome.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    chrome.kill()
                    chrome.wait()
            stop.set()
            if watcher.ident is not None:
                watcher.join(timeout=2)
            with (private / 'chrome.log').open('rb') as chrome_log:
                chrome_log.seek(0, os.SEEK_END)
                chrome_log.seek(max(0, chrome_log.tell() - 65536))
                (output / 'chrome-stderr-tail.log').write_bytes(chrome_log.read(65536))
            require(digest(LEDGER) == ledger_before, 'The image ledger changed.')
            require(downloads_metadata() == downloads_before, 'Default Downloads metadata changed.')
            require(subprocess.check_output(['lsof', '-nP', '-iTCP:3737', '-sTCP:LISTEN', '-t'], text=True).strip() == listener, 'The live listener changed.')
            report.update(imageLedgerUnchanged=True, defaultDownloadsUnchanged=True, listenerUnchanged=True,
                          browserProfileBytes=profile_bytes(private), profileFailures=profile_failures)
            if profile_failures:
                report['passed'] = False
            (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
            require(not profile_failures and not watcher.is_alive(), 'The browser profile guard failed: ' + str(profile_failures))
    print('PASS: current desktop/mobile layout, creation retry, two-page replay preview, PDF/JSON exports, and stale-PDF warning.')
    print('Report:', output / 'report.json')
    print('No original browser profile, authenticated API session, or compiler/container job was used.')


def self_check() -> None:
    import ast
    tree = ast.parse(Path(__file__).read_text())
    launches = [node for node in ast.walk(tree) if isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute) and node.func.attr == 'Popen']
    require(len(launches) == 1 and not any(keyword.arg in {'start_new_session', 'process_group', 'preexec_fn'}
            for keyword in launches[0].keywords), 'Chrome must stay in the monitored command group.')
    require(isinstance(launches[0].args[0], ast.List)
            and ast.unparse(launches[0].args[0].elts[0]) == 'str(CHROME)', 'The installed Chrome must be used.')
    require(NETWORK_ARGS == ['--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=127.0.0.1;localhost',
                            '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost',
                            '--disable-quic'], 'External browser traffic must remain blocked.')
    require(not any(isinstance(node, ast.Constant) and isinstance(node.value, str)
                    and node.value in {'--no-sandbox', '--disable-gpu-sandbox', '--disable-setuid-sandbox'}
                    for node in ast.walk(launches[0])), 'Do not disable Chrome sandbox protection.')
    for path in ['**/api/compile', '**/api/compile/cancel', '**/api/render']:
        require(any(isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                    and node.func.id == 'browser' and len(node.args) == 4
                    and all(isinstance(arg, ast.Constant) for arg in node.args)
                    and [arg.value for arg in node.args if isinstance(arg, ast.Constant)] == ['network', 'route', path, '--abort']
                    for node in ast.walk(tree)), 'A real compiler/render route is not blocked.')
    with tempfile.TemporaryDirectory(prefix='layout-profile-selfcheck-', dir=ROOT / 'target') as temporary:
        private = Path(temporary)
        profile = prepare_profile(private)
        try:
            prefs = json.loads((profile / 'Default/Preferences').read_text())
        except (OSError, ValueError) as error:
            raise RuntimeError('Profile self-check failed to read preferences.') from error
        require(prefs['download']['default_directory'] == str(private / 'downloads')
                and not prefs['download']['prompt_for_download'], 'The download directory is not private.')
    from unittest.mock import Mock, patch
    for size in [MAX_PROFILE_BYTES + 1, OSError('synthetic measurement failure')]:
        stopped = threading.Event()
        fake = Mock(spec=subprocess.Popen)
        fake.poll.return_value = None
        failures: list[str] = []
        with patch(__name__ + '.profile_bytes', side_effect=size if isinstance(size, OSError) else None,
                   return_value=size):
            watch_profile(fake, ROOT / 'target', stopped, failures)
        require(len(failures) == 1, 'The profile guard did not fail closed.')
        fake.terminate.assert_called_once()
    stopped = threading.Event()
    fake = Mock(spec=subprocess.Popen)
    fake.poll.return_value = None
    def at_limit(*_):
        stopped.set()
        return MAX_PROFILE_BYTES
    with patch(__name__ + '.profile_bytes', side_effect=at_limit):
        watch_profile(fake, ROOT / 'target', stopped, [])
    fake.terminate.assert_not_called()
    print('PASS: closed-proxy configuration, Chrome sandbox protection, monitored ownership, blocked compiler routes, private downloads, and fail-closed profile guard. No browser started.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--self-check', action='store_true')
    action.add_argument('--server-pid', type=int)
    args = parser.parse_args()
    if args.self_check:
        self_check()
    else:
        require(args.server_pid > 0, 'The expected server PID must be positive.')
        main(args.server_pid)
