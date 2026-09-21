# Independent production/security review — round 5

**Verdict: PASS**
**Score: 100% — 20 passed, 0 failed checklist items.**
**Findings: 0 must-fix, 0 should-fix, 0 consider.**

This is source-review acceptance, not authorization to merge or deploy. Fresh CI on the published candidate remains required.

## Identity and integrity

- Worktree: `/Users/brandontran/TeXGen/.slim/worktrees/document-sections`
- Branch: `fix/document-sections`
- HEAD/follow-up base: `e3c0fcd4fee80cc4a4d574243efd021761573974`
- Cumulative baseline: `114b4ca7c02a19952fb454a13db91f5d5e743139`
- All **36 manifest file hashes matched**, both at initial inspection and final verification.
- Recomputed SHA-256 of the sorted, compact JSON file/hash mapping:
  `b2830fb5e12a722808022db000da2b5a9ff51af901d4754485218db3fdd0d7a8`
- Cumulative patch SHA-256:
  `eda542f1955a80768494c2277277c5a48007c4ef5c776c1240eea2029ca8ecb3`
- No staged files were present.
- No files were edited. No tests, containers, installations, network requests or delegates were run. No reviewer reports, credentials or traces were read.

## Explicit checklist

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Frozen candidate identity and scope | PASS | All 36 hashes and aggregate match. Follow-up changes are confined to the requested host-verifier repairs and tests. |
| 2 | Separate development and production targets | PASS | Backend production uses Gunicorn; frontend production uses Nginx. Existing development targets remain available. |
| 3 | Production configuration fails closed | PASS | Production rejects debug mode, SQLite, weak keys, wildcard hosts and local compiler execution. Local HTTP is restricted to loopback host configuration. |
| 4 | Private server socket and proxy trust | PASS | Gunicorn binds only the Unix socket. Nginx replaces client forwarding headers. Django does not independently trust raw scheme headers. |
| 5 | Static serving and browser assets | PASS | SPA fallback, immutable asset caching, `.mjs` MIME handling, missing-asset rejection and hidden-file denial have explicit configuration and probe assertions. |
| 6 | Restricted database role and migration sequence | PASS | Bootstrap creates a non-superuser application role without database/role creation privileges. Backend startup depends on completed migrations. |
| 7 | Shared request-throttle correctness | PASS | PostgreSQL row locking serializes admissions. Database failures fail closed; rollover and clock reversal are handled. Cleanup rechecks expiry. |
| 8 | Throttle integration and liveness separation | PASS | Default API throttling and compile-specific shared admission are wired correctly. Health remains exempt. Accepted-compile quota remains separate. |
| 9 | Ownership and manual source authority | PASS | User-filtered document queries, restricted practice-problem relations and template write permissions remain intact. Raw rendering and normalization preserve source authority. |
| 10 | Compiler admission and charging order | PASS | READY precedes quota admission; START follows it. Cancellation closes the connection without execution. Accepted failures remain charged. |
| 11 | Compiler isolation | PASS | Compiler retains no network, read-only root, constrained writable work area, dropped capabilities, process/resource bounds and bounded restarts. |
| 12 | Deadline scope | PASS | Approved READY wait is 5 seconds. Connect remains 1 second, compile 15 seconds and Gunicorn worker timeout 30 seconds. No follow-up deadline enlargement. |
| 13 | Dependency scope and reproducibility claims | PASS | Gunicorn 26.2.0, hashed backend pip 26.2 bootstrap and pinned Nginx are present. Python constraints correctly disclose that they are not artifact hashes. |
| 14 | Frontend dependency candidate | PASS | Structured comparison found exactly 41 changed lock entries, one addition (`@humanfs/types`), no removals and unchanged root declarations. Changed versions retain their major versions. Registry artifacts have integrity fields. |
| 15 | CI gates and permissions | PASS | CI has read-only repository permission, pinned actions, backend coverage enforcement, explicit PostgreSQL concurrency execution, frontend checks and production/browser verification. Fresh candidate CI is explicitly pending. |
| 16 | Unconditional Save assertions and replay safety | PASS | Save assertions no longer depend on optional visibility or swallowed failures. API client replay remains restricted to GET/HEAD after eligible authentication refresh. |
| 17 | Verification isolation before mutation | PASS | Preparation rejects ambient Compose substitutions and non-owned database URLs before startup or restoration is enabled. Resolved snapshots use private permissions. |
| 18 | Bounded no-download execution and process cleanup | PASS | Verifier uses prepared images, `--no-build`, `--pull never`, bounded subprocesses and process-group termination. Outer-shell PID tracking covers captured commands; preflight cancellation has an early cleanup trap. |
| 19 | Ambient HTTP proxy protection | PASS | Stack and frontend-image probes now use explicit empty `ProxyHandler` configuration. Other HTTP probes already do so. Focused tests intercept before network connection and verify direct loopback addressing. |
| 20 | Outage recovery and fixture ownership | PASS | Run UUID is established before creation; creation is protected by cleanup. Recovery restores dependencies before deleting only the exact run account with an unusable password. Failure status is retained; unrelated accounts and application volumes are preserved. |

Score calculation: `100 × (20 − 0) / 20 = 100%`.

## Follow-up review

The proxy change fixes the shared request-opening point rather than individual requests. It retains existing request deadlines and the stack probe’s redirect rejection.

The outage repair removes reliance on a successful creation response. The deterministic run account name is available to both inner and outer cleanup. UUID validation, exact username matching and the unusable-password predicate materially narrow deletion ownership.

The tests cover:
- Proxy handling without making network requests.
- Interrupted outage-probe recovery and restoration-before-deletion ordering.
- Execution of the actual Django deletion payload.
- Cascading removal of the fixture’s compile quota.
- Preservation of unrelated accounts and an exact-name account with a usable password.
- Creation succeeding while its response is lost.

No actionable correctness, security or maintenance defect was established in the reviewed change.

## Inspected scope

All 36 manifest entries were inspected. The frontend lock received hash and structured comparison rather than full-text review.

- **CI and exclusions:** `.github/workflows/ci.yml`, `.gitignore`, `backend/Dockerfile.dockerignore`, `frontend/.dockerignore`.
- **Runtime:** `backend/Dockerfile`, `backend/gunicorn.conf.py`, `backend/cheat_sheet/production.py`, `backend/cheat_sheet/settings.py`, `docker-compose.production.yml`, `frontend/Dockerfile`, `frontend/nginx.conf`, `scripts/init-production-db.sh`.
- **Application:** `backend/api/compilation/service.py`, `backend/api/compilation/sidecar.py`, `backend/api/models.py`, `backend/api/migrations/0016_request_throttle_window.py`, `backend/api/request_throttle.py`, `backend/api/views.py`.
- **Dependencies:** `backend/requirements-bootstrap.txt`, `backend/requirements.lock`, `backend/requirements.txt`, `frontend/package-lock.json`.
- **Tests:** `backend/api/test_production_config.py`, `backend/api/test_production_runtime.py`, `backend/api/test_request_throttle.py`, `backend/api/test_sidecar_admission.py`, `backend/api/test_verification_followups.py`, `backend/api/test_verification_safety.py`, `backend/tests/test_request_throttle_postgres.py`, `frontend/e2e/create.spec.js`.
- **Verification:** `frontend/scripts/check-production-image.py`, `scripts/check-production-failures.py`, `scripts/check-production-stack.py`, `scripts/check-proxy-scheme.py`, `scripts/verification_support.py`, `scripts/verify-production.sh`.

Additional caller/boundary inspection covered compile quota admission, compiler server protocol handling, the compatibility compiler caller, rendering authority, serializer ownership restrictions and the frontend API client.

## Evidence limits and remaining gates

The supplied evidence reports:
- `b495c6840`: 23 focused tests plus Ruff and shell syntax passed.
- `b64eda8da`: 482 backend passes, 96.93% coverage, seven separately passing PostgreSQL cases, 244 frontend tests, lint/build, runtime/outage/recovery verification and 39 browser tests with one worker and zero retries.
- Browser execution used the disclosed test-only anonymous budget of 600; restoration to 60 passed.

**I did not execute or independently reproduce those tests.** I reviewed their relevant source and the supplied evidence document.

No manifest file remains uninspected. Unchanged repository areas beyond the supporting boundaries above were not exhaustively audited. Image contents, current package advisories, live runtime state and fresh CI results were not independently inspected. Local HTTP and absent public TLS, WCAG, load and OS-vulnerability certification remain disclosed boundaries, not hidden defects.
