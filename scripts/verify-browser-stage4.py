#!/usr/bin/env python3
"""Exercise Stages 4 and 5 with installed Chrome and the real Rust router.

Run through the approved output monitor. This script installs nothing.
Only target/ receives test documents, reports, and the temporary browser profile.
"""

import http.client
import json
import os
import re
import signal
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CHROME = Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
KEY = 'texgen.draft.v1'
ORIGIN = 'http://127.0.0.1:3737'
assert CHROME.is_file(), 'An installed Chrome binary is required. No download is permitted.'
os.umask(0o077)


def load_json(source):
    try:
        return json.loads(source)
    except (ValueError, TypeError) as error:
        raise RuntimeError('The verification input did not contain valid JSON.') from error


def prepare_profile(private):
    profile = private / 'profile'
    default = profile / 'Default'
    default.mkdir(parents=True)
    # CDP attachment does not apply the CLI's browser-launch download setting.
    (default / 'Preferences').write_text(json.dumps({'download': {
        'default_directory': str(private / 'downloads'), 'prompt_for_download': False,
    }}))
    return profile


def main():
    with tempfile.TemporaryDirectory(prefix='stage4-browser-', dir=ROOT / 'target') as temporary:
        private = Path(temporary)
        launch = private / 'launch.txt'
        env = dict(os.environ, TEXGEN_TEST_LAUNCH_FILE=str(launch), CARGO_NET_OFFLINE='true')
        build = subprocess.run(['cargo', 'test', '--offline', '--locked', '--release', '--test', 'browser_fixture', '--no-run', '--message-format=json'], cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)
        assert build.returncode == 0, build.stderr[-1500:]
        artifacts = [load_json(line) for line in build.stdout.splitlines() if line.startswith('{')]
        executable = next(item['executable'] for item in artifacts if item.get('reason') == 'compiler-artifact' and item.get('target', {}).get('name') == 'browser_fixture' and item.get('executable'))
        (private / 'downloads').mkdir()
        cli = ['agent-browser', '--session', 'texgen-stage4-' + str(os.getpid()), '--download-path', str(private / 'downloads')]
        chrome = None
        fixture_log = (ROOT / 'target/stage4-browser-fixture.log').open('wb')
        fixture = subprocess.Popen([executable, '--ignored', '--nocapture'], cwd=ROOT, env=env, stdout=fixture_log, stderr=subprocess.STDOUT)

        def browser(*args, code=None, structured=False):
            result = subprocess.run([*cli, *(['--json'] if structured else []), *args], input=code, capture_output=True, text=True, timeout=45)
            if result.returncode:
                raise RuntimeError(re.sub(r'launch=[a-f0-9]+', 'launch=<redacted>', (result.stderr + result.stdout)[-1500:]))
            if structured:
                value = load_json(result.stdout)
                assert value.get('success'), str(value)[:400]
                return value['data'].get('result', value['data'])

        def evaluate(code) -> Any:
            return browser('eval', '--stdin', code=code, structured=True)

        def focus_button(name):
            assert evaluate('''(() => {
              for (const button of document.querySelectorAll('[data-stage4-button]')) button.removeAttribute('data-stage4-button');
              const button = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === ''' + json.dumps(name) + ''');
              if (!button || button.matches(':disabled')) return false;
              button.setAttribute('data-stage4-button', 'true');
              button.scrollIntoView({block: 'center'}); button.focus();
              return document.activeElement === button; })()'''), 'The requested button is not available: ' + name

        def click(name):
            focus_button(name)
            browser('press', 'Enter')

        def fill(label, value):
            # Keep textarea contents out of the control selector.
            evaluate('''(() => { for (const control of document.querySelectorAll('[data-stage4-field]')) control.removeAttribute('data-stage4-field');
              const label = [...document.querySelectorAll('label')].find(element => [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim() === ''' + json.dumps(label) + ''');
              if (!label) throw new Error('The requested control label is missing.');
              label.querySelector('input,textarea').setAttribute('data-stage4-field', 'true'); return true; })()''')
            browser('fill', '[data-stage4-field]', value)

        def active():
            return evaluate('JSON.parse(localStorage.getItem(' + json.dumps(KEY) + ')).active')

        def wait(text):
            browser('wait', '--text', text)

        def downloaded(name):
            path = private / 'downloads' / name
            deadline = time.monotonic() + 10
            while not path.is_file():
                if time.monotonic() >= deadline:
                    raise RuntimeError('The download did not reach the private directory: ' + name + '. Files: ' + str([item.name for item in path.parent.iterdir()]))
                time.sleep(0.05)
            return path

        def capture_exports():
            evaluate('''window.__exports = []; window.__confirms = [];
              window.confirm = text => { window.__confirms.push(text); return true; };
              window.__objectURL = URL.createObjectURL;
              window.__anchorClick = HTMLAnchorElement.prototype.click;
              URL.createObjectURL = blob => {
                const item = {type: blob.type, source: null}; window.__exports.push(item);
                blob.text().then(source => item.source = source); return window.__objectURL(blob);
              };
              HTMLAnchorElement.prototype.click = function() { window.__exports.at(-1).name = this.download; }; true''')

        def export_json():
            click('Export document JSON')
            browser('wait', '--fn', 'window.__exports.at(-1)?.source !== null')
            return load_json(evaluate('window.__exports.at(-1).source'))

        report = {}
        try:
            profile = prepare_profile(private)
            # Own Chrome in this command group; the CLI daemon must not launch it.
            chrome = subprocess.Popen([str(CHROME), '--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + str(profile), '--disable-background-networking', '--disable-component-update', '--no-first-run', '--no-default-browser-check', 'about:blank'], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if os.getpgid(chrome.pid) != os.getpgrp():
                raise RuntimeError('Chrome escaped the monitored command group.')
            port_file = profile / 'DevToolsActivePort'
            deadline = time.monotonic() + 20
            while not port_file.exists():
                if chrome.poll() is not None or time.monotonic() >= deadline:
                    raise RuntimeError('The owned browser did not start.')
                time.sleep(0.05)
            port = int(port_file.read_text().splitlines()[0])
            assert 0 < port < 65536
            cli.extend(['--cdp', str(port)])
            deadline = time.monotonic() + 20
            while not launch.exists():
                assert fixture.poll() is None, 'The browser fixture exited before startup.'
                if time.monotonic() >= deadline:
                    raise RuntimeError('The fixture startup timed out.')
                time.sleep(0.05)
            for headers, status in [({'Host': 'evil.example'}, 400), ({'Origin': 'https://unrelated.example'}, 403), ({}, 401)]:
                connection = http.client.HTTPConnection('127.0.0.1', 3737, timeout=5)
                connection.request('GET', '/api/health', headers={'X-TeXGen-Client': '1', **headers})
                response = connection.getresponse()
                assert response.status == status
                response.read()
                connection.close()
            browser('open', launch.read_text())
            wait('The protected server is ready.')
            wait('This tab owns the editable draft.')
            assert evaluate('location.hash === "" && location.search === "" && !document.cookie.includes("texgen_session")')
            assert evaluate('document.querySelector("input[name=newAllowance]").value === ""')
            evaluate('localStorage.setItem("selectedFormulas", "legacy-formulas"); localStorage.setItem("latex", "legacy-source"); true')
            click('Create document')
            assert evaluate('localStorage.getItem(' + json.dumps(KEY) + ') === null')
            fill('New document page allowance', '3')
            click('Create document')
            assert evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.trim() === "Compile PDF")?.disabled === true')
            fill('Document title', 'Browser notes REPLACEMENT_ONLY_MARKER')
            evaluate('''(() => { const first = document.querySelector('input[type=checkbox]');
              first.setAttribute('data-stage4-first', 'true');
              for (const detail of document.querySelectorAll('details')) if (detail.contains(first)) detail.open = true;
              return true; })()''')
            browser('check', 'input[data-stage4-first]')
            assert len(active()['content']['blocks']) == 1, 'Formula selection did not add a block.'
            fill('Block 1 LaTeX', 'x=1\\\\y=2')
            click('Add text block')
            fill('Block 2 text', 'Keep my manual notes')
            text_id = active()['content']['blocks'][1]['id']
            click('Move block 2 up')
            assert active()['content']['blocks'][0]['id'] == text_id
            click('Add mathematics block')
            fill('Block 3 LaTeX', 'u=v\\\\w=z')
            category = load_json((ROOT / 'data/catalog.json').read_text())['subjects'][0]['categories'][0]
            click('Remove ' + category['label'] + ' formulas')
            assert [block['kind'] for block in active()['content']['blocks']] == ['text', 'math']
            browser('check', 'input[data-stage4-first]')
            fill('Block 3 LaTeX', 'local=edit\\\\manual=break')
            fragment = next(formula for subject in load_json((ROOT / 'data/catalog.json').read_text())['subjects'] for category in subject['categories'] for formula in category['formulas'] if formula['body']['type'] == 'fragment')
            evaluate('''(() => { const label = [...document.querySelectorAll('.formula-choice')].find(label => label.textContent.trim() === ''' + json.dumps(fragment['label']) + ''');
              for (const detail of document.querySelectorAll('details')) if (detail.contains(label)) detail.open = true;
              label.querySelector('input').click(); return true; })()''')
            assert active()['content']['blocks'][-1]['body'] == fragment['body']
            for label, value in [('Page allowance', '4'), ('Columns', '3'), ('Margins (mm)', '6'), ('Body font (pt)', '8.5'), ('Spacing (pt)', '0.5'), ('Column gap (mm)', '2')]:
                fill(label, value)
            click('Apply layout')
            expected = active()
            assert expected['pageAllowance'] == 4 and expected['layout'] == {'paper': 'A4', 'columns': 3, 'marginsMm': 6, 'fontPt': 8.5, 'spacingPt': 0.5, 'columnGapMm': 2}
            click('Export document JSON')
            json_download = downloaded('texgen-document.json')
            assert load_json(json_download.read_text()) == expected
            click('Export TeX')
            tex_download = downloaded('texgen-document.tex')
            assert 'local=edit\\\\manual=break' in tex_download.read_text()
            assert fragment['body']['latex'] in tex_download.read_text()
            capture_exports()
            assert export_json() == expected
            click('Export TeX')
            browser('wait', '--fn', 'window.__exports.length === 2 && window.__exports[1].source !== null')
            source = evaluate('window.__exports[1].source')
            assert 'local=edit\\\\manual=break' in source and fragment['body']['latex'] in source and 'Keep my manual notes' in source
            browser('reload')
            wait('The protected server is ready.')
            wait('This tab owns the editable draft.')
            assert active() == expected
            assert evaluate('localStorage.getItem("selectedFormulas") === "legacy-formulas" && localStorage.getItem("latex") === "legacy-source"')
            report['save_reload_layout_blocks_catalog_fragment_and_exports'] = True

            browser('tab', 'new', ORIGIN)
            wait('Read-only: another tab owns this draft.')
            assert evaluate('document.querySelector("input[name=columns]").matches(":disabled") && document.querySelector("input[type=file]").disabled')
            assert active() == expected
            browser('tab', 't1')
            fill('Document title', 'Newest writer title REPLACEMENT_ONLY_MARKER')
            expected = active()
            browser('tab', 't2')
            browser('wait', '--fn', '[...document.querySelectorAll("input:disabled")].some(input => input.value === "Newest writer title REPLACEMENT_ONLY_MARKER")')
            browser('tab', 'close', 't1')
            click('Request editing')
            wait('This tab owns the editable draft.')
            assert active() == expected
            report['second_tab_readonly_and_new_writer_reloads_latest_draft'] = True

            capture_exports()
            fill('New document page allowance', '2')
            click('Clear and create document')
            empty = active()
            assert empty['content']['blocks'] == [] and empty['pageAllowance'] == 2
            assert evaluate('JSON.parse(localStorage.getItem(' + json.dumps(KEY) + ')).replaced') == expected
            assert export_json() == empty
            assert 'REPLACEMENT_ONLY_MARKER' not in evaluate('window.__exports.at(-1).source')
            click('Restore last replaced document')
            assert active() == expected
            invalid = private / 'invalid.json'
            invalid.write_text('{"version":999}')
            browser('upload', 'input[type=file]', str(invalid))
            wait('Import failed.')
            assert active() == expected
            raw = dict(expected, content={'mode': 'raw', 'source': '  % RAW_SOURCE\r\n\\arbitrary{é}\n'}, modeRecovery={'layout': expected['layout'], 'content': expected['content']})
            imported = private / 'raw.json'
            imported.write_text(json.dumps(raw))
            browser('upload', 'input[type=file]', str(imported))
            wait('Raw source is preserved.')
            assert active() == raw
            assert evaluate('document.querySelector("textarea").readOnly === false && document.querySelector("input[name=columns]").matches(":disabled")')
            assert export_json() == raw
            click('Restore last replaced document')
            assert active() == expected
            report['clear_restore_validated_import_raw_and_mode_recovery_export_boundaries'] = True

            evaluate('window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === ' + json.dumps(KEY) + ') throw new Error("Injected quota failure"); return window.__setItem.call(this,key,value); }; true')
            fill('Document title', 'Unsaved browser title')
            wait('Draft save failed.')
            assert active() == expected
            fill('New document page allowance', '1')
            click('Clear and create document')
            wait('Replacement stopped')
            assert active() == expected
            unsaved = export_json()
            assert unsaved['title'] == 'Unsaved browser title'
            evaluate('Storage.prototype.setItem = window.__setItem; true')
            click('Retry draft save')
            expected = active()
            assert expected == unsaved
            report['ordinary_save_failure_and_atomic_recovery_failure_preserve_content'] = True

            evaluate('''window.__fetch = window.fetch;
              window.fetch = (url, options) => url === '/api/health'
                ? Promise.reject(new Error('Injected connection failure')) : window.__fetch(url, options);
              window.__titleNode = [...document.querySelectorAll('label')].find(label=>label.textContent==='Document title').querySelector('input'); true''')
            click('Check connection')
            wait('Injected connection failure')
            assert evaluate('window.__titleNode.isConnected && window.__titleNode.value === "Unsaved browser title"')
            evaluate('window.fetch = window.__fetch; true')
            click('Check connection')
            wait('The protected server is ready.')
            assert active() == expected
            report['connection_retries_keep_the_editor_session'] = True

            evaluate('''window.__exports = [];
              window.fetch = (url, options) => {
                if (url === '/api/render') return new Promise(resolve => { window.__lateRender = { resolve, request: JSON.parse(options.body) }; });
                return window.__fetch(url,options);
              }; true''')
            click('Export TeX')
            fill('New document page allowance', '2')
            click('Clear and create document')
            evaluate('''(() => { const pending = window.__lateRender; pending.resolve(new Response(JSON.stringify({documentId: pending.request.document.id, revision: pending.request.revision, source:'STALE_RENDER'})));
              window.fetch = window.__fetch; return true; })()''')
            browser('wait', '--fn', '!document.body.textContent.includes("A document operation is in progress")')
            assert evaluate('window.__exports.length === 0')
            report['replacement_rejects_a_late_render_even_if_fetch_ignores_abort'] = True

            evaluate('document.querySelector("button").focus(); true')
            browser('press', 'Tab')
            assert evaluate('document.activeElement !== document.body && document.activeElement.matches(":focus-visible")')
            focus_button('Add text block')
            browser('press', 'Enter')
            assert len(active()['content']['blocks']) == 1
            focus_button('Add mathematics block')
            browser('click', '[data-stage4-button]')
            assert len(active()['content']['blocks']) == 2
            browser('set', 'viewport', '320', '640')
            assert evaluate('document.documentElement.scrollWidth <= innerWidth')
            evaluate('window.scrollTo(0, 0); true')
            browser('screenshot', str(ROOT / 'target/stage4-mobile.png'))
            assert evaluate('document.body.textContent.includes("PDF compilation is disabled")')
            report['keyboard_mobile_320px_and_pdf_disabled'] = True
            # Stage 5 extends the complete Stage 4 journey above.
            browser('set', 'viewport', '1000', '800')
            structured = active()
            replaced = evaluate('JSON.parse(localStorage.getItem(' + json.dumps(KEY) + ')).replaced')
            click('Export TeX')
            browser('wait', '--fn', 'window.__exports.at(-1)?.source !== null')
            generated = evaluate('window.__exports.at(-1).source')
            evaluate('window.confirm = text => { window.__confirms.push(text); return false; }; true')
            click('Open advanced raw editor')
            browser('wait', '--fn', '!document.body.textContent.includes("A document operation is in progress")')
            assert active() == structured
            evaluate('window.confirm = text => { window.__confirms.push(text); return true; }; true')
            click('Open advanced raw editor')
            wait('Edit the complete source below.')
            assert active()['content'] == {'mode': 'raw', 'source': generated}
            assert active()['modeRecovery'] == {'layout': structured['layout'], 'content': structured['content']}
            assert evaluate('JSON.parse(localStorage.getItem(' + json.dumps(KEY) + ')).replaced') == replaced
            manual = '  % MANUAL_RAW é\n\\unknown{incomplete\n'
            fill('Raw LaTeX source', manual)
            raw = active()
            assert raw['content']['source'] == manual
            assert evaluate('document.querySelector("input[name=columns]").matches(":disabled") && [...document.querySelectorAll("input[type=checkbox]")].every(input=>input.matches(":disabled"))')
            assert export_json() == raw
            click('Export TeX')
            browser('wait', '--fn', 'window.__exports.at(-1)?.source !== null')
            assert evaluate('window.__exports.at(-1).source') == manual
            # Remove earlier downloads and verify actual raw JSON and TeX files too.
            json_download.unlink()
            tex_download.unlink()
            evaluate('HTMLAnchorElement.prototype.click = window.__anchorClick; true')
            click('Export document JSON')
            assert load_json(downloaded('texgen-document.json').read_text()) == raw
            click('Export TeX')
            assert downloaded('texgen-document.tex').read_bytes().decode() == manual
            browser('reload')
            wait('This tab owns the editable draft.')
            assert active() == raw
            capture_exports()
            report['raw_conversion_confirmation_manual_edit_reload_and_exact_downloads'] = True

            browser('tab', 'new', ORIGIN)
            wait('Read-only: another tab owns this draft.')
            assert evaluate('document.querySelector("textarea").readOnly && [...document.querySelectorAll("button")].find(button=>button.textContent.trim()==="Return to structured mode").disabled')
            browser('tab', 't2')
            evaluate('''window.__fetch = window.fetch;
              window.fetch = (url, options) => url === '/api/health' ? Promise.reject(new Error('Raw connection failure')) : window.__fetch(url, options);
              window.__rawNode = document.querySelector('textarea'); true''')
            click('Check connection')
            wait('Raw connection failure')
            assert evaluate('window.__rawNode.isConnected')
            fill('Raw LaTeX source', manual + '% offline edit')
            raw = active()
            manual = raw['content']['source']
            evaluate('window.fetch = window.__fetch; true')
            click('Check connection')
            wait('The protected server is ready.')
            assert evaluate('window.__rawNode.isConnected')
            report['raw_reader_lock_and_connection_retry_preserve_editor'] = True

            evaluate('window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = function() { throw new Error("Mode quota failure"); }; true')
            fill('Raw LaTeX source', manual + '% unsaved')
            wait('Draft save failed.')
            unsaved_raw = export_json()
            click('Return to structured mode')
            wait('Mode change stopped.')
            assert active() == raw
            assert export_json() == unsaved_raw
            evaluate('Storage.prototype.setItem = window.__setItem; true')
            click('Retry draft save')
            raw = active()
            evaluate('window.confirm = () => false; true')
            click('Return to structured mode')
            assert active() == raw
            evaluate('window.confirm = text => { window.__confirms.push(text); return true; }; true')
            click('Return to structured mode')
            assert active()['content'] == structured['content']
            assert active()['modeRecovery']['content'] == raw['content']
            structured_with_recovery = active()
            assert export_json() == structured_with_recovery
            fill('Block 1 text', 'New structured edit not merged into manual source')
            changed_structured = active()
            evaluate('Storage.prototype.setItem = function() { throw new Error("Mode quota failure"); }; true')
            click('Restore raw mode recovery')
            wait('Mode change stopped.')
            assert active() == changed_structured
            evaluate('Storage.prototype.setItem = window.__setItem; true')
            click('Restore raw mode recovery')
            wait('Edit the complete source below.')
            assert active()['content'] == raw['content']
            assert active()['modeRecovery']['content'] == changed_structured['content']
            assert evaluate('JSON.parse(localStorage.getItem(' + json.dumps(KEY) + ')).replaced') == replaced
            report['both_mode_recovery_failures_cancellation_and_manual_source_restore'] = True

            for portable in [raw, structured_with_recovery]:
                imported.write_text(json.dumps(portable))
                browser('upload', 'input[type=file]', str(imported))
                wait('The document opened.')
                assert active() == portable and export_json() == portable
            no_recovery = dict(raw, modeRecovery=None)
            imported.write_text(json.dumps(no_recovery))
            browser('upload', 'input[type=file]', str(imported))
            wait('No structured recovery copy exists.')
            assert evaluate('[...document.querySelectorAll("button")].find(button=>button.textContent.trim()==="Return to structured mode").disabled')
            assert export_json() == no_recovery
            report['portable_both_mode_recoveries_and_no_recovery_return_disabled'] = True

            # Clear and restore must retain raw source and mode recovery together.
            fill('New document page allowance', '2')
            click('Clear and create document')
            click('Restore last replaced document')
            assert active() == no_recovery
            fill('New document page allowance', '2')
            click('Clear and create document')
            structured = active()
            evaluate('''window.fetch = (url, options) => url === '/api/render'
              ? new Promise(resolve => { window.__lateMode = {resolve, request: JSON.parse(options.body)}; }) : window.__fetch(url,options); true''')
            click('Open advanced raw editor')
            fill('Document title', 'Edit invalidates conversion')
            evaluate('''(() => { const late = window.__lateMode; late.resolve(new Response(JSON.stringify({documentId:late.request.document.id, revision:late.request.revision, source:'STALE_MODE'}))); window.fetch = window.__fetch; return true; })()''')
            browser('wait', '--fn', '!document.body.textContent.includes("A document operation is in progress")')
            assert active()['content']['mode'] == 'structured'
            assert active()['title'] == 'Edit invalidates conversion'
            # A malformed source reply must not open the raw editor.
            evaluate('window.fetch = (url,options) => url === "/api/render" ? Promise.resolve(new Response(JSON.stringify({documentId:"wrong",revision:0,source:"BAD"}))) : window.__fetch(url,options); true')
            click('Open advanced raw editor')
            wait('Mode change stopped.')
            assert active()['content']['mode'] == 'structured'
            evaluate('window.fetch = window.__fetch; true')
            click('Open advanced raw editor')
            wait('Edit the complete source below.')
            fill('Raw LaTeX source', 'x' * 300)
            browser('set', 'viewport', '320', '640')
            assert evaluate('document.documentElement.scrollWidth <= innerWidth')
            browser('screenshot', str(ROOT / 'target/stage5-mobile.png'))
            assert evaluate('document.body.textContent.includes("PDF compilation is disabled")')
            report['clear_restore_raw_late_conversion_invalid_response_and_mobile'] = True
            browser('tab', 't3')
            click('Request editing')
            wait('Read-only: another tab owns this draft.')
            assert evaluate('document.querySelector("textarea").readOnly')
            browser('tab', 't2')
            assert evaluate('!document.querySelector("textarea").readOnly')
            report['writer_lock_retained_across_mode_changes'] = True
            report.update(passed=True, browser=str(CHROME), browser_download=False, origin=ORIGIN,
                          profile='disposable profile under target/', real_rust_router=True,
                          http_protections=True, compiler_disabled=True, owned_chrome_command_group=True, downloads='Actual JSON and TeX files verified in a disposable download directory. Additional export-boundary checks captured Blob content.')
            (ROOT / 'target/stage5-browser.json').write_text(json.dumps(report, indent=2) + '\n')
            print('PASS: Stages 4 and 5 isolated-browser workflow, mode recovery, raw editing, two tabs, exports, failures, keyboard, and mobile checks.')
        except Exception:
            try:
                diagnostics = evaluate('''({blocks: JSON.parse(localStorage.getItem('texgen.draft.v1'))?.active?.content,
                  blockLabels: [...document.querySelectorAll('.blocks label')].map(label => [...label.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('')),
                  alerts: [...document.querySelectorAll('[role=alert]')].map(element => element.textContent),
                  blockCount: document.querySelectorAll('.blocks > li').length,
                  addTextDisabled: [...document.querySelectorAll('button')].find(button => button.textContent === 'Add text block')?.matches(':disabled')})''')
                (ROOT / 'target/stage4-browser-failure.json').write_text(json.dumps(diagnostics, indent=2) + '\n')
                summary = dict(diagnostics)
                if 'blocks' in summary:
                    summary['blocks'] = [{key: block[key] for key in ('kind', 'id')} for block in summary['blocks'].get('blocks', [])]
                print('Browser failure state:', json.dumps(summary)[:2000], flush=True)
            except Exception as diagnostic_error:
                print('Browser failure state unavailable:', type(diagnostic_error).__name__, flush=True)
            raise
        finally:
            try:
                if '--cdp' in cli:
                    browser('close')
            finally:
                if chrome is not None and chrome.poll() is None:
                    chrome.terminate()
                    try:
                        chrome.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        chrome.kill()
                        chrome.wait()
                if fixture.poll() is None:
                    fixture.send_signal(signal.SIGINT)
                    try:
                        fixture.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        fixture.kill()
                        fixture.wait()
                fixture_log.close()


if __name__ == '__main__':
    import sys
    if sys.argv[1:] == ['--self-check']:
        import ast
        tree = ast.parse(Path(__file__).read_text())
        calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call)
                 and isinstance(node.func, ast.Attribute) and node.func.attr == 'Popen'
                 and node.args and isinstance(node.args[0], ast.List)
                 and ast.unparse(node.args[0].elts[0]) == 'str(CHROME)']
        if len(calls) != 1 or any(keyword.arg in {'start_new_session', 'process_group', 'preexec_fn'} for keyword in calls[0].keywords):
            raise RuntimeError('Chrome must be a direct child in the monitored command group.')
        with tempfile.TemporaryDirectory(prefix='profile-selfcheck-', dir=ROOT / 'target') as temporary:
            private = Path(temporary)
            profile = prepare_profile(private)
            prefs = load_json((profile / 'Default/Preferences').read_text())
            if prefs['download'] != {'default_directory': str(private / 'downloads'), 'prompt_for_download': False}:
                raise RuntimeError('Downloads must use the private absolute destination.')
        print('Browser ownership and private-download configuration self-checks passed. No browser or fixture started.')
    elif sys.argv[1:]:
        raise SystemExit('Usage: verify-browser-stage4.py [--self-check]')
    else:
        main()
