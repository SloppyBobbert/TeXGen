# e01s01 history repair

Both review findings were valid and are fixed. Task 5 and the story remain open for the parent's independent recheck.

## Changes

- P1: `App.jsx` now reads the identity-scoped LaTeX recovery history before each save and preserves its entries and cursor. This shared save path covers local saves, compile autosave, and server reconciliation. Storage read or JSON errors fail the save without replacing that record.
- P2: Compile-history restore now uses the snapshot's section baseline. A snapshot without metadata restores source as manual (or empty), not with the current document's authority.
- `App.test.jsx` adds four cases: edited removal → save → reload → Back; edited removal → compile autosave → reload → Back; snapshot restore with metadata; and legacy snapshot restore without metadata. The recovery cases check exact source, mode, metadata, and selection. The structured snapshot case also checks that removal is safe.
- No dependency, compiler, API, database, quota, ownership, or isolation code changed.

## Identity

- Worktree: `/Users/brandontran/TeXGen/.slim/worktrees/document-sections`.
- Branch: `fix/document-sections`.
- HEAD: `65a4938f11bd3b3817e3ba98b2b5e8fe1afa9783`.
- Tracked diff SHA-256: `d20758ee28ccec500fce5220b52e2ee7bb6c16830aff5e4baef0bbd628d8f78b`.
- `e01s01-repair-manifest.json` records all 30 source hashes. Compared with the review manifest, only `frontend/src/App.jsx` and `frontend/src/App.test.jsx` changed. Evidence and plan files are outside this source manifest.
- Nothing staged, committed, pushed, published, or merged.

## Checks

Commands run from this worktree. Node 24.15.0 and npm 11.12.1 use the existing local dependency installation. No installation or download was needed.

| Exact command | Exit | Result | Log |
| --- | --- | --- | --- |
| `cd frontend && npm test -- --run src/App.test.jsx` (before fix) | 1 | 4 new cases failed; 26 passed | `e01s01-repair-red.log` |
| `cd frontend && npm test -- --run src/App.test.jsx` (after fix) | 0 | 30 passed; no skips | `e01s01-repair-focused.log` |
| `cd frontend && (npm test -- --run && npm run lint && npm run build)` | 0 | Final 189 tests in 14 files passed; no skips; lint and build passed | `e01s01-repair-frontend.log` |
| `cd frontend && PLAYWRIGHT_BASE_URL=http://127.0.0.1:55173 PLAYWRIGHT_BROWSERS_PATH="$PWD/../.pi/playwright-browsers" npm run test:e2e -- e2e/real-stack.spec.js --workers=1 --reporter=line` | 0 | 3 Chromium tests passed; no skips; real backend, PostgreSQL, and compiler | `e01s01-repair-browser.log` |
| `git diff --check` | 0 | No whitespace errors | terminal |

The browser suite used the existing owned Compose project `texgen-e01s01-document-sections`. Its frontend bind mount served the repaired App source. The final test-only refinement added a direct safe-removal assertion; the complete frontend gates were rerun after that refinement.

Backend coverage and PostgreSQL unit tests were not rerun: all backend and configuration hashes match the independent review manifest. Their prior results remain in `e01s01-task5.md` (422 backend passes, 96.71% coverage, five PostgreSQL passes). They are not represented as new checks. The three real-stack tests were rerun for this repair.

Background terminal receipts: red `ba9c80b29` exit 1; focused `bfc35b19c` exit 0; final frontend `b8673759f` exit 0; browser `b6ff68ac2` exit 0. Receipt files are under `.pi/tasks/session-89101-89101/`. Child `bg_wait` could not find a `bg_run` ID. The supervisor authorized one status inspection at each dependency barrier. No polling loop or alternate agent method was used.

## Remaining work and resources

The parent must recheck these two repairs before closing task 5. The baseline DRF throttling advisory remains deferred to e01s03. This repair does not claim production or merge readiness.

No new service was created. Existing task-owned Compose resources remain running for the parent. Browser fixture ownership and cleanup are unchanged from `e01s01-task5.md`. No unrelated worktree, shared dependency directory, credential, or user data was changed.
