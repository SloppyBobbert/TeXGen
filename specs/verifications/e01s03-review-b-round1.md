# Independent production/security review — round 1, reviewer B

**Result: FAIL — 90%.**

- Checklist: **18 passed, 2 failed, 20 total**
- Findings: **2 must-fix, 0 should-fix, 0 consider**
- Failed items: **18 and 19**
- Score: `100 × (20 − 2) / 20 = 90%`
- Required threshold: at least 94% and zero must-fix findings.

## Scope and evidence

Reviewed all **33 implementation files** in `specs/verifications/e01s03-review-round1-manifest.json`, including actual source, tests, container configuration, CI, and verification scripts. Also traced relevant compiler protocol/server, quota, rendering, and frontend request-client paths.

Every implementation file’s SHA-256 matched its manifest entry. The manifest identifies frozen source SHA-256:

`e27543ddb1bad0514f798af126849e8d65e996324f0715e19216cff661edc416`

The frontend lock matches the approved candidate. Read-only comparison against baseline confirmed **41 version changes, one added transitive package (`@humanfs/types`), no removed packages, and unchanged root dependency metadata**.

Read the required production story, final-checks, admission evidence, and approved frontend update proposal. Used bounded patch reads and actual source inspection rather than accepting the self-review as proof.

**No tests, containers, installs, network requests, source edits, or Git mutations were performed. No credential files, browser traces, or another reviewer’s report were read. The index contained no staged files.**

## Findings

### F1 — Must-fix: verifier can migrate an external database before validating isolation

**Locations:**
`scripts/verify-production.sh:11,18,40`
`docker-compose.production.yml:7,59`

**Failure mechanism**

The verifier passes `--env-file`, but retains the calling shell’s environment. Compose interpolation gives an exported shell variable such as `DATABASE_URL` precedence over that file.

Consequently, a developer shell carrying a reachable deployment database URL can redirect the verification application and migration service to that database. The first `compose up` runs:

```text
python manage.py migrate --noinput
```

before `check-production-stack.py` executes. That check validates role flags and migration state, not that the application is connected to the project’s disposable PostgreSQL service. A restricted application role may still own and migrate the external application database.

The project-name prefix and local HTTP checks do not constrain the database destination. The application network also permits outbound connectivity. Later fixture creation and browser writes compound the exposure, but migration alone violates the explicit “must not modify production data” contract.

This is an accidental configuration hazard; it does not require an attacker or compromised dependency.

**Minimal repair**

Before installing the recovery trap or running any mutating Compose command:

1. Prevent ambient deployment variables from overriding the dedicated verification configuration.
2. Validate the effective database target as the owned `db:5432/texgen` service using the expected application role; reject alternate destinations and connection-option overrides.
3. Reuse that validated configuration for startup and restoration.

Add a stubbed verifier regression with an exported external `DATABASE_URL`. It must reject the configuration before any `up`, migration, seed, or fixture operation. Do not print credentials in validation errors.

### F2 — Must-fix: command bounds do not preserve resource cleanup on timeout/interruption

**Locations:**
`scripts/verify-production.sh:14–15,24–37`
`frontend/scripts/check-production-image.py:20–27`
`scripts/check-proxy-scheme.py:55–73,104–109`

**Failure mechanism**

Temporary probe containers are identified only after a successful `docker run --detach` response. If Docker creates a container but its CLI times out before returning the ID:

- The frontend image checker has not entered its `try/finally`.
- The scheme checker has not appended that container to its cleanup list.
- The scheme volume can remain attached to an untracked container.

Separately, the outer 600-second `subprocess.run` timeout kills only its immediate child. Killing a Python probe skips its `finally`; killing the Playwright launcher does not reliably stop its descendants. Default SIGTERM handling likewise does not execute the Python cleanup blocks.

The shell restoration trap restores the Compose stack and anonymous budget, but does not know about standalone probe containers, their volume, or surviving browser descendants. The existing failure regression covers a normal browser nonzero exit, not these paths.

Thus the implementation has bounded waiting in several places, but does not yet satisfy failure cleanup for resources created by the verifier.

**Minimal repair**

- Assign unique owned names to probe containers **before** creation and attempt cleanup by those names even when creation fails or times out.
- Ensure interruption and outer timeout handling permits bounded cleanup and terminates the launched process group.
- Give the outer recovery path enough ownership information to remove only this run’s standalone probe resources.
- Attempt cleanup of every owned resource even if an earlier cleanup command fails.

Add stubbed regressions for “container created, CLI response times out” and interrupted/timed-out probe execution. Assert cleanup attempts, nonzero exit, budget restoration, and termination of owned descendants.

## Explicit 20-item checklist

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Frozen implementation and review coverage | PASS | All 33 manifest file hashes matched; actual implementation inspected. |
| 2 | Production settings fail closed | PASS | Rejects DEBUG, SQLite, weak keys, wildcard hosts, and unsafe compiler modes. |
| 3 | Development compatibility and separate production targets | PASS | Development remains the default Docker target; production uses Gunicorn/Nginx. |
| 4 | Private application socket boundary | PASS | Unix-only Gunicorn bind, restrictive directory/socket permissions, no backend published port. |
| 5 | Forwarded header and scheme trust | PASS | Nginx replaces client address/scheme headers and removes alternate forwarding headers; Django does not independently trust raw scheme headers. |
| 6 | Static serving and frontend runtime | PASS | Non-root, read-only Nginx; temporary paths configured; module-worker MIME and immutable asset caching addressed. |
| 7 | Compiler isolation | PASS | No-network compiler, restricted filesystem, capabilities, CPU, memory, swap, PID and restart limits retained. |
| 8 | Admission deadlines and compatibility | PASS | Production READY wait is five seconds; default client behavior remains unchanged; protocol reception uses absolute deadlines. |
| 9 | Accepted-compile quota ordering | PASS | READY precedes quota admission; START follows successful admission; cancellation closes the socket; accepted failures remain charged. |
| 10 | Shared request-throttle correctness | PASS | Database transaction and row locking serialize admission; production enables shared limits; PostgreSQL contention tests cover initial and existing rows. |
| 11 | Throttle identity, expiry and fail-closed behavior | PASS | HMAC keys, authenticated identity, sanitized proxy identity, clock-reversal handling, bounded cleanup and sanitized storage failures. |
| 12 | Restricted database role and SQL/password handling | PASS | Separate bootstrap/application credentials; application lacks administrative role attributes; psql literal quoting avoids SQL string interpolation. |
| 13 | Migration sequencing and connection recovery | PASS | Backend waits for successful migration; connection health checks enabled; recovery probe exercises both workers without request retries. |
| 14 | Manual/raw LaTeX authority and ownership | PASS | Rendering authority and ownership filters remain intact; no changed path bypasses them. |
| 15 | No unsafe-write replay | PASS | Compiler transport does not retry jobs; frontend automatic replay remains restricted to GET/HEAD. |
| 16 | Dependency approval and CI controls | PASS | Approved lock scope verified; pip bootstrap hash checked; lifecycle scripts disabled; actions pinned and repository permissions read-only. Fresh CI remains pending. |
| 17 | Assertions and regression coverage | PASS | Save assertions are unconditional; new settings, admission, throttle, PostgreSQL and ordinary failure-restoration tests are substantive. Parent test results were not rerun. |
| 18 | Verifier cannot modify external/production data | **FAIL** | F1: effective database destination is neither isolated from ambient overrides nor validated before migration. |
| 19 | Timeout/interruption cleanup and ownership | **FAIL** | F2: creation-time CLI failures and process termination can bypass cleanup or leave descendants running. |
| 20 | No-download behavior, scope and evidence honesty | PASS | Verifier uses existing images/browser executable and disables builds/pulls; public deployment, TLS, OS scanning and certification claims remain explicitly excluded. |

## Evidence limits and accepted boundaries

Parent-reported verification includes 462 backend tests, seven separately executed PostgreSQL tests, 96.88% coverage, 244 frontend tests, strict lint/build, focused runtime checks and 39 browser tests. These are **supplied evidence, not tests executed by this reviewer**.

The two findings are established by source-level control flow and configuration behavior; neither was experimentally reproduced because runtime mutation was prohibited.

No implementation file was omitted. The package lock was inspected through its exact hash and structured baseline comparison, as permitted, rather than reading every entry. This was not a fresh dependency advisory lookup, OS vulnerability scan, public TLS review, WCAG assessment, load certification, or deployment approval.

The local-only HTTP boundary, version-constraint Python lock, restricted application role owning its database for migrations, five-second admission wait, and separately documented browser-test budget are accepted scope choices—not findings.

**Recommendation:** repair F1 and F2, add targeted failure-path regressions, then submit the next frozen candidate for independent review. Fresh CI remains a separate release gate.
