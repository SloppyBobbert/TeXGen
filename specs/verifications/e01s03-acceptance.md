# Production candidate acceptance

## Independent code review: PASS

Round 4 workflow: `76211fd6-5d4f-458b-aed2-9804dcfd3855`.

| Reviewer | Child run | Score | Must-fix | Should-fix |
|---|---|---:|---:|---:|
| A | `a3e6b398-d4b9-4dfa-8b88-e88907263035` | 95% | 0 | 1 |
| B | `71c9d2e7-8ba5-423a-8f1a-c7b6e8de36b7` | 95% | 0 | 1 |

Both independent fresh-context reviews meet the required AND gate: each at least 94%, zero must-fix. Both verified all 35 source hashes. Reports were read only after both children finished. The parent then verified that all accepted source hashes were unchanged.

Accepted manifest: `e01s03-review-round4-manifest.json`.
Aggregate: `6e1be0c83acce374df24c9b23effe8fb940774e757601f3daa25ef9d1a91bfe8`.

Reports: `e01s03-review-a-round4.md`, `e01s03-review-b-round4.md`. Earlier reports and manifests are retained. Four of the maximum five rounds were used. Metadata updates after review do not change implementation files.

## Verification

See `e01s03-round4-checks.md`. `b521f1ad8` passed 478 backend tests with 96.88% coverage; seven PostgreSQL tests separately; 244 frontend tests; strict lint/build/migration checks; runtime and recovery checks; all 39 browser tests; and diff whitespace checks. Seven PostgreSQL-only cases were skipped in SQLite, not counted as passes there.

`b633687dd` passed 19 focused safety/runtime tests and static checks. Cancellation failures were reproduced before their repairs. Existing deadlines and assertions were preserved.

The browser suite used test-only anonymous budget 600 and restored/checked the live default 60. It is not a default-budget full-suite result. Runtime preparation and dependency acquisition were separate from the no-download verifier.

## Non-blocking follow-up findings

Both findings are accepted as valid and explicitly deferred to separate work. Neither reviewer classified them as must-fix. Deferral preserves the reviewed source; neither is represented as repaired.

1. **Ambient HTTP proxy handling.** Stack and frontend-image probes do not explicitly disable urllib proxy discovery. An inherited HTTP proxy without a loopback exemption can redirect these unauthenticated checks. Follow-up: use `ProxyHandler({})` and add a proxy-environment regression. Until then, use a local verification environment with proxies disabled or correct loopback exclusions. Current acceptance covers the recorded local environment, not arbitrary proxy configurations.
2. **Temporary outage-probe account.** Cancellation can leave the probe's unusable-password account and quota row in the retained disposable database. Follow-up: name it from the verification run ID and delete that exact account during outer recovery; test cancellation during the outage probe. Do not delete unrelated accounts or broaden cleanup. This is synthetic test-data retention, not an application-account or production-data finding.

These are not approval to run the verifier against production data. Its database validation restricts it to the owned disposable service.

## Remaining release gate

Fresh GitHub CI and intended-file publication remain pending. This document records independent code acceptance and local checks, not final CI acceptance. No merge, auto-merge, public deployment, TLS/WCAG/load/OS-scan certification is authorized or claimed.
