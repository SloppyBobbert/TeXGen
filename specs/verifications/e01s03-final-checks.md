# Production candidate checks — local PASS, review pending

type: verification
context: e01-launch-readiness / e01s03

The published HEAD is still `114b4ca`. These results cover the uncommitted production candidate, not published CI. The review manifest will identify its source files.

## Round-2 candidate results

- `b38f7bbf4` completed with exit 0 after the verifier repairs: **472 backend tests passed, seven PostgreSQL-only skips, 96.91% coverage**; Ruff and migration drift passed; **244 frontend tests**, zero-warning lint and production build passed.
- The same run passed the revised no-download verifier: runtime restrictions, startup, proxy/socket checks, compiler and database outage/recovery, and **39 browser tests in 32.3 seconds**, one worker and zero retries. The live anonymous budget was restored from the disclosed test-only 600 to **60**. Private configuration snapshots were removed on exit.
- A separate final-source required-PostgreSQL run passed all **seven tests in 1.24 seconds**, without skips. `git diff --check` passed.
- `ba871899a` passed 13 focused verifier/runtime tests, Ruff and shell syntax checks. These cover pre-migration database rejection, partial cleanup failure, lost Docker creation responses, process-group termination, and budget/resource restoration after interruption.
- Application runtime source and image contents used by the server/compiler are unchanged by the repair; the changed files are host verification utilities and tests. The prepared image IDs below remain the runtime evidence. Fresh CI will build the final checkout separately.
- Self-review: rejected ambient settings precede all mutating Compose operations; validated private snapshots are reused during restoration; cleanup filters use a fresh per-run UUID label and attempt every matching resource. Original browser failure assertions remain in place. No new dependency or compiler limit change was made. Both independent reviews remain required; round 1 failed.

## Earlier candidate results

- `ba549dcc1`: 53 focused admission/adapter/configuration tests and Ruff passed. Backend image preparation succeeded. The controlled health overlap then produced both PDFs: health 1.046 seconds; overlapping production request 1.810 seconds. No retry was used.
- The same run passed `bash scripts/verify-production.sh`: startup/migrations/static collection, resource/network/filesystem restrictions, role/Host/identity checks, scheme/socket access, compiler outage without quota charge, recovered offline PDF, and strict two-worker PostgreSQL recovery. All **39 browser tests passed in 35.1 seconds**, one worker, zero retries. The test-only anonymous budget was 600; the exit handler restored the live value to 60 and checked it. This is not a default-budget full-suite pass.
- `b81e5c48e`: **462 backend tests passed; seven PostgreSQL-only tests skipped; 96.88% coverage**. Ruff and migration-drift checks passed. **244 frontend tests passed**, followed by zero-warning lint and production build.
- `b094f2698`: all seven PostgreSQL concurrency/quota tests passed without skips. A final-source rerun after the admission change also passed all seven in 1.29 seconds, using the same required-PostgreSQL command and no skips.
- CI YAML, its embedded Python, shell syntax and immutable action references were checked locally. The original eight deployment-contract assertions pass unchanged. A fresh GitHub run is still required. `act` and `actionlint` were not available; no local GitHub-runner emulation is claimed.

## Verified runtime images

- Backend/migration: `sha256:756a040f7052cdb04bdb73ab9ddb74d2532f5f1f48f2bcdba86849cb3c7a817d`.
- Frontend: `sha256:8061d71594c9e17e9b9b26ff8d19c021c4d146f4054c01569f53557d849b9b5c`.
- Compiler, unchanged: `sha256:194889db4ab16c7f868e2eaf0c7fe7a23e239c99ab5aa36cfdf39e1a39eb15a4`.

## Self-review before independent review

- Correctness: preserved raw-source authority, original quota ordering and all existing admission assertions. Added delayed-READY and persistent-connection recovery regressions.
- Security: production rejects DEBUG, weak/missing keys, wildcard hosts, SQLite and local compilation. Proxy headers are replaced; trusted sockets restrict access by ownership/mode. Database setup and application credentials are separate. SQL password interpolation uses psql literal quoting. Request identities use HMAC; database errors fail admission closed.
- Resources: no increase to compiler CPU, memory, swap, process, output, wall-time or restart limits. Only the separately approved production READY wait changed to five seconds. No request retry or test-timeout increase was added.
- Dependencies: approved manifests only; pip bootstrap hash checked; frontend lifecycle scripts disabled. Python constraints are version pins, not a complete artifact-hash lock. Existing installed-package audits reported zero findings; OS packages are outside that claim.
- Verification safety: prepared images only; no builds/pulls/installs in the verifier. Its injected-failure test verifies budget restoration and a failing exit status. Fault checks operate only on the recorded disposable project. No production data or public endpoints were used.
- Scope/clarity: existing rendering adapters already share their implementation, so no extra rendering refactor was made. Probe scripts use the standard library. Their sequential main functions are intentionally not split into speculative abstractions. No new general-purpose framework was added.
- Source hygiene: diff whitespace checks passed. `.pi/` now excludes local credentials, browser binaries and traces. Staging must still use an explicit file list; unrelated `e01s01-python-freeze.txt` is excluded.

No new must-fix issue was identified in this self-review. This is not independent acceptance, an OS vulnerability scan, public TLS verification, full WCAG compliance or production certification. The complete scope still needs both independent reviewers and fresh CI before handoff acceptance.
