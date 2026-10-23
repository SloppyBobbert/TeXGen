#!/usr/bin/env python3
"""Cache only approved registry JSON before one offline lock-resolution retry."""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'target/pdfjs-package-6.4.299/metadata'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def optional_specs(metadata):
    require(not metadata.get('dependencies'), 'An unapproved required dependency needs review.')
    optional = metadata.get('optionalDependencies', {})
    require(isinstance(optional, dict), 'The optional dependency metadata is invalid.')
    for name, version in optional.items():
        require(re.fullmatch(r'@napi-rs/canvas(?:-[a-z0-9-]+)?', name) is not None,
                'An optional dependency is outside the approved metadata scope.')
        require(isinstance(version, str) and re.fullmatch(r'\^?1\.\d+\.\d+', version) is not None,
                'The optional dependency version needs review.')
    return optional


def view(spec, filename):
    result = subprocess.run(['npm', 'view', spec, '--json', '--ignore-scripts',
                             '--no-audit', '--no-fund', '--fetch-retries=0',
                             '--fetch-timeout=15000', '--registry=https://registry.npmjs.org'],
                            cwd=ROOT, capture_output=True, text=True, timeout=45, check=True)
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise ValueError('The registry metadata is not valid JSON.') from error
    with (OUTPUT / filename).open('x') as output:
        json.dump(data, output)
        output.write('\n')
    print('Cached registry metadata:', spec)
    return data


def warm():
    OUTPUT.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (OUTPUT / 'started.json').open('x') as marker:
        json.dump({'explicitUserApproval': True, 'metadataOnly': True,
                   'packageArchivesAllowed': False, 'installScriptsAllowed': False}, marker)
    pdf = view('pdfjs-dist@6.4.299', 'pdfjs.json')
    require(pdf['name'] == 'pdfjs-dist' and pdf['version'] == '6.4.299', 'The PDF package metadata changed.')
    optional = optional_specs(pdf)
    require(optional == {'@napi-rs/canvas': '^1.0.10'}, 'The approved dependency metadata changed.')
    candidates = view('@napi-rs/canvas@^1.0.10', 'canvas.json')
    candidates = candidates if isinstance(candidates, list) else [candidates]
    candidates = [item for item in candidates if re.fullmatch(r'1\.\d+\.\d+', item['version'])]
    canvas = max(candidates, key=lambda item: tuple(map(int, item['version'].split('.'))))
    require(canvas['name'] == '@napi-rs/canvas', 'The optional parent metadata is invalid.')
    for index, (name, version) in enumerate(optional_specs(canvas).items()):
        child = view(f'{name}@{version}', f'platform-{index}.json')
        require(child['name'] == name and not child.get('dependencies')
                and not child.get('optionalDependencies'), 'A platform metadata record needs review.')
    print('Metadata-only cache warmup finished. No package archive or installation was requested.')


def self_check():
    require(optional_specs({'optionalDependencies': {'@napi-rs/canvas': '^1.0.10'}})
            == {'@napi-rs/canvas': '^1.0.10'}, 'The valid metadata self-check failed.')
    for metadata in [{'dependencies': {'other': '1.0.0'}},
                     {'optionalDependencies': {'other': '1.0.0'}},
                     {'optionalDependencies': {'@napi-rs/canvas': 'https://example.com/code.tgz'}}]:
        try:
            optional_specs(metadata)
        except ValueError:
            continue
        raise ValueError('Unapproved metadata was accepted.')
    print('Metadata scope and dependency self-checks passed. No network request ran.')


if __name__ == '__main__':
    if sys.argv[1:] == ['--self-check']:
        self_check()
    elif sys.argv[1:] == ['--approved-metadata']:
        warm()
    else:
        raise SystemExit('Use --self-check or --approved-metadata.')
