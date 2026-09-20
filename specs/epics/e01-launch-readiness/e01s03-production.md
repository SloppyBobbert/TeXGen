# e01s03: Verify production readiness and prepare handoff

## 1. Outcome

Prepare a release candidate with proven application behavior and production controls. Do not deploy it.

## 2. Status

Planned; risk P0; 8 BCPs. External runtime and platform choices can block individual tasks.

## 3. Baseline

Start from verified e01s02. Retain compiler support limits in `docs/COMPILER_SUPPORT.md`.

## 4. Users

The application owner and operators preparing a small public launch.

## 5. Scope

Remaining backend responsibility cleanup, production runtime and configuration, dependency reproducibility, security test gaps, CI, offline image checks, and release evidence.

## 6. Exclusions

No live deployment, resource purchase, DNS change, secret creation, weakening of compiler isolation, or automatic merge of old deployment work.

## 7. MODIFIED requirements

**Before:** The backend image starts Django runserver. Compiler isolation exists, but complete production application configuration and release evidence remain open.

**After:** Separate development and production entry points use an approved production server and static frontend serving. Startup, migrations, readiness, shared request throttling, and proxy trust have explicit tested behavior.

## 8. Retained requirements

Keep PostgreSQL quota serialization; sidecar protocol v2 READY/START admission; no charge before acceptance; charged accepted failures; offline assets; no network; read-only filesystem; process, CPU, memory, swap, output, and restart bounds. Keep the 95% backend coverage floor.

## 9. Existing modules

Dockerfiles, Compose, requirements, settings, CI, rendering/models/views, compile quotas, sidecar admission, and the real-stack browser tests.

## 10. Minimal design

Use portable Linux containers. Reuse existing rendering and compiler boundaries. Remove only remaining duplicated rendering orchestration that the tests demonstrate. Do not invent new services merely to satisfy checklist wording.

## 11. Reason for depth

A production target separates release behavior from development conveniences. A small verification script is justified to repeat the same no-download image and offline compiler checks locally and in CI.

## 12. Runtime decision gate

Before changing runtime dependencies, check current documentation and propose an exact production server version, source, and disk impact. Obtain installation approval. Choose shared request-throttle storage and proxy handling only after the deployment topology is known. Do not claim deployment readiness while these controls are unresolved.

A deployment host must support the current sidecar architecture and approved asset architecture. Do not adapt the compiler to a weaker platform by removing isolation.

## 13. Security

Add missing API ownership/template and compiler-abuse matrix cases. Test configuration failures, missing sidecar assets, pre-admission unavailability, accepted failure charging, resource limits, and readiness. No new security findings may remain in affected paths.

## 14. Steps

1. Audit remaining rendering/model/view duplication; remove verified duplication with contract tests → verify: task 1 in `e01s03-tasks.yaml`.
2. Add production configuration tests and separate runtime targets after the dependency/topology gate → verify: task 2.
3. Pin the approved dependency set, complete CI and permission/abuse coverage, and remove swallowed or conditional E2E assertions → verify: task 3.
4. Add `scripts/verify-production.sh`; prove startup, migrations, static assets, readiness, and offline compilation within limits → verify: task 4.
5. Run final regression and security review; update the original plan and release handoff → verify: task 5.

## 15. Test cases

Production must not use runserver or debug mode. Missing secrets/configuration must fail clearly. Test trusted proxy boundaries, global request limits across workers, health behavior, migration sequencing, immutable assets, compiler disabled/unavailable/accepted outcomes, and unsupported architecture rejection.

## 16. Environment and script contract

`scripts/verify-production.sh` does not exist yet. Task 4 must create it before invoking it. It must exit nonzero for missing prerequisites or failed checks. It must not install packages, pull images, download assets, modify production data, or remove unrelated resources. Use preapproved local images and assets, unique test resource names, bounded waits, and cleanup only for resources it created.

Record exact image/asset digests and the tested architecture. Prove readiness with representative offline compilation. Do not replace the compiler readiness test with a weaker process-only probe without equivalent evidence.

## 17. Acceptance criteria

Production configuration and full tests pass on the final revision. PostgreSQL quota tests run without skips. All supported browser journeys pass with unconditional assertions. Offline compiler checks prove the approved corpus and limits. No unresolved blocking review findings remain. Deployment, credentials, and publication still require approval.

## 18. Manual verification

On the approved isolated test stack, sign in, create from a template, edit source, remove a topic, cancel and confirm, compile, save, and reload. Restart the application and verify persistence. Stop the sidecar and verify 503 without pre-admission quota charge. Confirm no host or network access is added for compilation.

## 19. Dependencies

Existing PostgreSQL, Docker, Python, Node, and project test tools: [OK]. No new package is authorized. Evaluate production-server and shared-throttle requirements at task 2; record exact proposals and approval before installation.

## 20. Handoff

Write `specs/verifications/RELEASE_HANDOFF.md` with the tested revision, checks, image/asset digests, migrations, recovery procedure, known limits, and external approvals. Update old checklist claims with evidence. Stop before commit, push, PR publication, merge, or deployment.
