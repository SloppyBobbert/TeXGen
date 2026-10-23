#!/usr/bin/env python3
"""Drive one controller-approved real compile through the protected production UI."""
import base64
import http.client
import json
import os
import re
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from verify_pdf_worker import CHROME, ROOT, json_value, require, stop

ORIGIN = 'http://127.0.0.1:3737'
SOURCE = r'\documentclass[a4paper]{article}\begin{document}TeXGen protected workflow first page.\newpage TeXGen protected workflow second page.\end{document}'


def main():
    require(len(sys.argv) == 2 and CHROME.is_file(), 'An approved attempt directory and installed Chrome are required.')
    attempt = Path(sys.argv[1]).resolve()
    require(attempt.parent == ROOT / 'target/stage6-probes' and re.fullmatch(r'(?:attempt-\d{2}|browser-preflight-[a-f0-9]{16})', attempt.name), 'The browser attempt directory is not approved.')
    os.umask(0o077)
    def timeout(_signal, _frame):
        raise TimeoutError('The protected browser verification exceeded its deadline.')
    signal.signal(signal.SIGALRM, timeout)
    signal.alarm(70)
    with tempfile.TemporaryDirectory(prefix='browser-', dir=attempt) as temporary:
        private = Path(temporary)
        profile = private / 'profile'
        profile.mkdir()
        cli = None
        with (private / 'chrome.log').open('wb') as log:
            chrome = subprocess.Popen([str(CHROME), '--headless=new', '--remote-debugging-port=0', f'--user-data-dir={profile}', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run', '--no-default-browser-check', '--disk-cache-size=1048576', '--media-cache-size=1048576', 'about:blank'], stdout=log, stderr=subprocess.STDOUT)
            try:
                deadline = time.monotonic() + 20
                active = profile / 'DevToolsActivePort'
                while not active.exists():
                    require(chrome.poll() is None and time.monotonic() < deadline, 'The private Chrome instance did not start.')
                    time.sleep(0.05)
                cli = ['agent-browser', '--session', f'texgen-compile-{os.getpid()}', '--cdp', str(int(active.read_text().splitlines()[0]))]

                def browser(*args, code=None):
                    result = subprocess.run([*cli, '--json', *args], input=code, capture_output=True, text=True, timeout=60)
                    require(result.returncode == 0, re.sub(r'launch=[a-f0-9]+', 'launch=<redacted>', result.stderr[-1000:]))
                    data = json_value(result.stdout)
                    require(data.get('success'), 'The browser action failed.')
                    return data['data'].get('result', data['data'])

                def evaluate(code):
                    return browser('eval', '--stdin', code=code)

                def click(name):
                    require(evaluate('''(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === NAME);
                      if (!b || b.disabled) return false; b.focus(); return document.activeElement === b; })()'''.replace('NAME', json.dumps(name))), 'The button is not available: ' + name)
                    browser('press', 'Enter')

                connection = http.client.HTTPConnection('127.0.0.1', 3737, timeout=5)
                connection.request('POST', '/api/compile', '{}', {'Origin': ORIGIN, 'X-TeXGen-Client': '1', 'Content-Type': 'application/json'})
                response = connection.getresponse()
                require(response.status == 401, 'Unauthorized compilation was not blocked.')
                response.read()
                connection.close()
                browser('open', (attempt / 'launch.txt').read_text())
                browser('wait', '--text', 'This tab owns the editable draft.')
                browser('wait', '--text', 'The protected compiler is available.')
                evaluate('''window.confirm = () => true;
                  window.__pdfExports = [];
                  const original = URL.createObjectURL;
                  URL.createObjectURL = blob => { window.__pdfExports.push({blob, type: blob.type}); return original(blob); };
                  HTMLAnchorElement.prototype.click = function() { window.__pdfExports.at(-1).name = this.download; }; true''')
                browser('fill', 'input[name=newAllowance]', '1')
                click('Create document')
                click('Open advanced raw editor')
                browser('wait', '--text', 'Raw source is preserved.')
                evaluate('''(() => { const label = [...document.querySelectorAll('label')].find(x => x.textContent.includes('Raw LaTeX source'));
                  label.querySelector('textarea').setAttribute('data-compile-source', 'true'); return true; })()''')
                browser('fill', '[data-compile-source]', SOURCE)
                click('Compile PDF')
                browser('wait', '--text', 'Actual page count: 2.')
                browser('wait', '--text', 'All 2 pages are retained.')
                require(evaluate('''JSON.parse(localStorage.getItem('texgen.draft.v1')).active.content.source''') == SOURCE, 'The raw source changed during compilation.')
                evaluate('''window.__pageHasInk = () => { const c = document.querySelector('.pdf-page canvas');
                  if (!c || c.hidden || !c.width || !c.height) return false;
                  const p = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
                  for (let i = 0; i < p.length; i += 16) if (p[i + 3] > 0 && p[i] + p[i+1] + p[i+2] < 600) return true;
                  return false; }; true''')
                browser('wait', '--fn', 'window.__pageHasInk()')
                click('Next page')
                browser('wait', '--fn', 'document.querySelector(".pdf-page canvas")?.dataset.renderedPage === "2" && window.__pageHasInk()')
                changed = SOURCE + '\n% retained edit after compilation\n'
                browser('fill', '[data-compile-source]', changed)
                browser('wait', '--text', 'This PDF is outdated.')
                click('Export PDF')
                exported = evaluate('''(async () => { const x = window.__pdfExports.at(-1); const bytes = new Uint8Array(await x.blob.arrayBuffer());
                  return {name: x.name, type: x.type, data: btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))}; })()''')
                require(exported['name'] == 'texgen-document.pdf' and exported['type'] == 'application/pdf', 'The retained PDF export type differs.')
                pdf = base64.b64decode(exported['data'], validate=True)
                require(0 < len(pdf) <= 10 * 1024 * 1024 and pdf.startswith(b'%PDF-'), 'The exported candidate is not bounded PDF data.')
                (attempt / 'candidate.pdf').write_bytes(pdf)
                click('Export document JSON')
                portable = evaluate('''(async () => JSON.parse(await window.__pdfExports.at(-1).blob.text()))()''')
                require(portable['content']['source'] == changed, 'JSON export lost the raw edit.')
                connection = http.client.HTTPConnection('127.0.0.1', 3737, timeout=5)
                connection.request('GET', '/')
                response = connection.getresponse()
                csp = response.getheader('content-security-policy', '')
                response.read()
                connection.close()
                require("worker-src 'self'" in csp and "font-src 'self' blob: data:" in csp and 'unsafe-eval' not in csp, 'The production worker CSP differs.')
                report = {'actualPages': 2, 'allPagesRetained': True, 'secondPagePainted': True,
                          'overflowWarning': True, 'rawSourcePreserved': True, 'laterRawEditExported': True,
                          'outdatedPdfIdentified': True, 'retainedPdfExportBytes': len(pdf),
                          'productionCspVerified': True, 'unauthorizedCompileBlocked': True,
                          'compileClicks': 1, 'printedReadabilityVerified': False}
                (attempt / 'browser-report.json').write_text(json.dumps(report, indent=2) + '\n')
                print(json.dumps(report, sort_keys=True))
            finally:
                try:
                    if cli:
                        subprocess.run([*cli, 'close'], capture_output=True, timeout=15)
                finally:
                    stop(chrome)
    signal.alarm(0)


if __name__ == '__main__':
    main()
