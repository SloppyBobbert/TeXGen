# Production candidate — round 3 verification

## Local checks: PASS; independent review and fresh CI pending

`baddd4e89` completed with exit 0:

- 474 backend tests passed; seven PostgreSQL-only tests skipped in the SQLite run; coverage 96.88%.
- All seven required PostgreSQL tests passed separately in 1.19 seconds, without skips.
- Ruff and migration-drift checks passed.
- 244 frontend tests, zero-warning lint and production build passed.
- The revised no-download verifier passed startup, migration/static collection, role/Host/proxy/socket checks, runtime restrictions and compiler/database outage recovery.
- All 39 browser tests passed in 31.7 seconds, with one worker and zero retries.
- The disclosed test-only anonymous budget was 600. Exit restoration checked the live value was back to 60. This is not a default-budget full-suite pass.
- `git diff --check` passed.

## Round-2 repair and self-review

Both round-2 reviewers independently identified the same outer-shell cancellation defect. They each scored 95% but rejected the candidate because this was a must-fix finding.

`b46fa70ca` reproduced the defect before the repair: the new regression signalled only the outer verifier PID during the fake browser stage, and termination exceeded its 12-second deadline. Test teardown removed the owned Python processes. No real Docker resources were used.

The repair keeps supervised calls in the outer shell. Captured command output goes to a file in the existing private snapshot directory. The browser's directory change happens inside the supervised command, not around the shell function. Thus the restoration handler can read the active supervisor PID for both paths.

`ba0cc1fa2` passed all 15 focused tests in 11.73 seconds, Ruff and shell syntax checks. The outer-shell regression now covers both browser execution and a captured Docker lookup after the budget rises to 600. Both require descendant termination, a failing exit status, snapshot removal and restoration to 60. The regression deadline was not increased.

Self-review found no additional must-fix issue: all long-running `run` calls now execute in the outer shell, and the previous external-database and resource-cleanup regressions still pass. The repair changes host verification and tests only. It does not change application behavior, dependencies, compiler images, runtime limits, retries or existing browser assertions. This self-review is not independent acceptance.

## Scope limits

Prepared runtime image identities remain those recorded in `e01s03-final-checks.md`; server/compiler application source is unchanged by these host-verifier repairs. CI will build the final checkout separately. No dependency acquisition was part of this verification.

No public deployment, merge, public TLS, OS vulnerability scan, full WCAG compliance or production certification is claimed. Two of the maximum five independent review rounds have completed; both failed. The next round is round 3.
