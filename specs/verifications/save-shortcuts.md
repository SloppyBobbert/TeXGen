# Save-shortcut verification

Date: 2026-10-14.
Baseline: `6fb1f0c89c8e65366c2ecbc561189c723e135876`.
Red regression commit: `e31b066`.
Implementation commit: `69b20c1`.

## Confirmed defect and fix

Separate Ctrl+S or Command+S presses submitted twice while the first save was pending. Both regression cases failed with two calls instead of one. The fix guards the shared save handler with the parent saving state and a synchronous ref. The ref is released after success or failure. Both Save buttons and keyboard shortcuts use this handler.

No API, document format, authentication, dependency, timeout, or retry changes were made. This does not explain or fix the historical mobile sign-in timeout.

## Completed checks

| Check | Result |
| --- | --- |
| Baseline frontend, one worker | 319 passed |
| Focused editor/App checks | 66 passed |
| Full frontend, one worker | 323 passed, no skips |
| ESLint | Passed, zero warnings |
| Frontend production build | Passed |
| npm audit, low threshold | Zero known vulnerabilities |
| PostgreSQL backend | 681 passed, no skips; 97.40% coverage |
| Migration drift | None |
| Ruff | Passed |
| pip check | No broken requirements |
| pip audit | Zero known vulnerabilities |
| Diff whitespace | Passed |
| Independent source review | Approved; no blocking findings |
| Rebuilt production browser suite | 47 passed; one worker, zero retries |

The first frontend baseline run used default concurrency. It had one test timeout and four worker-startup timeouts. The unchanged suite passed with one worker. Timeouts, retries, and assertions were not changed.

LSP reported existing unused React and deprecated frameBorder hints. Its browser-file result was inconclusive; it is not counted as a clean check.

## Independent review

Review task: `dba6f2a1bd438d26abda64343f8cd747e`. The reviewer read the save handler, callers, tests, and connected App reconciliation. It found no blocking defect or accessibility regression. It suggested optional shortcut-first/button-second component coverage. Both buttons already use the same guarded handler; no additional production change was requested.

Final follow-up review `d4e189c2b0b1b553e99d3a784deaf90c4` approved the corrected browser setup and scope documents with no blocking findings. The promise gate holds a real create response, not the server write. Later POST-count and Dashboard assertions check for duplicate sheets.

Both reviews were read-only and did not run checks. They are not a substitute for runtime evidence. Both completed normally; no skipped or quota-limited review is counted. The mobile case uses a narrow browser viewport and a synthetic Command+S event, not a physical mobile device.

## Pending gates

- PR publication and exact-head CI.

First browser run: 45 existing cases passed; both new cases failed before saving because an empty sheet has no editor-toggle button. Test setup now generates a sheet and selects raw source before editing. The full rerun passed all 47 cases in 56 seconds. No timeout or retry change.

The final browser run used newly built production images in disposable project `texgen-quality-0fa877df56`. It used one worker and zero retries. Authentication traces were off. Cleanup removed only the owned containers, volumes, and networks.

## Local evidence

Background logs retained under the root `.pi/tasks/` session directory:

- `b69577dc7`: initial worker failures.
- `b0ab8cf81`: serial baseline.
- `b9846dc30`: red save-shortcut regressions.
- `bbc4f2cce`: focused green tests and lint.
- `bc437401f`: full frontend, build, and audit.
- `bfcf88fb5`: PostgreSQL, migration, lint, and dependency checks.
- `b11370ed7`: first rebuilt browser run; new-case setup failures.
- `b2bd9115c`: corrected setup, lint, and rebuilt browser rerun.

The disposable PostgreSQL container was removed. Other databases, services, worktrees, credentials, and dependencies were left unchanged. No merge or deployment was performed.
