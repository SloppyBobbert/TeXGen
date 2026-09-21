# Shared request throttling — in progress

## Design

A PostgreSQL row lock serializes each identity's fixed-minute request counter. Authenticated requests use the user ID; anonymous requests use DRF's client-IP policy. Stored identities are HMAC digests, not raw IP addresses. The production proxy must overwrite forwarded headers and prevent direct backend access before enabling a trusted-proxy count.

This is a request budget, not the existing accepted-compile quota. Compiler admission and charging remain unchanged. Database admission errors return 503 instead of permitting the request. Clock reversal cannot reset an active counter. Expired identity cleanup is bounded to 100 rows per admitted request and rechecks expiry before deletion.

Fixed windows can admit two window limits near a minute boundary. This is not a rolling-window limit or a DDoS defense. PostgreSQL availability is required when enforcement is enabled. Development bypasses the class without database access. Production enables it unconditionally with validated positive limits (default: 60 anonymous or 600 authenticated requests per minute).

## Evidence

- `b928ae6d8`: eight new tests failed during setup because the throttle module did not exist. This was a missing implementation, not eight independently reproduced runtime bugs.
- Added `RequestThrottleWindow`, migration `0016_request_throttle_window`, and `SharedRequestThrottle`.
- `b6cb6a3ab`: all 18 behavior/production-configuration tests passed; Ruff passed.
- `b854f3b68`: six new route-integration tests failed before wiring; nine controls passed. These cover public/auth routes, compile-budget separation, health exemption, 429/Retry-After, and storage-failure 503.
- `b30cf5240`: all 25 existing behavior/configuration cases passed after route wiring; four new production-default cases failed before enforcement was enabled.
- `b19b2bc52`: full regression exposed two original compile-throttle registration assertions. Both were preserved. Shared admission now runs inside the existing `CompileUserThrottle`, rather than adding a second registered compile throttle.
- `bd4f41983`: 451 tests passed, seven PostgreSQL-only tests skipped; coverage 96.82%, Ruff passed, and migration drift check passed. Route integration and production-default cases passed.
- `b0258aacd`: all seven PostgreSQL tests passed on the owned Linux Compose stack, with no skips (1.41 seconds). Both new throttle cases used eight independent database connections and admitted exactly the remaining budget during first-insert and existing-row contention. All five existing compile-quota tests passed unchanged.

## Open work

Proxy verification, runtime stack checks, and independent review remain open. Current route integration, backend regression, and PostgreSQL contention cases passed; these must be repeated as needed on the final revision. Seven SQLite-run skips are not passes; separate PostgreSQL evidence is recorded above.

Reference: DRF documents non-atomic built-in cache throttles and the custom `BaseThrottle` interface at <https://github.com/encode/django-rest-framework/blob/main/docs/api-guide/throttling.md> (checked through Context7 `/encode/django-rest-framework`).
