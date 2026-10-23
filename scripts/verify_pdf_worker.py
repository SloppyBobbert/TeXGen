#!/usr/bin/env python3
"""Check the real browser PDF worker with existing candidates; no compiler job."""
import base64
import http.client
import json
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHROME = Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
PORT = 5187


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def json_value(source):
    try:
        return json.loads(source)
    except (TypeError, ValueError) as error:
        raise RuntimeError('The browser result is not valid JSON.') from error


def stop(process):
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def main():
    require(CHROME.is_file() and shutil.which('agent-browser'), 'Installed Chrome and agent-browser are required. Install nothing.')
    os.umask(0o077)
    with tempfile.TemporaryDirectory(prefix='pdf-worker-', dir=ROOT / 'target') as temporary:
        private = Path(temporary)
        profile = private / 'profile'
        profile.mkdir()
        with (private / 'vite.log').open('wb') as vite_log, (private / 'chrome.log').open('wb') as chrome_log:
            vite = subprocess.Popen([str(ROOT / 'ui/node_modules/.bin/vite'), '--host', '127.0.0.1', '--port', str(PORT), '--strictPort'], cwd=ROOT / 'ui', stdout=vite_log, stderr=subprocess.STDOUT)
            chrome = None
            cli = None
            try:
                deadline = time.monotonic() + 20
                while True:
                    require(vite.poll() is None and time.monotonic() < deadline, 'The local test server did not start.')
                    try:
                        connection = http.client.HTTPConnection('127.0.0.1', PORT, timeout=1)
                        connection.request('GET', '/')
                        response = connection.getresponse()
                        ready = response.status == 200
                        response.read()
                        connection.close()
                        if ready:
                            break
                    except OSError:
                        pass
                    time.sleep(0.05)
                chrome = subprocess.Popen([str(CHROME), '--headless=new', '--remote-debugging-port=0', f'--user-data-dir={profile}', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run', '--no-default-browser-check', '--disk-cache-size=1048576', '--media-cache-size=1048576', 'about:blank'], stdout=chrome_log, stderr=subprocess.STDOUT)
                active = profile / 'DevToolsActivePort'
                while not active.is_file():
                    require(chrome.poll() is None and time.monotonic() < deadline, 'The private Chrome instance did not start.')
                    time.sleep(0.05)
                cdp = int(active.read_text().splitlines()[0])
                cli = ['agent-browser', '--session', f'texgen-pdf-{os.getpid()}', '--cdp', str(cdp)]

                def browser(*args, code=None):
                    result = subprocess.run([*cli, '--json', *args], input=code, capture_output=True, text=True, timeout=60)
                    require(result.returncode == 0, 'The browser command failed: ' + result.stderr[-1000:])
                    value = json_value(result.stdout)
                    require(value.get('success'), str(value)[:1000])
                    return value['data'].get('result', value['data'])

                browser('open', f'http://127.0.0.1:{PORT}')
                report = {}
                for attempt, name, width, height in [(3, 'canonical', 595.28, 841.89), (4, 'raw', 612, 792), (14, 'hostile', 612, 792)]:
                    path = ROOT / f'target/stage6-probes/attempt-{attempt:02}/candidate.pdf'
                    data = path.read_bytes()
                    require(0 < len(data) <= 10 * 1024 * 1024, 'The fixture exceeds its existing PDF limit.')
                    encoded = base64.b64encode(data).decode('ascii')
                    code = '''(async () => {
                      const { openPdf } = await import('/src/pdf.ts');
                      const bytes = Uint8Array.from(atob(ENCODED), x => x.charCodeAt(0));
                      const pdf = await openPdf(bytes, new AbortController().signal);
                      try {
                        const page = await pdf.document.getPage(1);
                        const viewport = page.getViewport({scale: 1});
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
                        await page.render({canvas, viewport}).promise;
                        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                        let inkPixels = 0;
                        for (let i = 0; i < pixels.length; i += 4)
                          if (pixels[i + 3] > 0 && pixels[i] + pixels[i + 1] + pixels[i + 2] < 600) inkPixels++;
                        const text = (await page.getTextContent()).items.filter(x => 'str' in x).map(x => x.str).join(' ');
                        return {pages: pdf.document.numPages, width: viewport.width, height: viewport.height, inkPixels, text, exportBytes: bytes.length};
                      } finally { pdf.close(); }
                    })()'''.replace('ENCODED', json.dumps(encoded))
                    result = browser('eval', '--stdin', code=code)
                    require(result['pages'] == 1 and abs(result['width'] - width) < 0.1 and abs(result['height'] - height) < 0.1, 'The browser page metadata differs from PDFKit.')
                    require(result['inkPixels'] > 100 and result['exportBytes'] == len(data), 'The PDF did not paint or export bytes were detached.')
                    if name == 'hostile':
                        require('Host project paths and shell commands were blocked.' in result['text'], 'The hostile fixture success text is missing.')
                    report[name] = result
                invalid = browser('eval', '--stdin', code='''(async () => {
                  const { openPdf } = await import('/src/pdf.ts');
                  try { const pdf = await openPdf(new Uint8Array([37,80,68,70,45,120]), new AbortController().signal); pdf.close(); return false; }
                  catch { return true; }
                })()''')
                require(invalid is True, 'Malformed PDF bytes were accepted.')
                report['malformedRejected'] = True
                report['compilerImageAttemptsUsed'] = 0
                report['productionCspVerified'] = False
                (ROOT / 'target/stage6-pdf-worker-browser.json').write_text(json.dumps(report, indent=2) + '\n')
                print(json.dumps(report, sort_keys=True))
            finally:
                try:
                    if cli:
                        subprocess.run([*cli, 'close'], capture_output=True, timeout=15)
                finally:
                    try:
                        if chrome:
                            stop(chrome)
                    finally:
                        stop(vite)


if __name__ == '__main__':
    main()
