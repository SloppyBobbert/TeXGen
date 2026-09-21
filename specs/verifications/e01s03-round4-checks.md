# Production candidate — round 4 verification

## Local PASS; independent acceptance and fresh CI pending

`b521f1ad8` completed with exit 0:

- 478 backend tests passed; seven PostgreSQL-only skips in SQLite; 96.88% coverage.
- All seven required PostgreSQL tests passed separately in 1.23 seconds, without skips.
- Ruff and migration-drift checks passed.
- 244 frontend tests, zero-warning lint and production build passed.
- The complete no-download verifier passed startup, static collection, migration, role/Host/identity, proxy/socket, compiler isolation and resource checks, and database/compiler outage recovery.
- All 39 browser tests passed in 31.3 seconds, one worker, zero retries.
- The live anonymous budget was restored from the disclosed test-only 600 to 60. This is not a default-budget full-suite pass.
- Diff whitespace checks passed.

## Round-3 finding and repair

Workflow `aafce04e-ac05-4258-9846-e41e0e67e6ff`: both reviewers scored 95%. A marked the preflight cancellation gap should-fix; B marked it must-fix. The combined gate failed. Both reports were read after both children completed.

`ba0bbe384` reproduced the gap before the repair. Signalling only the outer verifier during fake image inspection left the supervisor/descendant active beyond the unchanged 12-second test bound. Test teardown removed the local test processes; no real Docker resource was involved.

The repair installs a non-mutating EXIT/INT/TERM handler before configuration preparation and all supervised preflight commands. It stops and waits for the active supervisor and removes private files. The mutating restoration handler replaces it only after configuration validation and image checks succeed. Both handlers use the same child-stop function. Preparation and run-ID generation now use the supervised path too.

`b633687dd` passed all 19 focused tests in 22.20 seconds, Ruff and shell syntax checks. Outer-PID cancellation cases cover preparation, quiet configuration validation, image-list capture, image inspection, later port capture, and browser execution. Preflight cases additionally require no mutating Docker command. All retain the 12-second cancellation bound.

Self-review: supervised stages now have a process-cleanup handler from their first invocation. Invalid configuration cannot trigger stack restoration. The application, dependencies, compiler image, quotas, runtime deadlines and browser assertions are unchanged by this repair. No additional must-fix issue was identified in self-review; independent acceptance remains required.

## Identity and limits

Round-4 identity is in `e01s03-review-round4-manifest.json`. Prepared runtime image IDs remain those in `e01s03-final-checks.md`; only host verification utilities and tests changed after the runtime images were prepared. Fresh CI will build the final checkout separately.

Three of the maximum five independent review rounds have completed; each failed the combined gate. No merge, public deployment, TLS, WCAG/load/OS-scan certification or final release acceptance is claimed.
