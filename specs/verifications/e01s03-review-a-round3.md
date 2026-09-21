# Independent production/security review — round 3

**PASS — 95/100.**
20 checklist items: **19 passed, 1 failed**. Findings: **0 must-fix, 1 should-fix, 0 consider**.

This passes the requested review threshold. It does not replace fresh CI or authorize deployment.

## Scope and verification

Reviewed all **35 implementation files** in `specs/verifications/e01s03-review-round3-manifest.json`, including their actual callers and tests. No manifest implementation file remains uninspected. The frontend lock received the permitted hash and structured comparison.

Verified:

- Branch: `fix/document-sections`.
- HEAD/baseline: `114b4ca7c02a19952fb454a13db91f5d5e743139`.
- All 35 individual SHA-256 values match.
- Aggregate SHA-256 matches:
  `5067515e926227a7cc064eef34b8bd55bfba972fec15ffe52a3c07bae61f534e`.
- Aggregate calculated over the sorted, compact JSON file-to-hash mapping.
- The 137,038-byte patch reconstructs all 35 current files exactly from baseline, entirely in memory.
- Frontend lock: 41 version changes, one added transitive package (`@humanfs/types`), no removals, no major-version changes, unchanged root dependency declaration, registry URLs and integrity fields present.
- No staged files.

Read the production specification and requested verification/context documents. Additional caller inspection covered serializers, quota admission, rendering, compiler service/server, frontend API replay handling, and Playwright configuration.

No tests, containers, installations, network requests, or delegates were run. No source, metadata, or Git state was changed.

## Finding

### F1 — should-fix: preflight cancellation still leaves its supervisor running

**Location:** `scripts/verify-production.sh:39–43`; cancellation handlers are installed only at `:65–67`.

**Mechanism:** The preflight Compose configuration and image-inspection commands already use `run()`, which starts an asynchronous Python supervisor. At this point, the shell has only the snapshot-removal EXIT trap. Sending SIGTERM only to the outer shell during one of these commands exits the shell without terminating `active_pid` or its separately sessioned command.

The command can therefore remain alive until its normal completion or the supervisor’s 600-second timeout. The new cancellation regressions cover browser execution and the later captured lookup, not these earlier supervised calls.

**Why not must-fix:** These preflight commands do not mutate the application stack or raise its throttle budget. The later, mutating stages have the repaired restoration handler.

**Minimal repair:** Install an early process-only cancellation/EXIT handler that terminates and waits for `active_pid`, then removes the snapshot. Replace it with the existing restoration handler immediately before mutating operations. Do not invoke stack restoration before validation and image preflight succeed.

Add one outer-PID cancellation case during preflight, retaining the existing 12-second regression bound.

## Explicit checklist

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Frozen source and patch identity | PASS | All 35 hashes and complete patch reconstruction match. |
| 2 | Approved dependency scope | PASS | Exact Gunicorn/pip pins; approved frontend changes; Python hash-lock limitation disclosed. |
| 3 | Separate production/development targets | PASS | Production uses Gunicorn/Nginx; development remains the default build target. |
| 4 | Fail-closed production configuration | PASS | PostgreSQL, secrets, hosts, compiler mode and local HTTP restrictions validated. |
| 5 | Private application socket | PASS | Unix-only Gunicorn bind, restricted directory/socket permissions, no backend published port. |
| 6 | Proxy trust boundary | PASS | Nginx replaces forwarding headers; Django does not independently trust raw scheme headers. |
| 7 | Restricted database role | PASS | Separate bootstrap credentials; application role lacks superuser/create-role/create-database privileges. |
| 8 | Migration and static startup sequencing | PASS | Backend waits for successful migration/static collection and compiler health. |
| 9 | Shared request-throttle serialization | PASS | PostgreSQL row locking handles existing identities and insert races. |
| 10 | Throttle failure and expiry behavior | PASS | Storage failure returns 503; clock reversal fails closed; cleanup rechecks expiry. |
| 11 | Ownership and template permissions | PASS | Owner-filtered documents/problems; admin-only template writes; serializer ownership restriction retained. |
| 12 | Manual/raw LaTeX authority | PASS | Raw normalization bypass and rendering authority preserved. |
| 13 | READY, quota, START ordering | PASS | Admission follows READY; execution follows quota; accepted failures remain charged. |
| 14 | Compiler deadlines and isolation | PASS | Approved READY 5s; connect 1s, compile 15s, worker 30s retained; compiler restrictions unchanged. |
| 15 | No unsafe-write replay | PASS | Frontend API retries only GET/HEAD; no automatic compile/write replay added. |
| 16 | Browser assertions remain unconditional | PASS | Save request, response, dialog, saved state and reload assertions are explicit. |
| 17 | Database isolation before mutation | PASS | Ambient Compose overrides rejected; owned database URL checked before restoration/mutation. |
| 18 | Mutating-stage interruption and recovery | PASS | Supervisors remain in the outer shell; captured output uses private files; labeled cleanup and budget restoration retained. |
| 19 | Cancellation covers every supervised stage | **FAIL** | F1: early preflight calls precede process cancellation handlers. |
| 20 | CI and maintenance scope | PASS | Pinned actions, strict lint/audits, required PostgreSQL tests, zero-retry browser invocation, owned teardown; fresh execution pending. |

**Score:** `100 × (20 − 1) / 20 = 95`.

## Earlier repairs

The ambient-database repair is implemented before mutation, not merely documented. Resolved configuration snapshots are private and reused during restoration.

The round-2 browser/captured-output repair fixes the reported mechanism: `run()` executes in the outer shell, and browser directory selection occurs inside its supervised command. Regression tests signal only the outer PID and check descendant termination, failing exit, snapshot removal and budget restoration without increasing their deadline.

F1 is a narrower remaining preflight lifecycle gap.

## Evidence limits

Parent-provided evidence reports 474 backend passes, 96.88% coverage, seven separately passing PostgreSQL cases, 244 frontend tests, 39 browser tests, restored budget 60, and focused safety checks. **These were not rerun by this reviewer.**

Fresh CI remains pending. Python constraints are not a complete artifact-hash lock. Public TLS, WCAG/load/OS-vulnerability certification and the disclosed local HTTP boundary are outside this review’s acceptance scope.
