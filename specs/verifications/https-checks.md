# Public HTTPS local verification

Status: local checks passed; independent review and fresh CI still required. No
hosting, public exposure, DNS, provisioning, deployment, staging or commits done.
Worktree: `/Users/brandontran/TeXGen/.slim/worktrees/deployment-config`, branch
`feat/public-deployment`, base `0fa9f8d0423ad1b7c5423bfbcc3229f3f5fe6e3c`.

## Commands and results

All commands ran from this worktree unless a `cd` is shown. The approved existing
venv supplies tools only; no dependencies were installed or source symlinks made.

```sh
cd backend
DJANGO_DEBUG=True DJANGO_SETTINGS_MODULE=cheat_sheet.settings DATABASE_URL=sqlite:///:memory: /Users/brandontran/TeXGen/.slim/worktrees/document-sections/backend/.venv/bin/python -m pytest --cov-fail-under=95
/Users/brandontran/TeXGen/.slim/worktrees/document-sections/backend/.venv/bin/ruff check . ../scripts ../frontend/scripts
```

Result: **502 passed, 7 skipped, 96.97% coverage**, 95% gate passed. Seven skips
are the unchanged PostgreSQL-only tests on SQLite, not new exclusions. Ruff:
`All checks passed!`. New focused module contributes 20 passing tests covering
16 malformed hostnames, missing TLS, rendered Compose boundaries and cleanup on
cancellation/failed startup. Earlier focused run:

```sh
cd backend
DJANGO_DEBUG=True DJANGO_SETTINGS_MODULE=cheat_sheet.settings DATABASE_URL=sqlite:///:memory: /Users/brandontran/TeXGen/.slim/worktrees/document-sections/backend/.venv/bin/python -m pytest api/test_public_https.py --no-cov -q
```

Result: 20 passed. The subsequent full suite included those tests with coverage.

```sh
docker compose version
python3 scripts/check-public-https.py
python3 scripts/check-proxy-scheme.py
sh -n scripts/start-public-nginx.sh
/Users/brandontran/TeXGen/.slim/worktrees/document-sections/backend/.venv/bin/ruff check backend scripts frontend/scripts
git diff --check
git diff --cached --quiet
```

Results: Compose **5.1.3**; all probes and checks exited 0; no staged files.
Shell syntax passed. Standalone `shellcheck` is not installed; the editor's shell
analyzer only flagged intentional literal envsubst quoting (SC2016).

Public probe output:

```text
PASS: verified TLS trust/hostname, Unix HTTPS scheme, sanitized headers, fixed redirect, Host rejection, health/static/cache, fail-closed inputs
```

The public probe uses `ssl.create_default_context(cafile=...)` with a synthetic
DNS SAN certificate and real hostname verification, not `CERT_NONE`. It tests
HTTPS through the private Gunicorn socket, spoofed forwarding headers,
configured-host redirects, unknown Host rejection on HTTP and HTTPS including
absolute-form request targets, internal health, SPA/assets and Django static
alias routing, `/admin/` proxy routing, cache/security headers, invalid hostname,
missing key and malformed key startup failures. Failed-startup containers have
no network or published ports; successful containers bind only 127.0.0.1.
Temporary certificates and keys are deleted, never tracked.

The unchanged local scheme probe passed HTTP forwarding replacement/removal,
trusted Unix HTTPS, socket UID/GID/mode and denial of a different UID.
Both probes used these already approved image IDs, with `--pull=never`:

- backend: `sha256:756a040f7052cdb04bdb73ab9ddb74d2532f5f1f48f2bcdba86849cb3c7a817d`
- frontend: `sha256:8061d71594c9e17e9b9b26ff8d19c021c4d146f4054c01569f53557d849b9b5c`

The rendered Compose test invokes `docker compose --env-file /dev/null -f
<base> [-f <overlay>] config --format json` with synthetic values. It checks
exactly two loopback ephemeral port mappings (8081/8443), no inherited 8080
publication, forced TLS flag 0 despite ambient 1, localhost health allowance,
unchanged users/security/resources/networks/healthchecks and inherited mounts,
read-only bind mounts with directory auto-creation disabled, no backend/database
ports and unchanged networkless compiler/database definitions.

Live cancellation check (in addition to mocked cancellation/timeout unit tests):

```sh
python3 - <<'PY'
import os, signal, subprocess, time, uuid
run_id = uuid.uuid4().hex
label = 'label=texgen.verification.run=' + run_id
child = subprocess.Popen(['python3', 'scripts/check-public-https.py'], env={**os.environ, 'TEXGEN_VERIFICATION_ID': run_id}, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
try:
    deadline = time.monotonic() + 20
    while True:
        names = subprocess.check_output(['docker', 'ps', '-a', '--filter', label, '--format', '{{.Names}}'], text=True, timeout=5)
        if '-backend' in names:
            break
        assert child.poll() is None, 'probe exited before cancellation'
        assert time.monotonic() < deadline, 'no owned backend appeared'
        time.sleep(0.1)
    child.send_signal(signal.SIGTERM)
    out, err = child.communicate(timeout=90)
    assert child.returncode == 143, (child.returncode, out, err)
    for listing in (['ps', '-a'], ['volume', 'ls']):
        remaining = subprocess.check_output(['docker', *listing, '--filter', label, '--format', '{{.ID}}' if listing[0] == 'ps' else '{{.Name}}'], text=True, timeout=30)
        assert not remaining.strip(), remaining
    print('PASS: live SIGTERM exits 143; no owned containers or volumes remain')
finally:
    if child.poll() is None:
        child.send_signal(signal.SIGTERM)
        child.communicate(timeout=90)
PY
```

Result: `PASS: live SIGTERM exits 143; no owned containers or volumes remain`.
Every probe uses unique ownership labels and existing bounded cleanup; no
application volumes or existing stacks were removed or changed.

## Self-audit and evidence limits

- Changed only the new overlay, TLS template/startup script, focused test module,
  TLS probe, three-line CI step, owner-provided plan/impact docs and this evidence.
  Existing local Compose/Nginx/verifiers and application source remain unchanged.
- The CI step follows image preparation and existing production/browser runtime
  verification. This new CI run has not happened yet. Previous merged baseline
  CI 35649116075 passed; it is not evidence of these new changes.
- Full local production/browser and PostgreSQL suites were not rerun here. This
  worktree has no prepared private production fixture. Existing local scheme
  regression, full SQLite backend and new public TLS verification passed.
- WSGI fixture proves transport/header/scheme behavior, not real Django/admin
  login, secure-cookie issuance, CSRF flows, editor journeys or public capacity.
- Nginx rejects absent/unreadable/malformed/mismatched certificate/key inputs;
  operator must separately check certificate dates, hostname coverage, public
  trust, renewal and reload. No real certificate was acquired or installed.
- Native Compose `!override` is a YAML-language-server false positive (actual
  Compose rendering passes). Editor missing-pytest warning reflects its unrelated
  interpreter, not the approved venv. Literal envsubst quoting and bounded
  readiness exception handling are intentional, session-only dispositions.
  Existing CI line-length warnings are pre-existing and deferred out of scope,
  not claimed false positives. No analyzer rules or inline suppressions changed;
  this is not a claim of a clean whole-repository analyzer baseline. Gitleaks and
  Opengrep also flagged the unchanged `frontend/e2e/auth.spec.js:54` login mock.
  Inspection established it is explicitly synthetic JWT test data with a fake
  signature, not a usable credential. Both received session-only false-positive
  dispositions with supervisor approval; the fixture stayed unchanged.
- DNS, hosting, firewall, public listeners, certificate operations, backups,
  restoration, reboot recovery, image delivery and real-user capacity are
  unverified. Public operation still needs owner authorization and staging gates.
- `.pi/https-review-manifest.json` records SHA256 for every scoped changed/new
  source and documentation file, excluding itself and private runtime outputs.
  Source is frozen after manifest creation for independent review.
