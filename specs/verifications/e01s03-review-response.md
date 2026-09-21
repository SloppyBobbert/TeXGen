# Production review responses

## Combined result: FAIL

Workflow: `02b8a7ef-28ca-4408-89a7-9005db9446c1`.

- Reviewer A (`a4960f2f-2a07-4fc3-9aa5-b0628d81379b`): 95%, zero must-fix, one should-fix (probe cleanup).
- Reviewer B (`2c25226f-8cbb-463c-9782-7aa172df3e47`): 90%, two must-fix findings (external database override and timeout cleanup).
- Both reviewers independently matched all 33 source hashes. Neither ran tests or changed the source. Both reports were read only after both children completed.
- Reviewed fingerprint: `e27543ddb1bad0514f798af126849e8d65e996324f0715e19216cff661edc416`.

## Accepted findings

1. **Must-fix — database isolation.** Exported shell variables could override the fixture file before migration. Validate before any mutating command or restoration trap. Reject ambient Compose overrides and nonlocal/option-bearing database URLs. Use private resolved configuration snapshots for startup and restoration.
2. **Must-fix — cleanup after timeout/interruption.** The old timeout killed only the immediate child; probe identities could be lost before Docker returned them. Assign names and a unique ownership label before creation. Clean all matching resources even after one removal fails. Terminate child process groups and let the outer restoration path repeat owned-resource cleanup.
3. **Should-fix — partial probe cleanup.** This duplicates finding 2 and is included in that repair.

There are no rejected findings or requested scope changes. Original runtime limits, compiler image, quota rules and browser assertions remain unchanged. No dependency was added.

## Verification status

`b33b84479` passed 12 targeted tests but failed Ruff on an unused import. The import was removed. An additional interrupted-probe regression checks owned-resource cleanup, budget restoration and a failing exit status.

`ba871899a` passed all **13 targeted tests in 6.94 seconds**, Ruff and shell syntax checks. These include external database rejection before mutation, creation-response timeout cleanup, continued cleanup after a removal failure, and process-group termination after timeout or interruption.

`b38f7bbf4` passed: 472 backend tests, seven PostgreSQL-only skips, 96.91% coverage; 244 frontend tests; lint/build/migration checks; all 39 browser tests and runtime/recovery checks. The live budget returned to 60. The separate required PostgreSQL suite passed all seven tests in 1.24 seconds.

## Round 2 — combined FAIL

Workflow: `9e6f8ee6-791b-4cfc-9e58-afe090798b2a`. Both reviewers scored 95%, with the same one must-fix finding and no should-fix findings. Both verified all 35 file hashes and aggregate `1aad82dcb3831b0ba509d3ccd2d7f80c3e8b7049d35dea8d0fad2445ca493af2`. Both reports were read after both children completed.

**Accepted must-fix:** the browser calls `run` inside a foreground subshell, so the outer shell cannot track its active supervisor. Command substitutions also isolate `active_pid`. Signal handling must remain in the top-level shell. Captured output will use files in the existing private snapshot directory; browser directory selection will happen inside the supervised command.

A new regression signals only the outer verifier PID after a fake browser descendant reports readiness. It requires bounded exit, descendant termination, removal of private snapshots and budget restoration. `b46fa70ca` runs it against the unchanged verifier before the repair. No real Docker or browser process is used in that test.

Two of the maximum five review rounds are consumed. Publication remains blocked until the repair passes full verification and both round-3 reviewers accept the frozen source.
