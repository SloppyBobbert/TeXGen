---
bug_id: BUG-editor-recovery
type: bug-plan
context: Approved expanded site audit F1–F5 at ea0eae3
status: reviewed
severity: high
scope: frontend
---

# Bounded plan: F1–F5

## Current acceptance

All requested fixes and subsequent migration/Clear repairs passed two independent reviews, each scoring 95/100 with no must-fix findings. Fresh pre-PR verification passed 280 frontend tests, lint/build, 636 backend tests with seven PostgreSQL skips, Ruff, and all 39 browser tests with zero retries. The disposable API limit was restored to 60. The owner authorized a PR, not merge or deployment. The earlier mobile login timeout remains unexplained. The sections below retain historical execution and review evidence; older pending-review statements are superseded by this status.

App owns the live editor session, but canonical storage is only updated at save/transition. Formula and source hooks independently hydrate older storage over this session. Dashboard unconditionally replaces local recovery. App resolves a failed local save, and panel/Clear storage writes can throw through React.

1. Add real App + editor regressions (mock network/PDF only) for selection navigation/reload and sub-debounce source navigation. Preserve canonical IDs, explicit empty selections, legacy migration, New/Clear and identity isolation.
2. Keep shared session authoritative on route remount; persist its canonical document on changes. Do not invert canonical/legacy priority. Retain standalone hook compatibility and history.
3. Track the last acknowledged remote document to distinguish unsynced recovery from a clean cache. Dashboard restores only unsynced recovery; successful remote reconciliation updates the baseline without hiding in-flight edits.
4. Reject failed save durability, including compilation autosave, and guard optional layout and Clear/remove persistence. Keep UI and in-memory edits usable on failures.
5. Run each regression red then green, full frontend tests/lint/build, and frontend self-review. Parent handles independent review/browser verification/publishing.

No backend edits, installs, remote probes, compiler changes, keyboard-save concurrency changes, or worktree cleanup. Existing node_modules symlink retained. No commits required; red evidence is retained in test outputs.

## Review repair plan

Both independent reviews confirm two must-fixes: unresolved name-only legacy migration without an envelope, and the durable-order browser assertion's obsolete sidecar shape. Reuse the existing explicit recovery choice for failed migration; retain sidecars until choice and verify both empty and name-only current selections, catalog resolution, and reload. Change the browser durability assertion to exact canonical formula-ID ordering and retain exact UI reload ordering. Run regression red/green, frontend tests/lint/build, browser gate and backend checks without protocol changes. No backend implementation changes or concurrency/policy expansion.

## Review repair evidence

- Both must-fixes accepted; no review blocker rejected. No-envelope migration reuses the existing explicit recovery choice instead of writing stale current-sheet content. Name-only sidecars remain byte-identical before choice, including across remount; choosing recovery resolves catalog IDs and retains source/selection after reload.
- `.pi/review-repair-red.log`: corrected parameterized regression fails twice on overwritten sidecars without the migration guard. `.pi/review-repair-green.log`: 16 recovery tests pass. `.pi/review-repair-frontend-tests.log`: 272 tests / 19 files pass; lint/build logs pass.
- Obsolete grouped-sidecar browser assertion replaced with exact ordered canonical formula IDs for the active identity. Exact post-reload UI class/formula ordering remains unchanged. Previous parent run supplies browser red evidence (38/39); approved unchanged harness now passes all 39 tests in `.pi/review-repair-browser.log` and confirms anonymous budget restored to 60.
- Backend unchanged in this repair: SQLite-memory full suite 636 passed / 7 PostgreSQL skips; Ruff passes (`.pi/review-repair-backend-tests.log`, `.pi/review-repair-ruff.log`).
- Self-review: correctness, security, scope, and clarity pass; no dependencies/auth/API changes. Existing large modules not refactored. Noncurrent Dashboard undo-history coverage suggestion remains a coverage limitation, not a demonstrated regression: marked-envelope early return and compile-history/undo-history distinction are unchanged in this repair. Save overlap/account policy and compiler concerns remain explicitly out of scope. Fresh independent review remains parent-owned.

## Clear review repair

- Confirmed Clear now removes recovery for only the active identity and its saved-sheet alias. A small identity field retains the local-draft link when Dashboard restores the server alias. Create New still keeps the previous recovery.
- App owns managed Clear before the editor changes state. A failed removal, including failure after one alias was removed, leaves the live edits usable and warns that recovery can remain. Clear removes the current-sheet pointer before it creates the empty draft; a failed empty-draft write produces a separate warning. No saved server document is deleted.
- `.pi/clear-red.log`: both saved-sheet and first-created-sheet regressions fail with `DISCARD UNSYNCED` instead of `SERVER COPY`. `.pi/clear-green.log`: all 21 real App/editor recovery tests pass. Coverage includes confirmation cancel, local/server aliases after a Dashboard remount, Dashboard/reload after Clear, unrelated keys, removal failures, failed empty-draft writes, and the existing nondestructive New cases.
- Initial full run found one obsolete mocked-editor expectation that Clear always called both hooks before App. The updated parameterized test checks App-owned Clear and the standalone hook fallback. `.pi/clear-frontend-tests.log`: 278 tests / 19 files pass. `.pi/clear-lint.log` and `.pi/clear-build.log`: pass. Backend checks pass: 636 tests, 7 PostgreSQL skips, and Ruff. The first browser gate is not green: 38/39 pass; mobile third login times out before Dashboard (`.pi/clear-browser.log`). The harness restores the anonymous budget to 60. A targeted private diagnostic passes with three successful token responses; this does not establish the cause of the original failure. A full private diagnostic is invalid because its dialog observer conflicts with existing handlers. See the final handoff for verification limits.
- Self-review: no new dependency, backend change, remote deletion, broad draft-key scan, or unrelated cleanup. Partial browser-storage deletion is not atomic; the warning does not claim that all recovery was removed. Independent acceptance review is still required.

## Numeric saved-sheet sidecar repair (shared M1)

- Complete alias matrix reviewed: active/recovery identity and `sheet-42` cleanup is retained; Clear additionally checks the exact existing helper-derived numeric compile-history/content-source keys. No storage scan, remote deletion, or unrelated-key cleanup.
- `.pi/numeric-history-repair/red.log`: five expected failures (three real compiled browser-only snapshot identities and two numeric-key removal failures). `.pi/numeric-history-repair/green.log`: 23 recovery tests pass. Tests retain cancel/New recovery, unrelated numeric/draft keys, usable edits on removal failure, and no discarded snapshots after Dashboard/reload.
- Fresh frontend verification: 280 tests / 19 files, lint and build pass (`.pi/numeric-history-repair/{tests,lint,build}.log`). Backend source untouched by this repair; previous 636 passed / seven PostgreSQL skips are historical, not rerun.
- Exactly one fresh ordinary approved harness after build passed 39/39 (`.pi/numeric-history-repair/browser.log`), owned disposable project only, budget 600, one worker / zero retries; restoration to 60 confirmed. Historical browser limits remain: ordinary 38/39 mobile login timeout unexplained; active-observer 36/39 invalid; corrected passive 39/39 passed but does not explain the original failure. Independent acceptance review remains required.

## Execution and self-review

- F1/F5: `.pi/editor-red-navigation.log` failed both real navigation assertions; `.pi/editor-green-navigation.log` passed both.
- F2: `.pi/editor-red-dashboard.log` reproduced stale server overwrite; `.pi/editor-green-dashboard.log` passed dirty recovery and clean refresh. `.pi/editor-red-new.log` additionally reproduced New discarding the previous recovery; the final suite passes New and new-local-to-server identity recovery.
- F3: `.pi/editor-red-save.log` failed both manual and compile false-success assertions; `.pi/editor-green-save.log` passed both after the parent rejects persistence failure.
- F4: `.pi/editor-red-storage.log` reproduced first-action render failure and interrupted Clear; `.pi/editor-green-storage.log` passed both.
- Upgrade safety: old canonical/sidecar writes have no freshness metadata. Conflicting copies remain stored until an explicit user choice; marked single-owner snapshots retain canonical precedence. `.pi/editor-red-upgrade-choice.log` and `.pi/editor-red-pending-recovery.log` reproduced overwritten recovery; the final suite covers restore/keep choices, canonical clears, clean copies, stale marked sidecars, pending-history writes and repeat hydration.
- Section metadata: initial full run `.pi/editor-full-tests.log` failed three existing real-App edited-removal regressions because legacy migration omitted `generatedSections`, previously hidden by hook rehydration. The one-line metadata preservation makes those tests pass without weakening their assertions.
- Final verification: `.pi/editor-full-tests-final.log`: **270 passed / 19 files**, no skips/errors. `.pi/editor-lint-final.log` and `.pi/editor-build-final.log`: passed.
- Self-review: PASS correctness (all changed callers traced), security (no API/auth/dependency changes or secret values; recovery preview renders text), scope, regression coverage, and clarity. Existing large modules were not refactored. No new dependencies. Immediate synchronous canonical persistence trades write cost for eliminating the navigation-loss window; large-document performance is not benchmarked.
- Parent still owns browser verification and independent acceptance review. Pre-fix remote caches without a sync baseline require an explicit choice when they differ; the application cannot prove which is newer. No source recovery can survive total storage failure plus closing the tab unless the user saves a copy elsewhere.
