# e01s01 task 5 — implementation verification

Implementation checks pass. Independent review is pending and belongs to the parent. Task 5 and the story remain `failing` until that review passes.

## Source identity

- Worktree: `/Users/brandontran/TeXGen/.slim/worktrees/document-sections`.
- Branch: `fix/document-sections`.
- HEAD: `65a4938f11bd3b3817e3ba98b2b5e8fe1afa9783`.
- Combined tracked-diff/new-source SHA-256: `b183056097ae4ba93dd84b4698680ab11077ad36cb72b43039678d7b847de08e`.
- `e01s01-source-manifest.json` records the algorithm and all 30 changed/new source, test, and configuration files. Evidence and runtime caches are outside this source digest.
- No files were staged. No commit, push, publication, merge, or auto-merge occurred.

## Final checks

Commands ran from this worktree, with its `backend/.venv/bin` first on PATH. Each listed check exited 0.

| Check | Result | Evidence |
| --- | --- | --- |
| `cd backend && python3 -m pytest --cov-fail-under=95` | 422 passed; 5 PostgreSQL-only skips; 96.71% coverage | `e01s01-final-backend.log` |
| `TEXGEN_REQUIRE_POSTGRES_CONCURRENCY=1 python3 -m pytest --no-cov tests/test_compile_quota_postgres.py` | All 5 passed on the owned PostgreSQL service; no skips | `e01s01-final-postgres.log` |
| `cd backend && python3 -m ruff check . && python3 manage.py check && python3 manage.py makemigrations --check --dry-run` | All pass; no pending migration changes | `e01s01-final-backend-static.log` |
| `cd frontend && npm test -- --run && npm run lint && npm run build` | 185 tests in 14 files pass; lint/build pass | `e01s01-final-frontend-all.log` |
| Real Chromium / Django / PostgreSQL / offline Tectonic journeys | 3 pass; no skips | `e01s01-real-stack-final.log` |
| Final owned Compose rebuild, then real journeys | Build passes; 3 browser tests pass | `e01s01-final-stack-build.log`, `e01s01-rebuilt-real-stack.log` |
| `git diff --check` | Pass | Recorded terminal command |
| CI YAML parse and folded fixture-seed command | Pass; 16 long lines are all unchanged baseline text | `e01s01-ci-width-baseline.json` |

The PostgreSQL URL was constructed from the owned Compose service configuration in process memory. Its value was not printed. The five skipped SQLite-suite cases are not counted as passes; their separate PostgreSQL run is required.

Exact browser command, from `frontend/`:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:55173 \
PLAYWRIGHT_BROWSERS_PATH="$PWD/../.pi/playwright-browsers" \
npm run test:e2e -- e2e/real-stack.spec.js --workers=1 --reporter=line
```

Exact owned-stack build command:

```sh
docker compose -p texgen-e01s01-document-sections \
  -f docker-compose.yml -f .pi/e01s01-compose-test.yaml \
  up -d --build --wait
```

The disposable template seed runs through `manage.py shell < backend/tests/seed_e2e_template.py`. Two consecutive seed runs left exactly one fixture. The checked-in CI journey now seeds this fixture before Playwright.

Final terminal receipts, all exit 0:

- `b0727782a`: backend coverage, static checks, PostgreSQL concurrency.
- `be800fa16`: final image rebuild and real browser journeys.
- `bf268bfca`: final frontend tests/lint/build and browser journeys, including five additional removal-entry-point tests.
- `b867b02b2`: connection stress check and eight settings tests.

Receipts are under `.pi/tasks/session-50465-50465/`. Automatic child notifications were unavailable. The supervisor authorized one status inspection at each dependency barrier, followed by terminal-log collection. No polling loops were used.

## Browser and regression coverage

Both 1440×1000 and 390×844 journeys create a sheet from the seeded template, edit one formula and add a custom note, remove an untouched sibling, cancel an edited removal, confirm it using the keyboard, undo it, compile real PDF bytes, save, clear browser storage, and reload from the server. They also switch to raw source, change selections without changing source, save, clear storage, and reload raw mode. The original registration/compile/save/reload/delete journey also passes.

The dialog focuses Cancel, fits the mobile viewport, supports Escape and Tab, and restores opener focus on cancellation. An initial browser regression found focus restoration while the native dialog was still modal. Cleanup now closes the dialog before restoring focus. The failing run is preserved in `e01s01-real-stack-focus-failure.log`.

Unit and integration coverage includes edited-block confirmation, cancellation, stale revision/selection rejection, source/selection undo and redo, layout restoration, damaged history, stable catalog IDs, catalog-label changes, malformed/duplicate/unknown markers, structural wrapper changes, legacy/raw documents, draft/server persistence, late save reconciliation, stale compile cancellation, and last-good-preview recovery. Every formula/category/class/all-classes removal entry point keeps selection unchanged until the shared removal callback applies it.

## Related development-server connection fix

A repeated real-stack run exposed PostgreSQL exhaustion. The existing deletion journey received HTTP 500. A direct psql connection also failed with `too many clients already`. This was not treated as a pass or fixed by raising limits.

The supervisor authorized restarting only the owned backend for diagnosis. Evidence:

1. Existing configuration: `DEBUG=True`, `CONN_MAX_AGE=600`.
2. Stopping only the owned backend removed every remote database client.
3. After restart, 20 template GET requests left exactly 20 idle connections from `172.29.0.3`, the owned backend address.
4. The fix uses `conn_max_age=0 if DEBUG else 600`. Non-debug behavior remains unchanged.
5. The targeted settings regression failed before the fix and passed afterward.
6. With the fix, 120 health requests and 120 template requests all returned 200. Remote client count was zero before and after. `max_connections` remained 100.
7. The complete browser suite passed after a fresh image build. The post-browser query also found zero remote idle connections.

Evidence: `e01s01-postgres-exhaustion.log`, `e01s01-connections-before-fix.log`, `e01s01-database-settings-red.log`, `e01s01-settings-green.log`, `e01s01-connections-after-fix.log`, and `e01s01-connections-after-browser.log`.

Installed Django is 6.1.1. Django 6.1 documentation states that persistent connections should be avoided with the development server's threading model: https://docs.djangoproject.com/en/6.1/ref/databases/#caveats . The local 20-request reproduction is the primary evidence.

An initial diagnostic shell launch exited 127 because zsh did not split a command string. It did not stop any service. The corrected shell function completed successfully. No unrelated containers, volumes, connection limits, compiler quotas, or security controls were changed.

## Self-audit and analyzer findings

- Source bytes remain authoritative. Ordinary edits retain previously verified structured mode. Raw/legacy documents do not gain authority from marker text alone.
- A persisted versioned baseline, checked-in formula IDs, intact topology, and intact wrappers are required before automatic removal. Structural additions outside owned blocks fail closed. This is a bounded section parser, not a general LaTeX parser.
- Confirmation is tied to current local revision and document signature. Source, selection, metadata, and recovery state change together. Cancellation changes none of them.
- Compiling raw/section-owned source does not normalize away user bytes. The UI identifies a PDF belonging to previous source.
- The source and baseline size limits, ownership filters, revision API, sidecar bounds, filesystem/network isolation, and compiler quotas remain enforced.
- Active probes of the new metadata helper, models, serializers, settings, removal hook, section planner, and creator report no unresolved LSP errors after exact adjudications. Informational style advisories remain. This is not a claim that every analyzer location is clean.
- `ANALYZER_BASELINE.md` records independently verified pre-existing Django descriptor inference errors. Exact false positives were dispositioned; no global rule was disabled. Cached replays of those same errors were explicitly approved for disregard by the supervisor.
- **Open baseline security advisory:** `backend/cheat_sheet/settings.py:161`, Semgrep `python.django.security.audit.django-rest-framework.missing-throttle-config.missing-throttle-config`. General DRF default throttling is absent. This unchanged finding is deferred, with supervisor approval, to e01s03's shared request-throttling task and independent review. It is not a false positive. Existing compiler-specific quotas do not imply all endpoints are throttled.
- The `globals()` advisory at settings line 208 is a false positive: the key comes only from the literal hard-maxima table, values are validated numbers, and the operation only compares limits. No dynamic code is executed.
- All 16 CI line-width advisories match unchanged baseline lines. No broad suppression or security exception was added.

## Resources and cleanup

`e01s01-runtime-final.json` records final image IDs/digests/sizes and runtime versions. Owned local disk usage:

- `backend/.venv`: 132320 KiB; Python 3.14.4, Django 6.1.1. Exact packages: `e01s01-python-freeze.txt`.
- `frontend/node_modules`: 270496 KiB; copied from the matching-lockfile sibling installation, not shared or mutated there. Node 24.15.0 / npm 11.12.1 on the host.
- `.pi/playwright-browsers`: 540268 KiB; Playwright 1.59.1; Chromium/headless shell 147.0.7727.15, revision 1217; FFmpeg revision 1011. Download URLs are in `e01s01-install-browser.log`.
- `backend/.compiler-assets`: 81680 KiB; copied from the verified existing asset installation. Asset verifier passed. Runtime Tectonic is 0.15.0, offline in the sidecar.

The browser cache was moved out of `frontend/` after ESLint correctly attempted to lint downloaded browser helper scripts. No lint rule was weakened. The cache ignores its own contents and is not a source artifact.

Only Compose project `texgen-e01s01-document-sections` is owned by this task. Loopback ports: database 55439, backend 58000, frontend 55173. It remains available for independent review. After review, the parent can remove only its containers/volumes with:

```sh
docker compose -p texgen-e01s01-document-sections \
  -f docker-compose.yml -f .pi/e01s01-compose-test.yaml down --volumes
```

Do not stage `.pi/`, installed environments, browser assets, compiler assets, or runtime logs. No shared Docker cache or unrelated resource was pruned.

## Remaining gate

Independent review is not run by this worker. The parent must review the complete source manifest, including the DEBUG-only connection fix and baseline security advisory, before marking task 5 or e01s01 passing. This report does not claim e01s02, e01s03, production deployment, or merge readiness is complete.
