# Compiler admission deadline — approved repair

type: verification
context: e01-launch-readiness / e01s03

## Reproduction

`b02ef31d5` passed runtime and database-recovery checks, but a real browser compile returned service unavailable. The sidecar serves connections serially. Its live health probe compiles a PDF; callers previously used the same one-second timeout for connection and waiting for READY.

Controlled overlap `b0f8022fa` returned:

- Health PDF succeeded in 1.015 seconds.
- Overlapping request failed before acceptance in 1.009 seconds.

This confirmed an admission deadline conflict. The separate browser pass `ba27e1056` did not resolve that conflict.

## Owner approval

The owner selected **Allow bounded admission wait (Recommended)** in response to:

> May I separate connection and admission deadlines, allowing up to five seconds for compiler admission?

Approved limits: connection one second; production READY wait five seconds; compilation 15 seconds; Gunicorn worker 30 seconds. No test-timeout increase, retries, quota relaxation, or compiler-image changes were approved as part of this repair.

## Implementation and checks

- `SidecarCompilerClient` has a separate optional admission deadline. Without an override it retains the existing connection-timeout behavior.
- The shared settings selector supplies the production five-second deadline. Production declares it explicitly; development defaults remain unchanged.
- READY still precedes quota admission. START still follows successful quota admission. A readiness failure closes the connection without charging accepted-compile quota.
- Existing protocol framing uses an absolute receive deadline, not an unlimited sequence of per-byte waits.
- The added real-socket regression delays READY for 1.2 seconds and verifies no early quota charge, followed by exactly one accepted job. It failed first with service unavailable/broken pipe, then passed with the repair.
- The first focused run passed all 52 selected admission/adapter/production tests and Ruff. A further configuration assertion checks the actual production selector's `[1, 5, 15]` deadline values.
- `ba549dcc1` is the pending rebuild, production-selector overlap probe, and consolidated no-download verification run.

The compiler runtime, protocol, resource controls and test timeouts are unchanged. Five seconds is a bounded wait, not a guarantee of admission under overload. Production acceptance and independent reviews remain pending.
