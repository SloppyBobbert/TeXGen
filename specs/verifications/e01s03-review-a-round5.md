# Independent production/security review — round 5

**Result: PASS — 100/100**

- Checklist: **20 passed, 0 failed**
- Findings: **0 must-fix, 0 should-fix, 0 consider**
- Failed items: **none**
- Review threshold: ≥94 with zero must-fix findings — satisfied.
- Fresh candidate CI remains pending. This review does **not** authorize merge or deployment.

## Identity and integrity

Reviewed branch `fix/document-sections`, HEAD/follow-up base:

`e3c0fcd4fee80cc4a4d574243efd021761573974`

Cumulative implementation baseline:

`114b4ca7c02a19952fb454a13db91f5d5e743139`

All **36 manifest file hashes matched**, including the untracked follow-up test. Rechecked them at the end; no drift.

Aggregate verified using SHA-256 over the file-to-hash mapping serialized with sorted keys and compact JSON separators:

`b2830fb5e12a722808022db000da2b5a9ff51af901d4754485218db3fdd0d7a8`

The cumulative patch is **144,394 bytes**, SHA-256:

`eda542f1955a80768494c2277277c5a48007c4ef5c776c1240eea2029ca8ecb3`

Reconstructed its changes against the cumulative baseline **in memory**. All 36 resulting files matched current source; patch and manifest scopes matched exactly.

## Checklist

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Candidate identity and frozen scope | PASS | All individual hashes, aggregate and patch reconstruction matched. |
| 2 | Separate development and production targets | PASS | Production uses Gunicorn and static Nginx; existing development targets remain separate. |
| 3 | Fail-closed production configuration | PASS | Production rejects debug, SQLite, weak keys, wildcard hosts and unsafe compiler/local-HTTP combinations. |
| 4 | Private server socket and proxy trust | PASS | Gunicorn binds only its Unix socket; permissions restrict access; Nginx replaces or removes forwarding headers. |
| 5 | Static serving and response controls | PASS | Explicit module-worker MIME, immutable asset caching, no-store HTML, blocked dotfiles and bounded proxy/body settings. |
| 6 | Shared request admission | PASS | PostgreSQL row locking covers initial insertion and existing identities; storage failure fails closed. |
| 7 | Identity and throttle lifecycle | PASS | Authenticated identity is independent of address; anonymous identity uses sanitized proxy input; cleanup rechecks expiry. |
| 8 | Restricted application database role | PASS | Bootstrap creates a non-superuser role without database/role creation or replication privileges; runtime checks administrative flags. |
| 9 | Startup, migration and readiness sequencing | PASS | Migration/static collection precede backend startup; readiness checks dependencies and pending migrations; liveness remains separate. |
| 10 | Compiler isolation retained | PASS | No compiler implementation changes in the cumulative diff; networkless/read-only/resource-bounded runtime remains configured. |
| 11 | Admission ordering and deadlines | PASS | READY precedes quota admission; START follows admission. READY is 5 seconds; connect/compile/worker remain 1/15/30 seconds. |
| 12 | Raw/manual source authority | PASS | Compilation still follows existing renderer boundaries; raw complete documents and raw normalization remain unchanged. |
| 13 | Ownership and permissions | PASS | Sheet lookup/update is owner-scoped, template mutations require administrators, and problem relations restrict selectable sheets. |
| 14 | Safe-read-only replay retained | PASS | API client retries only eligible GET/HEAD requests, with cancellation and session-version checks; no client changes in this scope. |
| 15 | Approved dependency scope | PASS | Gunicorn 26.2.0, hashed pip 26.2 bootstrap and pinned Nginx are present. Frontend lock matches 41 changed records plus one transitive addition, without major changes or root declaration changes. |
| 16 | CI and original regression protection | PASS | Read-only workflow permissions, pinned actions, coverage floor, PostgreSQL enforcement and browser verifier are present. Browser execution explicitly uses one worker and zero retries. Fresh CI is still a gate. |
| 17 | Unconditional Save assertions | PASS | Save test requires visible controls, POST response/payload, success dialog/status and reload result; swallowed assertions were removed. |
| 18 | No-download, isolated verification | PASS | Configuration is validated before mutation; external database URLs and ambient Compose overrides are rejected; local images are inspected and execution uses no-build/pull-never. |
| 19 | Cancellation, deadlines and resource ownership | PASS | Outer-shell PID tracking reaches process-group shutdown; early preflight traps avoid stack mutation; run-labeled cleanup and bounded restoration preserve failure status. |
| 20 | Follow-up proxy and outage-fixture repairs | PASS | Explicit proxy-disabled openers prevent ambient proxy discovery. Fixture identity exists before creation, cleanup surrounds creation, and outer recovery deletes only the exact run-ID unusable-password account after dependency restoration. |

**Score:** `100 × (20 − 0) / 20 = 100`

## Findings

No actionable defects identified in the reviewed scope.

The follow-up changes are appropriately narrow:

- Existing HTTP deadlines and redirect policy are preserved while disabling ambient proxies.
- Creation-response loss no longer leaves cleanup dependent on receiving the fixture’s database ID.
- Outer recovery covers termination that interrupts the probe’s own recovery.
- Cleanup uses the exact validated run UUID and unusable-password condition, not a username-prefix sweep.
- Tests inspect recovery ordering and execute the actual deletion payload against Django, including quota cascade deletion and preservation of unrelated and usable-password accounts.

## Inspected scope

All 36 manifest files were inspected. The frontend lock received structured review rather than full-text reading.

- **CI and build:** `.github/workflows/ci.yml`, `.gitignore`, `backend/Dockerfile`, `backend/Dockerfile.dockerignore`, `frontend/.dockerignore`, `frontend/Dockerfile`.
- **Application/compiler:** `backend/api/compilation/service.py`, `backend/api/compilation/sidecar.py`, `backend/api/models.py`, `backend/api/request_throttle.py`, `backend/api/views.py`, `backend/api/migrations/0016_request_throttle_window.py`.
- **Production configuration/dependencies:** `backend/cheat_sheet/production.py`, `backend/cheat_sheet/settings.py`, `backend/gunicorn.conf.py`, `backend/requirements-bootstrap.txt`, `backend/requirements.lock`, `backend/requirements.txt`, `docker-compose.production.yml`, `frontend/nginx.conf`, `frontend/package-lock.json`.
- **Tests:** `backend/api/test_production_config.py`, `backend/api/test_production_runtime.py`, `backend/api/test_request_throttle.py`, `backend/api/test_sidecar_admission.py`, `backend/api/test_verification_followups.py`, `backend/api/test_verification_safety.py`, `backend/tests/test_request_throttle_postgres.py`, `frontend/e2e/create.spec.js`.
- **Verification:** `frontend/scripts/check-production-image.py`, `scripts/check-production-failures.py`, `scripts/check-production-stack.py`, `scripts/check-proxy-scheme.py`, `scripts/init-production-db.sh`, `scripts/verification_support.py`, `scripts/verify-production.sh`.

Additional caller/contract inspection covered API URLs, serializers, compile quotas, rendering, compilation permission tests, the frontend API client, real-stack browser journeys, Playwright configuration, and compiler Dockerfile/healthcheck.

Read both required requirements/evidence documents.

## Evidence and limits

**Executed by this reviewer:** read-only Git inspection, hashing, structured lock comparison and in-memory patch reconstruction. No tests, containers, installations, network access, delegates, source edits, metadata edits or Git mutations.

**Supplied evidence, not rerun:**

- `b495c6840`: 23 focused tests, Ruff and shell syntax passed.
- `b64eda8da`: 482 backend passes, 96.93% coverage, seven separately passing PostgreSQL cases, 244 frontend tests, lint/build, runtime/outage/recovery verification and 39 browser tests.
- Browser evidence used the disclosed test-only anonymous budget of 600; restoration to 60 was reported. This is not evidence of a default-budget full-suite pass.

Python constraints pin versions but do not hash every application artifact. Frontend dependency records had integrity values and registry URLs; downloaded artifacts were not independently inspected.

No manifest files remain uninspected. Broader unchanged application code, live images, external services, credentials, traces and prior reviewer reports were not exhaustively inspected. Public TLS, WCAG, load and OS-vulnerability certification remain outside this review.

The Git index was empty at both inspections. Existing candidate changes remained unstaged and unchanged.
