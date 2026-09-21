# Independent production/security review — round 2

**FAIL — 95/100.**
20 checklist items: **19 passed, 1 failed**.
Findings: **1 must-fix, 0 should-fix, 0 consider**.

The score meets 94%, but the remaining must-fix prevents acceptance.

## Finding

### R2-A1 — Must-fix: outer-shell cancellation can miss the running browser process

**Locations:** `scripts/verify-production.sh:86`, related `:21–26`, `:40–43`, `:80–81`.

The browser command calls `run` inside a foreground subshell:

```sh
(cd frontend && run ./node_modules/.bin/playwright ...)
```

`active_pid` is therefore updated only in that subshell. The top-level shell—the owner of the restoration trap—still has an empty `active_pid`.

If SIGTERM targets the top-level verifier while browsers are running, Bash can defer its trap until the foreground subshell finishes. It cannot promptly forward termination through the intended `active_pid` path. The browser may continue until the runner’s 600-second deadline, with the anonymous budget still raised to 600. If a supervising process subsequently kills the outer shell after its cancellation grace period, restoration never runs.

The `$(run ...)` command substitutions have the same parent/child state separation, including the Docker lookups after the budget increase at lines 80–81.

This is a static control-flow finding; I did not execute a signal reproduction.

**Minimal repair:**

- Invoke `run` in the top-level shell. For the browser, put the directory change inside its launched command:
  ```sh
  run bash -c 'cd frontend && exec ./node_modules/.bin/playwright test --workers=1 --retries=0 --reporter=line'
  ```
- For captured command output, run into a file inside the existing private snapshot directory, then read that file into the variable. Do not put the long-running `run` invocation inside command substitution.
- Add a regression that sends SIGTERM to the **outer verifier PID** during the browser stage and verifies descendant termination, failing exit status, and restoration to 60.

The existing interruption test at `backend/api/test_verification_safety.py:35–49` signals the probe’s immediate Python supervisor. It does not exercise outer-shell cancellation during the browser subshell.

## Explicit checklist

| # | Check | Result |
|---|---|---|
| 1 | All 35 implementation files match the frozen manifest and patch | PASS |
| 2 | Separate development and production Linux runtime targets | PASS |
| 3 | Production rejects unsafe settings and compiler fallback | PASS |
| 4 | Gunicorn uses a private socket and bounded workers | PASS |
| 5 | Nginx replaces forwarding headers; socket permissions define trust | PASS |
| 6 | Static assets, SPA fallback, module MIME and cache policy | PASS |
| 7 | Migration sequencing and restricted application database role | PASS |
| 8 | Shared PostgreSQL request admission serializes competing workers | PASS |
| 9 | Throttle identity, rollover, clock reversal and storage failure behavior | PASS |
| 10 | Manual/raw LaTeX authority and existing rendering boundary retained | PASS |
| 11 | Document, problem and template ownership/permission boundaries retained | PASS |
| 12 | READY → quota admission → START ordering; accepted failures remain charged | PASS |
| 13 | No automatic replay of unsafe application writes | PASS |
| 14 | Approved connect/READY/compile/worker deadlines and compiler isolation retained | PASS |
| 15 | Dependency changes remain within the approved scope | PASS |
| 16 | CI defines strict lint, coverage, PostgreSQL and browser gates | PASS |
| 17 | Existing assertions remain; browser assertions are unconditional | PASS |
| 18 | Verifier rejects ambient database overrides before mutation and uses private snapshots | PASS |
| 19 | Prepared-image-only execution and labeled probe cleanup, including individual removal failures | PASS |
| 20 | Outer-shell interruption reliably terminates work and reaches budget restoration | **FAIL — R2-A1** |

**Calculation:** `100 × (20 − 1) / 20 = 95`.

## Scope and evidence

Reviewed all **35 implementation files** in `specs/verifications/e01s03-review-round2-manifest.json`, including actual source and relevant callers. Additional inspection covered the rendering implementation, serializers, compile quota, sidecar server and frontend API replay policy.

Verified:

- Every implementation file’s SHA-256 matches its manifest entry.
- Canonical compact, sorted JSON hashing of the file-hash mapping produces:
  `1aad82dcb3831b0ba509d3ccd2d7f80c3e8b7049d35dea8d0fad2445ca493af2`.
- Read-only reconstruction of every patch section against baseline `114b4ca` matches all 35 current files.
- Patch SHA-256:
  `c7092d8e771fd33b286d702c3c1dd7f7da16867e1d5626be6e028750969ced9a`.
- Structured frontend lock comparison: **41 version changes**, **one added transitive package** (`@humanfs/types`), no removals, unchanged root dependency declaration and no changed package major versions.
- No staged files at the final check.

The database-override repair is sound within the inspected topology: exported interpolated variables are rejected before mutation; both application services require `db:5432/texgen`, the `texgen` user, a password and no URL options; resolved snapshots are private and reused for restoration.

Predetermined probe names and fresh ownership labels address lost creation responses. Cleanup attempts remaining resources after individual failures. The Python runner’s process-group termination is an improvement, but its shell callers leave R2-A1 unresolved.

### Evidence limits

- No tests, containers, installs, network requests or delegates were run.
- No source, metadata or report file was written by this review; this report is returned for runtime persistence.
- No other reviewer’s report was read. The specifically supplied review-response document was read.
- Parent-reported results—472 backend passes, 96.91% coverage, 244 frontend tests, seven required PostgreSQL passes, 39 browser passes and 13 focused safety checks—were considered, not independently rerun.
- Fresh CI remains a separate pending gate.
- No manifest implementation file remains uninspected. The frontend lock received the permitted hash/structured review rather than a full textual read.
- Public deployment, TLS, load, WCAG and OS vulnerability certification were not assessed and are not findings.
