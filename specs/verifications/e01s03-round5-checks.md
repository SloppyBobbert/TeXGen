# Follow-up candidate — round 5 verification

The owner selected "Fix follow-ups" after the verified round-4 handoff. No merge or deployment was authorized.

## Changes

- Stack and frontend-image HTTP probes use explicit proxy-disabled openers.
- The outage probe derives its fixture name from the verification run ID before creation. Creation is inside cleanup protection. SIGTERM/SIGINT trigger its normal recovery path.
- Outer recovery deletes only the exact run-ID account with an unusable password, after dependency recovery. This also handles cancellation or a lost creation response. Other accounts are not selected.

## Local verification: PASS

`b495c6840`: 23 focused tests passed in 17.66 seconds; Ruff and shell syntax passed. New tests exercise proxy handling without network requests, outer recovery after an interrupted outage probe, actual Django account/quota deletion, preservation of unrelated and usable-password accounts, and cleanup after a lost creation response. Docker is mocked in these focused tests.

`b64eda8da` completed with exit 0:

- 482 backend tests passed; seven PostgreSQL-only skips in SQLite; 96.93% coverage.
- All seven required PostgreSQL cases passed separately in 1.19 seconds, without skips.
- Ruff and migration drift passed.
- 244 frontend tests, zero-warning lint and production build passed.
- Complete no-download runtime verification passed, including restrictions, startup/static/migration, proxy/socket, role, compiler and database outage/recovery checks.
- All 39 browser tests passed in 31.2 seconds, one worker and zero retries.
- Exact outage fixture cleanup passed; live anonymous budget returned from test-only 600 to 60. This is not a default-budget full-suite pass.
- Diff whitespace check passed.

Self-review: the change selects one validated run UUID, not a prefix-wide user deletion. Cleanup runs after restoration and preserves failure status. Both opener objects explicitly disable proxy discovery; request deadlines are unchanged. No dependency, runtime application behavior, compiler image or isolation limit changed. Prepared runtime images remain those recorded earlier; CI must build and test the newly published checkout.

## Gates and limits

The prior round-4 acceptance applies to the previous source, not this changed candidate. The next review is round 5 of the maximum five. Both independent reviewers must reach at least 94% with zero must-fix findings. If this round fails, stop for an owner decision; do not start a sixth round.

Fresh CI remains required after publication. No public deployment, merge, TLS/WCAG/load/OS-scan certification is claimed.
