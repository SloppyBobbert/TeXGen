# UI quality cycle verification

Date: 2026-10-14. Baseline: `82c5a1e9b0cd929ef69c7b136c3f2374b3a241ae`.
Scope: five confirmed UI fixes. No redesign, dependency update, authentication change, document-format change, merge, or deployment.

## Fixes and regression evidence

| Defect | Red commit | Fix commit | Result |
| --- | --- | --- | --- |
| Source export hidden without PDF | `321de53` | `23e7948` | Existing source-download action is available after first compile failure |
| Error claims a prior PDF exists | `f33a481` | `5971879` | Message distinguishes absent and retained PDFs |
| Unavailable history actions enabled | `4fda612` | `8b53d16` | Buttons use existing history availability flags |
| Panel resizing lacks keyboard support | `a5bcd19` | `4bb5cd9` | Arrow keys share pointer limits and persist each result |
| Dashboard has no load retry | `4d00f08` | `38fbc0b` | Retry runs a new GET with existing cancellation protection |

All five regressions failed before their fixes. Local red logs are retained under `.pi/`. No existing assertions, timeouts, retries, or security gates were weakened.

## Completed checks

- Baseline frontend: 323 tests passed.
- Final frontend: 335 tests passed; 19 files; no skips.
- ESLint: passed with zero warnings.
- Production frontend build: passed.
- npm audit at low threshold: zero known vulnerabilities.
- PostgreSQL backend: 681 tests passed, no skips, 97.40% coverage.
- Migration drift: none. Ruff, pip check, and pip audit passed.
- First full production browser run: 52 passed, one worker, zero retries.
- Final browser rerun after test-only corrections: 52 passed in 1.3 minutes, one worker, zero retries.
- Diff whitespace: passed.

The first full frontend run passed all tests but lint rejected four unqualified browser globals in new tests. Qualifying them fixed lint; no rule was disabled. The source-download browser test now compares raw bytes with Buffer.concat to avoid split UTF-8 decoding.

LSP found inherited unused React/deprecated frameBorder hints and two inconclusive results. Inconclusive results are not counted as clean checks.

## Browser and visual inspection

A separate production stack used new databases, generated test credentials, and loopback-only ports. Only its frontend was rebuilt after the fixes. The backend source did not change. No existing service was restarted.

Before/after screenshots are retained under `.pi/`. Manual checks confirmed:

- Subject-panel width changes from 280 to 300 pixels after ArrowRight.
- Back and Forward are disabled on a fresh sheet.
- A controlled initial compile failure retains the source-download control and reports no PDF.
- Dashboard Retry recovers from a controlled GET 503 without losing the signed-in session.
- Initial editor has no horizontal page overflow at 320, 390, 768, or 1440 pixels.
- All nine themes have no page overflow in the inspected 390-pixel failure state.

New browser cases cover desktop/mobile source export byte fidelity, history, Dashboard keyboard retry, all three keyboard resize controls, pointer resizing, and theme layout smoke checks. Mobile means browser viewports, not physical devices.

## Review and pending gates

Independent review `d86c48724a57ee98a101f5f472a416655` approved with no blocking findings. Its download-byte suggestion was applied. Final review `d13b2e4e6ad75329639896aa2f35e71a1` read the complete baseline diff, including the browser tests, and approved with no blockers. Both completed normally. Reviews are static inspection, not independent test execution; skipped or quota-limited reviews are not counted.

Owned-stack cleanup passed. An independent Docker label inventory found no containers, volumes, or networks for `texgen-ui-audit-337e999f3e`. Both inspection browser sessions were closed. Existing resources were left unchanged.

PR #17 was published. CI run `38638990809` passed backend, frontend, and browser-e2e on `b15f37d9fb08149270a9af988811ac17e88494c2`.

CodeRabbit completed its review and requested one intermediate resize assertion. The browser test now asserts 280 pixels after ArrowLeft, before checking that pointer drag restores 300 pixels. This prevents two failed actions from hiding each other. Production code is unchanged. A new exact-head CI run must verify this assertion. Copilot could not review because of its quota limit and is not counted.

Two static analyzer warnings in the review context were checked: the test password belongs only to newly created disposable accounts; `nextLayout` contains the calculated changed width, not the unchanged state value. Neither needs a production change. CodeRabbit skipped fetching CI context, so CI results were checked directly through GitHub.

## Known follow-up

The existing compile-error text has low contrast in Light and Blossom themes. It is the sixth finding and is deferred under the approved five-fix limit. See `specs/bugs/BUG-compile-error-contrast.md`. Theme smoke checks are not full accessibility certification. The historical mobile sign-in timeout remains unexplained.

## Local run references

- Baseline: `b08043747`.
- First frontend/lint result: `bb8801701`.
- Final frontend: `b3ec3264e`.
- Backend/PostgreSQL/audits: `b61514712`.
- Owned frontend rebuild: `b4dd0b723`.
- First browser suite: `ba0ac660d`.
- Final browser suite: `bd34658c5`.

Logs remain in the root `.pi/tasks/` session directory. Do not publish private environment files or authentication traces.
