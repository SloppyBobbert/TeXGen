# Independent production/security review — round 4

## Result

**PASS — 95%**

- Checklist: **19 passed, 1 failed**
- Must-fix: **0**
- Should-fix: **1**
- Consider: **0**
- Failed item: **20**
- Score: `100 × (20 − 1) / 20 = 95%`

This meets the review threshold of at least 94% with zero must-fix findings. **Fresh CI remains a separate pending release gate.** This is not deployment approval.

## Identity and review method

- Worktree: `/Users/brandontran/TeXGen/.slim/worktrees/document-sections`
- Branch: `fix/document-sections`
- HEAD/baseline: `114b4ca7c02a19952fb454a13db91f5d5e743139`
- All **35 implementation file hashes matched**, including a final recheck.
- Aggregate matched: `6e1be0c83acce374df24c9b23effe8fb940774e757601f3daa25ef9d1a91bfe8`
- Aggregate calculation: SHA-256 of the path-to-file-hash JSON object serialized with sorted keys and separators `(',', ':')`.
- Read the required production specification and verification/context documents.
- Inspected all 34 non-lock implementation files completely. Reviewed the frontend lock through exact hashing and structured comparison against the baseline.
- Inspected bounded diff output and the 138,143-byte patch’s file inventory.
- Traced relevant unchanged callers and boundaries: API routing, rendering, compiler selection, READY/START handling, quota admission, ownership checks, and frontend request replay.
- No tests, containers, installations, network requests, or application commands were run.
- No source, metadata, or Git state was changed. The index was empty at both checks.

## Finding

### S1 — Should-fix: two loopback probes honor ambient HTTP proxies

**Locations**

- `scripts/check-production-stack.py:61–65`
- `frontend/scripts/check-production-image.py:12,45–72`

**Mechanism**

`build_opener(NoRedirect)` installs urllib’s default proxy handler. Plain `urlopen()` also uses default proxy discovery.

On the target Linux environment, an inherited `http_proxy` with no matching `no_proxy` exemption can therefore send these intended loopback HTTP checks through an external proxy. The probes may fail for unrelated reasons or inspect proxy-generated responses rather than the local frontend. The local port and probe requests can also leave the host.

This differs from the outage and scheme probes, which already explicitly disable proxies with `ProxyHandler({})`. It does not establish a bypass of all verification checks, and the affected requests do not carry application access tokens.

**Minimal repair**

- Construct the stack opener with `build_opener(ProxyHandler({}), NoRedirect)`.
- Give the frontend image probe a proxy-disabled opener and use its `open()` method throughout.
- Add a small regression proving that inherited proxy configuration is ignored.

**Evidence limit**

This finding follows from the inspected urllib calls and their default proxy behavior. I did not execute a proxy reproduction or make a network request.

## Explicit checklist

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Candidate identity and scope | PASS | All 35 hashes and aggregate matched; baseline and branch matched. |
| 2 | Separate development and production targets | PASS | Production uses Gunicorn and static Nginx; development remains the default Docker build target. |
| 3 | Production configuration fails closed | PASS | Rejects DEBUG, weak keys, SQLite, wildcard hosts and local compilation; local HTTP is restricted to loopback hosts. |
| 4 | Private application socket | PASS | Gunicorn binds only a Unix socket; ownership, permissions and untrusted-UID rejection have explicit checks. |
| 5 | Forwarded scheme, host and identity trust | PASS | Nginx replaces client forwarding headers; Django does not independently trust raw scheme headers. |
| 6 | PostgreSQL role and migration sequencing | PASS | Restricted application role, safely quoted password, healthy-DB migration prerequisite and completed-migration backend prerequisite. |
| 7 | Shared request throttle concurrency | PASS | Database transaction and row lock serialize admission; PostgreSQL tests cover absent-row and existing-row races. |
| 8 | Throttle failures and lifecycle | PASS | Storage failure returns 503; clock reversal fails closed; cleanup is bounded and rechecks expiry. |
| 9 | Manual/raw LaTeX authority | PASS | Raw rendering and normalization bypass remain intact; no production change alters document authority. |
| 10 | Ownership and mutation permissions | PASS | Owner-scoped sheets/problems and admin-only template mutations remain intact; serializers restrict problem destinations. |
| 11 | Quota and compiler acceptance ordering | PASS | READY precedes quota admission; START follows admission; cancellation closes the connection; accepted failures remain charged. |
| 12 | Runtime deadlines and compiler isolation | PASS | Approved READY wait is 5s; connect 1s, execution 15s and worker 30s remain. Compiler filesystem, network and resource restrictions remain. |
| 13 | No unsafe-write replay | PASS | Frontend replay remains limited to GET/HEAD; no automatic mutation retry was introduced. |
| 14 | Static frontend behavior | PASS | Explicit module MIME, immutable assets, no-store HTML, SPA fallback, missing-asset failure and security headers are checked. |
| 15 | Dependency scope and reproducibility claims | PASS | Approved pins retained; frontend has exactly 41 version changes and one transitive addition, no direct dependency or major-version addition. Python constraint limitations are disclosed. |
| 16 | CI and original assertions | PASS | Immutable action references, coverage gate, required PostgreSQL execution and strict browser settings remain; fresh execution is explicitly pending. |
| 17 | Unconditional Save regression | PASS | Assertions require visible controls, POST success, submitted title, dialog, toast, saved state and reload retention. No swallowed assertion remains. |
| 18 | Pre-mutation verifier validation | PASS | Ambient Compose substitutions are rejected; local database URL is validated; private resolved snapshots are reused; restoration is not enabled during preflight. |
| 19 | Cancellation, bounded child cleanup and recovery | PASS | Early handler precedes preparation and supervised preflight; outer-shell PID tracking and common child-stop logic are preserved; ownership-labelled cleanup and restoration remain bounded. |
| 20 | Loopback probes ignore ambient HTTP proxies | **FAIL** | Two probes retain urllib’s environment-proxy handling; see S1. |

## Assessment of the latest repair

The repair addresses the previously described preflight cancellation mechanism:

- `scripts/verify-production.sh:50` installs process-only cleanup before preparation at line 53.
- Captured commands run in the outer shell; command substitutions no longer hide `active_pid`.
- Both exit paths use `stop_active()`.
- Stack restoration replaces early cleanup only at line 81, after configuration and image checks succeed.
- Failed preflight cannot enter the restoration path.
- The supervisor starts a separate child process group and escalates termination to SIGKILL.
- Ownership labels permit cleanup even when Docker creation succeeds but its CLI response is lost.
- Cleanup continues after an individual removal failure.

The new outer-PID tests exercise preparation, quiet configuration validation, image-list capture, image inspection, later capture and browser execution. They check nonzero exit, descendant termination and snapshot removal; preflight cases additionally prohibit mutating Docker commands. The unchanged 12-second bound is meaningful.

These are relevant regressions rather than assertions that merely inspect shell text. They use fake Docker and synthetic processes, so real daemon recovery still depends on the supplied integration evidence. No additional must-fix issue was identified in this repair.

## Dependency and test observations

Structured frontend lock inspection confirmed:

- Unchanged root dependency declarations.
- Exactly **41 version changes**.
- Exactly one added package: `node_modules/@humanfs/types`.
- No removed package paths or major-version changes.
- All non-root entries have integrity values.
- Resolved package URLs use `https://registry.npmjs.org/`.

This verifies the lock’s shape and approved scope, not the contents or current vulnerability status of downloaded artifacts.

The backend lock explicitly describes itself as version constraints, not a complete artifact-hash lock. The pip bootstrap has a separate exact version and hash.

The Save test is a mocked client-flow regression. Its reload assertion demonstrates retained client state, not independently proven database persistence. It should not replace the broader real-stack journeys.

## Supplied execution evidence — not rerun

I treated these as parent-supplied results:

- `b521f1ad8`: 478 backend passes, seven PostgreSQL-only SQLite skips, 96.88% coverage; seven required PostgreSQL tests passed separately; Ruff and migration checks; 244 frontend tests, strict lint/build; complete revised verifier; 39 browser tests with one worker and zero retries.
- Browser execution used the disclosed anonymous limit of 600; the live limit was restored to 60. This is **not** a default-budget full-suite pass.
- `b633687dd`: 19 focused tests, Ruff and shell syntax passed.
- `ba0bbe384`: reproduced preflight cancellation failure before repair at the unchanged 12-second bound.
- Runtime application code/images were reported unchanged by the host-verifier repairs.
- Fresh CI is pending.

## Coverage and limits

All manifest implementation files were inspected using the stated full-source or structured-lock method. Additional source inspection included quota admission, rendering, compiler server/healthcheck, API routing, ownership serializer excerpts, compilation permission tests and frontend API replay logic.

Not independently inspected or executed:

- Installed package contents, image layers or current advisory databases.
- Raw execution logs, credentials, browser traces or another reviewer’s report.
- Every unchanged test or every unchanged application file.
- Fresh CI, actual Docker recovery or runtime signal timing.

Public TLS, WCAG, load testing and OS vulnerability certification are explicitly outside this review. The disclosed local HTTP topology is not reported as a hidden defect.
