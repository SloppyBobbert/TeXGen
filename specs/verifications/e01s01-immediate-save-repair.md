# Immediate-save recovery repair

## Authority and scope

The owner approved direct parent implementation after two subagent resume attempts failed during startup confirmation. Both failed before changing source. The existing worktree and branch remain in use; no alternate agent CLI was launched.

Repair scope: `frontend/src/hooks/latex.js`, its hook tests, and `frontend/src/App.test.jsx`. The previous snapshot-metadata repair remains unchanged.

## Cause and correction

Recovery history previously reached storage only after a 500 ms timer. App could save the destructive source earlier, then unmount canceled the pending history write.

The hook now writes the destination source, recovery entries, and cursor in one synchronous storage operation before applying a removal, raw-mode transition, regeneration, or history restoration. A failed write leaves the current source and selection unchanged and displays a recovery warning. Generation restores prior metadata if recovery persistence fails. Successful history writes cancel obsolete pending draft writes.

The ordinary edit debounce remains 500 ms. No delay was shortened, no test wait was added, and no storage error is treated as success.

## Regression evidence

- RED: `npm test -- --run src/App.test.jsx -t 'immediate.*before debounce'` exited 1. Both immediate Save and compile-autosave cases lost history after unmount. Background receipt: `ba8138e7c`.
- Focused GREEN: `npm test -- --run src/hooks/latex.test.jsx src/App.test.jsx && npm run lint` exited 0. All 75 tests passed, with no skips; ESLint passed. Background receipt: `bc60c3299`.
- Tests stop the timer clock before removal, save immediately, and unmount without advancing debounce. Reload then Back must restore exact source, selections, mode, and metadata.
- Hook tests cover immediate persistence and cursor retention across removal, raw mode, generation, and preview regeneration. They also cover storage failure in each path.
- Active LSP checks of all three changed files returned no diagnostics but could not confirm clean push-only server results. ESLint and runtime tests provide the confirmed checks; no LSP clean claim is made.

## Final checks and review

- `npm test -- --run && npm run lint && npm run build` passed: 197 tests in 14 files, no skips; lint and build passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:55173 PLAYWRIGHT_BROWSERS_PATH="$PWD/../.pi/playwright-browsers" npm run test:e2e -- e2e/real-stack.spec.js --workers=1 --reporter=line` passed: three real Chromium/PostgreSQL/compiler journeys, no skips.
- Combined terminal receipt: `b41370000`, exit 0. Log: `e01s01-immediate-full.log`. RED and focused logs are saved beside it.
- Independent reviews A and B both passed, with no must-fix or should-fix findings. Reports: `recovery-review-a.md`, `recovery-review-b.md`. Both gave a score of 100. Neither report claims to have rerun the full suite; the parent verified its separate terminal receipt.
- `e01s01-final-recovery-manifest.json` records all 30 source files. Only the three repair files differ from the prior reviewed manifest. All backend/configuration hashes are unchanged, so the recorded 422 backend passes, five separate PostgreSQL passes, and 96.71% coverage remain applicable to the same backend source; they were not rerun for this frontend-only repair.

Parent decision: e01s01 passes its implementation and review gates. The two optional test improvements (distinct failed-generation metadata and failed history navigation writes) will be added with the e01s02 state-transition tests. Production throttling remains an open e01s03 requirement. No merge is authorized.

## Self-review

- PASS: the destructive paths write recovery before source/selection mutation; history restoration persists its cursor before publication.
- PASS: no new dependency, API permission, compiler, quota, or credential change.
- PASS: new failure paths preserve source and do not submit a compile after failed recovery storage.
- PASS: regression tests exercise the real App/creator path and public hook actions; fake timers expose rather than hide the race.
- PASS: no lint suppression or broad type rewrite.
- Existing editor size and repeated layout fields remain planned e01s02 cleanup, not reasons to enlarge this repair.

The self-review covers this repair, not all later editor or production stories. Independent review must challenge the immediate-save and storage-failure behavior rather than rely on the summary above.
