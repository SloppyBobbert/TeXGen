#!/usr/bin/env python3
"""Fetch the one explicitly approved browser PDF package; do not install it."""
import base64
import hashlib
import io
import json
import sys
import tarfile
import urllib.request
from pathlib import Path, PurePosixPath

URL = 'https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz'
INTEGRITY = 'AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g=='
CAP = 12 * 1024 * 1024
UNPACKED = 34913648
FILES = 554
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'target/pdfjs-package-6.4.299'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def members_contract(members):
    total = count = 0
    names = set()
    for member in members:
        path = PurePosixPath(member.name)
        require(path.parts and path.parts[0] == 'package'
                and '..' not in path.parts and '\\' not in member.name,
                'The archive contains an unsafe path.')
        require(member.name not in names, 'The archive contains duplicate names.')
        names.add(member.name)
        require(member.isdir() or member.isfile(), 'The archive contains a link or special file.')
        if member.isfile():
            count += 1
            total += member.size
            require(count <= FILES and total <= UNPACKED, 'The archive exceeds its registry contract.')
    return count, total


def verify(data):
    require(0 < len(data) <= CAP, 'The archive exceeds its approved download limit.')
    require(hashlib.sha512(data).digest() == base64.b64decode(INTEGRITY), 'The archive integrity does not match.')
    with tarfile.open(fileobj=io.BytesIO(data), mode='r|gz') as archive:
        require(members_contract(archive) == (FILES, UNPACKED), 'The archive differs from the registry file contract.')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('An archive redirect is not approved.')


def self_check():
    file = tarfile.TarInfo('package/build/pdf.mjs')
    file.size = 1
    require(members_contract([file]) == (1, 1), 'The valid-path self-check failed.')
    for name, kind in [('../outside', tarfile.REGTYPE), ('package/../outside', tarfile.REGTYPE),
                       ('/package/outside', tarfile.REGTYPE), ('package/link', tarfile.SYMTYPE),
                       ('package/device', tarfile.CHRTYPE)]:
        bad = tarfile.TarInfo(name)
        bad.type = kind
        try:
            members_contract([bad])
        except ValueError:
            continue
        raise ValueError('The unsafe archive member was accepted.')
    for data in [b'', b'invalid', b'x' * (CAP + 1)]:
        try:
            verify(data)
        except ValueError:
            continue
        raise ValueError('The invalid archive was accepted.')
    print('Path, link, size, and integrity self-checks passed. No network request ran.')


def download():
    OUTPUT.mkdir(mode=0o700, parents=True, exist_ok=True)
    require(not OUTPUT.is_symlink(), 'The package directory must not be a symlink.')
    # A failed download needs review; do not silently retry or reset this marker.
    with (OUTPUT / 'download.started.json').open('x') as marker:
        json.dump({'explicitUserApproval': True, 'url': URL, 'maxBytes': CAP,
                   'integrity': 'sha512-' + INTEGRITY}, marker, indent=2)
    opener = urllib.request.build_opener(NoRedirect())
    with opener.open(URL, timeout=30) as response:
        require(response.status == 200 and response.geturl() == URL, 'The archive response is not approved.')
        data = response.read(CAP + 1)
    verify(data)
    archive = OUTPUT / 'pdfjs-dist-6.4.299.tgz'
    with archive.open('xb') as output:
        output.write(data)
    report = {'version': '6.4.299', 'url': URL, 'archiveBytes': len(data),
              'unpackedBytes': UNPACKED, 'regularFiles': FILES,
              'integrity': 'sha512-' + INTEGRITY, 'sha256': hashlib.sha256(data).hexdigest(),
              'installed': False, 'optionalNativeArchivesFetched': False}
    with (OUTPUT / 'verified.json').open('x') as evidence:
        json.dump(report, evidence, indent=2)
        evidence.write('\n')
    print(json.dumps(report, sort_keys=True))


if __name__ == '__main__':
    if sys.argv[1:] == ['--self-check']:
        self_check()
    elif sys.argv[1:] == ['--download-approved']:
        download()
    else:
        raise SystemExit('Use --self-check or --download-approved.')
