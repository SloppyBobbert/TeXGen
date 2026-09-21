# Independent production/security review — round 1

**Result: PASS — 95%.**
**Checklist: 19 passed, 1 failed.**
**Findings: 0 must-fix, 1 should-fix, 0 consider.**

This passes the requested review threshold. It does **not** complete release acceptance: fresh GitHub CI and the other independent review remain pending.

## Scope and evidence

Reviewed all **33 implementation files** named in `specs/verifications/e01s03-review-round1-manifest.json`. Independently calculated every file’s SHA-256; **33/33 matched** the manifest. The manifest identifies frozen source:

`e27543ddb1bad0514f798af126849e8d65e996324f0715e19216cff661edc416`

Read the required story, final-checks and admission documents, relevant patch sections, actual implementation, tests, and callers. Additional inspection covered compiler framing/server/health checks, accepted-compile quota admission, API routing and ownership checks, frontend Save handling and API retry behavior.

The frontend lockfile matched the approved candidate hash. As permitted, I did not read its entire contents or independently repeat its registry audit.

**No tests, builds, installs, containers or network requests were run.** No source, metadata, index or Git state was changed. No credential files, browser traces or another reviewer’s report were read. The staging area was empty at both inspections.

Parent-reported test results are supporting evidence, not independently reproduced results.

## Finding

### SF-1 — should-fix: temporary probe cleanup can leave owned resources behind

**Locations:**

- `scripts/check-proxy-scheme.py:66–73,104–109`
- `frontend/scripts/check-production-image.py:20–27`
- `scripts/verify-production.sh:24–29`

**Failure mechanism:**

The scheme probe’s cleanup loop stops at its first failed `docker rm`. Consequently, a failure removing the proxy skips removal of the backend probe. The subsequent volume removal can also fail because a remaining container still references it.

Both image probes also learn container identities only after `docker run` returns successfully. If Docker creates a container but the client command times out before returning its ID, cleanup cannot identify that container. In the frontend-image probe, creation happens before the `try/finally` altogether.

The outer verifier restores the Compose stack and anonymous budget, but these standalone probe resources are outside that stack. They can therefore remain running after a failed verification.

This is a local verification resource-leak issue, not an identified application authorization or compiler-isolation vulnerability.

**Minimal repair:**

Assign unique container names before creation and place creation inside cleanup protection. Attempt removal of every owned container independently, then remove the volume; collect cleanup failures and retain a nonzero exit status. Do not broaden cleanup to unrelated resources.

Add a small mocked-Docker regression covering:

1. Failure removing the first container still attempts the remaining cleanup.
2. A failed creation command still attempts cleanup using its predetermined name.

The existing verifier regression proves budget restoration after browser exit failure; it does not cover these resource-cleanup failures.

## Twenty-item checklist

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Production rejects unsafe settings | PASS | Production rejects DEBUG, SQLite, short/development-prefixed secrets, wildcard hosts and local compilation. Compose requires its essential configuration. |
| 2 | Separate production and development targets | PASS | Production uses Gunicorn and static Nginx; default development targets retain existing behavior. |
| 3 | Private application socket boundary | PASS | Unix-only Gunicorn binding, directory ownership, restrictive umask, non-root runtime and no backend published port. |
| 4 | Forwarded header and scheme trust | PASS | Nginx replaces client identity/scheme headers and removes alternate forwarding headers. Django does not independently trust raw scheme headers. |
| 5 | Host and local-HTTP restrictions | PASS | Host passes to Django validation; local HTTP requires loopback allowed hosts and Compose publishes only on loopback. |
| 6 | PostgreSQL application privileges and password handling | PASS | Separate bootstrap/application credentials; application role lacks administrative flags; psql uses quoted variable substitution for the password. Database ownership supports migrations without superuser privileges. |
| 7 | Shared request-budget serialization | PASS | Primary-key identity rows, atomic transactions and row locking cover existing-row and first-insert races. PostgreSQL concurrency tests exercise both. |
| 8 | Request admission fails closed | PASS | Database errors reject admission; identities are HMAC-derived; clock reversal does not reset allowance; expiry cleanup rechecks age. |
| 9 | Accepted-compile quota ordering | PASS | READY precedes quota admission; START follows successful admission. Rejected/unavailable pre-admission jobs remain uncharged; accepted failures remain charged. |
| 10 | Compiler deadline compatibility | PASS | Production selects connection/admission/compile limits of 1/5/15 seconds, with a 30-second worker. Low-level defaults retain compatibility; receive framing uses absolute deadlines. |
| 11 | Compiler isolation and resource limits | PASS | Network isolation, read-only filesystem, bounded work tmpfs, dropped capabilities and CPU/memory/swap/process/restart limits remain intact. No weaker fallback was added. |
| 12 | Manual/raw source authority | PASS | Production changes do not rewrite rendering authority; inspected compilation and model callers retain explicit source modes and existing rendering boundaries. |
| 13 | Ownership and privileged template writes | PASS | Sheets and problems remain owner-scoped; template mutations require staff; compile-by-ID uses an owner-scoped lookup. |
| 14 | No unsafe-write replay | PASS | Frontend API client retries only GET/HEAD after authentication refresh. Save and compile writes are not automatically replayed. |
| 15 | Startup, migration and recovery ordering | PASS | Migration completion gates backend startup; compiler health is required; persistent database connection health checks support recovery without replaying requests. Liveness is deliberately separate. |
| 16 | Static frontend serving | PASS | Built assets, explicit PDF-worker module MIME, immutable asset caching, noncached HTML, dotfile denial and missing-asset rejection are configured and probed. |
| 17 | No-download verification and bounded waits | PASS | Prepared-image checks, `--no-build`, `--pull never`, explicit command/probe timeouts and bounded health waits are present. Dependency acquisition is separate in CI. |
| 18 | Cleanup of all verifier-created resources | **FAIL** | SF-1: standalone probe cleanup can skip resources or lose their identities following creation-command failure. Normal Compose restoration is separately protected. |
| 19 | Regression assertions and test coverage | PASS | Save assertions are unconditional; added tests cover production rejection, shared throttling, PostgreSQL concurrency, delayed READY and budget restoration. Reported full-suite results exceed the coverage floor. |
| 20 | Dependency scope, secrets hygiene and CI | PASS | Approved frontend hash matches; Gunicorn/pip pins and pip bootstrap hash are present; lifecycle scripts are disabled; CI actions are immutable, checkout credentials are not persisted, and workflow permissions are read-only. Python constraints are correctly described as version pins, not a hash lock. |

**Score:** `100 × (20 − 1) / 20 = 95%`
**Failed item:** 18.
**Threshold decision:** PASS: score ≥94%, with zero must-fix findings.

## Evidence limits

- Parent reports 462 backend tests, 244 frontend tests, 39 browser tests, seven final-source PostgreSQL tests, and successful runtime checks. I did not rerun them.
- The full browser run used the disclosed test-only anonymous budget of 600, subsequently restored to 60. It is not evidence of a full-suite pass at budget 60.
- The mocked Save test proves its request and UI assertions; its reload assertion alone does not prove server persistence.
- Fresh GitHub CI remains unverified.
- No independent current advisory lookup, OS vulnerability scan, load test, public TLS assessment or WCAG certification was performed.
- No implementation file in the manifest was omitted, subject to the expressly permitted lockfile hash-based review.
