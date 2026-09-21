# Independent production/security review — round 4

## Result

**PASS — 95% (19/20 checklist items passed).**

- Must-fix: **0**
- Should-fix: **1**
- Consider: **0**
- Failed item: **17 — complete temporary fixture cleanup**
- Threshold: ≥94% and zero must-fix findings.

This passes the independent review threshold, not final release acceptance. **Fresh CI remains pending.**

## Identity and scope

Reviewed branch `fix/document-sections`, HEAD/baseline `114b4ca7c02a19952fb454a13db91f5d5e743139`.

All **35 implementation files** matched their manifest SHA-256 values, including a final recheck. The aggregate, calculated from compact, sorted JSON of the file/hash mapping, matched:

`6e1be0c83acce374df24c9b23effe8fb940774e757601f3daa25ef9d1a91bfe8`

Read all 34 non-lock implementation files in full. Reviewed `frontend/package-lock.json` by exact hash and structured comparison against baseline. Inspected the 138,143-byte patch inventory and targeted baseline diffs. Also inspected relevant API routes, serializers, rendering, quota admission, sidecar server, and frontend request-client callers.

Read the required production specification, round-4 checks, final-checks context, and review-response context. No other reviewer’s report was read.

## Finding

### Should-fix — cancellation leaves the outage probe’s temporary database fixture

**Locations:** `scripts/check-production-failures.py:75–81,127–139`; `scripts/verify-production.sh:64–74`

**Mechanism:** The outage probe creates a `readiness_<uuid>` user and normally deletes it in `finally`. Unlike the other probe scripts, it does not install a SIGTERM handler. Outer-verifier cancellation makes the supervisor send SIGTERM to the probe’s process group. Python’s default SIGTERM action terminates the process without running its `finally` block.

The outer restoration handler restores services and removes labeled containers/volumes, but does not delete this database fixture. Its user and any accepted-compile quota row can therefore remain in the retained disposable database. Fixture creation also precedes the protected `try`, leaving another cleanup gap if creation succeeds but its response is lost.

**Impact:** Incomplete test-data cleanup and accumulation after interrupted verification. This is not a production-data exposure: the database is validated as the disposable project database, and the generated account has no usable password. Therefore this is **should-fix**, not must-fix.

**Minimal repair:** Derive the fixture username from the existing verification run ID before creation. Have outer restoration delete that exact fixture after database recovery, including when the inner probe never returned its ID. Add one fake cancellation regression during the outage probe that requires fixture cleanup. Do not broaden deletion to all readiness users or other test data.

## Explicit checklist

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Candidate identity and review scope | PASS | All 35 individual hashes and aggregate matched; branch and baseline confirmed. |
| 2 | Separate development and production targets | PASS | Explicit Gunicorn and static Nginx production stages; existing development stages remain defaults. |
| 3 | Production configuration fails closed | PASS | Rejects DEBUG, SQLite, weak keys, wildcard hosts, local compilation and invalid local-HTTP settings. |
| 4 | Private server socket and proxy trust | PASS | Gunicorn binds only Unix socket; restricted directory/socket permissions; Nginx replaces or removes forwarding headers. |
| 5 | Static serving and frontend image behavior | PASS | Read-only non-root runtime, SPA fallback, module-worker MIME, immutable assets and blocked dotfiles. |
| 6 | Migration sequencing and database role | PASS | Migration service precedes backend; separately initialized non-superuser app role; SQL literal quoting used. |
| 7 | Cross-worker shared throttling | PASS | PostgreSQL row locking, first-insert handling, HMAC identities and required concurrency tests. |
| 8 | Throttle expiry and failure behavior | PASS | Clock reversal fails closed; bounded expiry cleanup rechecks age; storage failures become sanitized 503 responses. |
| 9 | Ownership and template permissions | PASS | Owner-filtered sheet/problem access and related-field validation; template writes remain admin-only. |
| 10 | Manual/raw LaTeX authority | PASS | Runtime diff leaves rendering contract unchanged; raw normalization remains a no-op and complete raw documents remain authoritative. |
| 11 | Compiler admission and charging order | PASS | READY precedes quota admission; START follows committed admission; rejected admission closes connection; accepted failures remain charged. |
| 12 | Compiler isolation and deadlines | PASS | No compiler-image change or isolation relaxation; production READY wait is approved 5s; connect 1s, execution 15s and worker 30s remain. |
| 13 | Database recovery and unsafe-write replay | PASS | Connection health checks enabled; request client retries only GET/HEAD after authentication refresh, not unsafe writes. |
| 14 | Dependency update scope | PASS | Approved Gunicorn/pip pins; frontend has exactly 41 version changes and one transitive addition, no direct-dependency or major-version change. |
| 15 | CI checks and permissions | PASS | Read-only permissions, immutable action references, strict checks, explicit PostgreSQL suite and production browser verification. Execution remains pending. |
| 16 | Verifier isolation before mutation | PASS | Ambient Compose variables rejected; resolved database URLs checked before startup; private snapshots reused; no builds, pulls or installs in verifier. |
| 17 | Complete temporary fixture cleanup | **FAIL** | Outage-probe database fixture can survive cancellation; finding above. |
| 18 | Process cancellation and early preflight repair | PASS | Early process-only traps precede preparation and supervised preflight; outer-shell PID tracking retained; process-group termination shared with later restoration. |
| 19 | Probe resources and runtime restoration | PASS | UUID ownership labels assigned before Docker creation; cleanup attempts remaining resources after individual failures; retained stack restored to budget 60. |
| 20 | Regression quality and unconditional Save assertions | PASS | Outer-PID cancellation tests cover four early and two later stages; Save response, title, dialog, success state and reload checks are unconditional. |

**Score:** `100 × (20 − 1) / 20 = 95%`.

## Assessment of the round-4 repair

The reported preflight cancellation defect is repaired in the inspected source:

- `finish_preflight` is installed before preparation, run-ID generation and image/configuration checks.
- Captured commands execute `run` in the outer shell, so `active_pid` remains visible.
- Early cleanup stops owned processes and removes private files without restoring or starting the stack.
- Mutating restoration is enabled only after configuration and image preflight succeed.
- Tests signal only the outer PID and retain the 12-second cancellation bound, including descendants that ignore SIGTERM.

The new database-fixture finding is separate from this repaired process-supervision defect.

## Evidence and limitations

**Independently performed:** read-only source inspection, SHA-256 verification, structured lock comparison, targeted baseline diff review, branch/HEAD checks and staged-file checks. No staged files were present at either inspection.

**Supplied by the parent, not rerun:**

- `b521f1ad8`: 478 backend passes, seven PostgreSQL-only SQLite skips, 96.88% coverage; seven required PostgreSQL tests passed separately; Ruff/migrations; 244 frontend tests; strict lint/build; revised verifier; 39 browser tests with one worker and zero retries.
- Live anonymous budget restored from disclosed test-only 600 to 60. This is **not** a default-budget full-browser-suite result.
- `b633687dd`: 19 focused tests, Ruff and shell syntax passed.
- `ba0bbe384`: pre-repair cancellation failure reproduced at the unchanged bound.

No tests, containers, installs or network requests were run during this review. No source, metadata or Git state was changed. The report is returned for runtime persistence outside the worktree.

**Uninspected/unverified:** installed package contents, current vulnerability databases, live container state, credentials, traces and fresh CI execution. Supporting unchanged modules were inspected selectively rather than audited repository-wide. Python constraints remain version pins, not a full artifact-hash lock. Public TLS, full WCAG, load testing and OS vulnerability certification are outside this review.
