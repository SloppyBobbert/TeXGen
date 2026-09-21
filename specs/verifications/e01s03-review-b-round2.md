# Production/security review — round 2

**FAIL — 95/100.**
20 checklist items: **19 passed, 1 failed**.
Findings: **1 must-fix, 0 should-fix, 0 consider**.
Failed item: **17**. The score meets 94%, but the must-fix finding prevents acceptance.

## Source verification and scope

- Branch: `fix/document-sections`.
- Baseline/HEAD: `114b4ca7c02a19952fb454a13db91f5d5e743139`.
- All **35 implementation files** match their manifest SHA-256 values.
- Recomputed aggregate: `1aad82dcb3831b0ba509d3ccd2d7f80c3e8b7049d35dea8d0fad2445ca493af2`.
- Patch SHA-256: `c7092d8e771fd33b286d702c3c1dd7f7da16867e1d5626be6e028750969ced9a`.
- Read-only reconstruction of every patch section against the baseline exactly matched all 35 current files.
- Final hash verification confirmed the source remained unchanged. No staged files were present.

Reviewed every implementation file in `specs/verifications/e01s03-review-round2-manifest.json`: application changes, configuration, Dockerfiles, Compose, migration, dependencies, CI, browser changes, verification scripts, and added tests. The frontend lock received hash and structured comparison instead of full-text reading.

Also traced relevant unchanged callers and boundaries: quota admission, API routing, serializers, rendering, compiler selection, sidecar server/healthcheck, compiler Dockerfile, and Playwright configuration.

## Finding

### F1 — must-fix: browser cancellation escapes the parent’s process tracking

**Locations:** `scripts/verify-production.sh:86`, related lines `21–27` and `36–44`.

The browser command runs inside a foreground subshell:

`(cd frontend && run …)`

Consequently, `run()` assigns `active_pid` only inside that subshell. The top-level shell’s `active_pid` remains empty.

If cancellation sends SIGTERM to the top-level verifier during browser execution:

1. Bash can defer its trap while waiting for the foreground subshell.
2. The Python supervisor and browser process group do not receive that signal automatically.
3. Browser requests can continue against the disposable stack, whose anonymous budget is still 600.
4. Restoration can be delayed until the browser command finishes or its separate 600-second supervisor timeout expires.

The process-group termination helper itself is sound for signals delivered to that helper. The outer shell does not reliably reach it in this browser execution path.

**Coverage gap:** `backend/api/test_verification_safety.py:35–51` signals the probe’s immediate Python supervisor, not the top-level shell during browser execution. Lines `111–135` likewise test the Python runner directly. Neither catches the shell/subshell integration defect.

**Minimal repair:** run the browser supervisor from the top-level shell so that shell owns `active_pid`. Changing directories in the main shell is sufficient if restoration uses absolute paths or explicitly returns to the repository root. Avoid placing `run()` inside a foreground subshell.

Add a focused regression that waits for a fake browser descendant to start, sends SIGTERM to the **top-level verifier PID**, and checks bounded termination of descendants, failing exit status, snapshot removal, and budget restoration to 60.

This finding is based on source inspection; I did not execute a reproduction.

## Explicit checklist

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Frozen source and complete patch identity | PASS | All 35 hashes and reconstructed patch contents match. |
| 2 | Separate development and production Linux targets | PASS | Both Dockerfiles retain development defaults and explicit production targets. |
| 3 | Production configuration fails closed | PASS | Rejects DEBUG, weak keys, SQLite, wildcard hosts, and local compiler mode. |
| 4 | Private Gunicorn endpoint and proxy trust | PASS | Unix-only binding, restricted directory/socket permissions, sanitized forwarding headers. |
| 5 | Static frontend behavior | PASS | SPA fallback, immutable asset caching, module-worker MIME, hidden-file rejection. |
| 6 | Restricted database application role | PASS | Separate bootstrap credentials; application role lacks administrative privileges. |
| 7 | Migration/static sequencing | PASS | Backend depends on successful migration; frontend receives static volume read-only. |
| 8 | Shared request admission | PASS | PostgreSQL row locking and primary-key uniqueness serialize concurrent requests. |
| 9 | Request identity and retention | PASS | HMAC identities, fixed windows, clock-reversal handling, bounded expiry cleanup with recheck. |
| 10 | Throttle failure and recovery behavior | PASS | Database errors fail closed; connection health checks avoid stale reuse without replay. |
| 11 | Ownership and template permissions | PASS | Owner-filtered objects and problem relations; template mutations remain administrator-only. |
| 12 | Manual/raw LaTeX authority | PASS | Rendering and normalization preserve raw documents; existing delegation remains intact. |
| 13 | Accepted-compile quota ordering | PASS | READY precedes admission; START follows it; accepted failures remain charged. |
| 14 | Compiler isolation and approved deadlines | PASS | Isolation retained; connect 1s, READY 5s, compile 15s, worker 30s. |
| 15 | Dependencies and CI scope | PASS | Approved pins; frontend has exactly 41 version changes and one added transitive package, no direct or major upgrades. |
| 16 | Pre-migration verifier isolation and no downloads | PASS | Export rejection and database validation precede mutations; private snapshots; prepared images only. |
| 17 | Top-level interruption terminates owned work promptly | **FAIL** | Browser subshell loses parent-visible PID tracking; F1. |
| 18 | Probe resource cleanup | PASS | Predetermined names, UUID ownership labels, continued removal attempts after individual failures. |
| 19 | Budget restoration and recovery sequencing | PASS | Normal completion and propagated failures restore/check 60; cancellation exception is recorded under item 17. |
| 20 | Regression assertions and verification evidence | PASS | Existing admission assertions retained; browser save assertions strengthened; focused and PostgreSQL coverage supplied. |

**Score:** `100 × (20 − 1) / 20 = 95`.

## Evidence limits

No implementation scope was left uninspected. I did not run tests, containers, builds, installs, network requests, or delegates. I did not change source, metadata, or Git state, and did not read another reviewer’s report.

Execution evidence is supplied by the parent and verification documents, not independently rerun:

- `b38f7bbf4`: 472 backend passes, seven PostgreSQL-only skips, 96.91% coverage; 244 frontend tests; lint/build and runtime checks; 39 browser tests.
- Separate required PostgreSQL run: seven passes, no skips.
- `ba871899a`: 13 focused checks plus Ruff/shell syntax.
- Live budget restoration to 60 was reported.

Fresh CI remains a separate pending gate. Python constraints are version pins, not a complete artifact-hash lock. Public deployment, TLS, load, WCAG, and OS vulnerability certification remain outside this review and were not scored as defects.
