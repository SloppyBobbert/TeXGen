# TeXGen Refactoring Plan

Approved: August 25, 2026

## Objective

Prepare TeXGen for a small public production launch without a full rewrite. The work should make template editing, topic removal, manual LaTeX editing, compilation, saving, and reloading deterministic while improving security, maintainability, accessibility, and deployment safety.

## Verified PR8 handoff

The approved execution checklist is `specs/CONTINUOUS_PLAN.md` and its three e01 stories. It supersedes the historical checklist below; it explicitly avoids cosmetic rewrites of working code.

Implementation commit: `c238dd2de041525214cb383d67080d080aab5524`, draft [PR #8](https://github.com/SloppyBobbert/TeXGen/pull/8). [CI 35576550902](https://github.com/SloppyBobbert/TeXGen/actions/runs/35576550902) passed backend, frontend and browser-e2e for that exact commit.

- e01s01: stable section identities, conservative removal/confirmation, raw authority and durable history/save/reload. Evidence: `specs/verifications/e01s01-task5.md`.
- e01s02: shared editor ownership, request cancellation/replay policy, mobile/keyboard workflows and reduced motion. Evidence: `specs/verifications/e01s02-acceptance.md`.
- e01s03: private production runtime, restricted database role, shared throttling, unchanged compiler isolation, dependency controls, no-download verification and failure recovery. Evidence: `specs/verifications/e01s03-acceptance.md` and `e01s03-round4-checks.md` in that directory.
- Final local checks: 478 backend passes, 96.88% coverage, seven required PostgreSQL cases separately, 244 frontend tests and 39 browser tests. The functional browser budget was 600 and was restored/checked at 60. The seven SQLite skips were not counted as passes.
- Production independent review: both 95%, zero must-fix. Accepted source fingerprint: `6e1be0c83acce374df24c9b23effe8fb940774e757601f3daa25ef9d1a91bfe8`.

The shared rendering implementation already met the service-boundary requirement; no extra refactor was needed. Broader component/CSS reshaping in the old checklist is not a reason to rewrite verified behavior. Two non-blocking verifier findings remain: ambient proxy handling and exact temporary-user cleanup after cancellation. Both are recorded in the acceptance and handoff documents.

The authorized release-candidate work is complete. **No merge, auto-merge or public deployment is approved.** Public TLS, backups/restore, operational monitoring and deployment choices remain separate release concerns. The historical phase checklists and checkpoint claims below are retained for provenance, not as current task status.

## Product decisions

- Require sign-in for PDF compilation and downloads.
- Support structured editing and an advanced raw-LaTeX mode.
- Preserve manual edits by default; replacing source requires explicit regeneration.
- Treat templates as staff-curated and publicly readable.
- Optimize initially for a small public launch on portable Linux containers.
- No existing production data or external API clients require compatibility.

## Originally identified problem areas — August 25, 2026

Historical baseline; current implementation status appears below.

- Template-created sheets do not preserve formula-selection provenance.
- Topic removal changes selection state but does not alter existing raw LaTeX.
- Regeneration removes deselected topics but replaces manual edits.
- Individual formula removal can leave category controls inconsistent with generated formulas.
- Multiple local-storage representations can combine one sheet's formulas with another sheet's source.
- Late generation, compilation, or save responses can undo a clear/reset operation.
- Backend permissions and public Tectonic compilation are unsafe for public deployment.
- Rendering, normalization, and compilation responsibilities are duplicated across models, views, and utilities.
- The creator and Dashboard contain responsive, accessibility, error-recovery, and request-ordering failures.
- CI, dependency versions, and production runtime expectations are inconsistent.

## Phase 1 — Baseline, regression tests, and emergency fixes

- [x] Rebuild the PR lane from current `origin/main` without unrelated history.
- [x] Establish an isolated branch or worktree and a known baseline commit.
- [x] Run backend tests, frontend tests, lint, and builds; record pre-existing failures.
- [x] Add regression coverage for template → edit → remove topic → compile → save → reload.
- [x] Add coverage for stale local storage, formula/category removal, request races, and compiler failures.
- [x] Fix formula, category, and class selection-state inconsistencies.
- [x] Apply deterministic precedence between matching namespaced drafts and explicit sheet/template selections.
- [x] Namespace drafts by sheet or draft ID.
- [x] Define separate Generate and Compile behavior for structured and raw source.
- [x] Prevent invalidated generation, normalization, compilation, download, and save work from publishing after a manual/history edit, clear, reset, or unmount.
- [x] Require ownership for user resources and staff-only template writes.
- [x] Add compiler authentication, authenticated quotas, timeouts, size limits, and safe diagnostics.

### Gate

The reported template workflow is deterministic and regression tests cover the repaired behavior. Compilation requires sign-in; production deployment remains blocked until the required shared throttling and compiler-isolation controls exist.

### Phase 1 execution status — August 26, 2026

Evidence recorded in `omos/phase1-correctness-pr`, rebuilt from `origin/main` at `70c10ec` to avoid unrelated history:

- Clean-base validation passed 100 frontend tests and 128 backend tests, frontend lint and production build, Django check, migration dry-run, and Python compilation.
- Matching namespaced drafts recover over stale same-identity server selections. Explicit selections, including `[]`, win only when no matching namespace exists; unrelated and legacy drafts do not override.
- Formula removal preserves sibling, final-category, and same-class selection invariants.
- Generate intentionally rebuilds source from selections and compiles. Compile uses current non-empty source, auto-generating only when source is empty.
- Manual or history edits invalidate active generation, normalization, compilation, and download work. The newest current operation owns publication; downloads do not mutate editor content; successful PDF URLs retain their exact compile snapshots.
- `Phase1Journey.test.jsx` is component integration with mocked persistence, covering explicit/template data → manual edit → removal → compile → save → storage clear → reload with a distinct persisted identity. App-level tests separately cover real save payload/response mapping, matching-draft recovery, reload, and pending-save unmount behavior.
- Template selection persistence, permissions and ownership, authenticated sheet-ID compile-path validation and related source validation, plus throttles, timeouts, and generic compiler errors are covered.
- Some document fields already exist in current `origin/main`; this is baseline context, not Phase 2 completion or work attributed to this diff.

At that checkpoint, Phase 1 was not complete. The remaining containment work was:

- Configure shared/global throttle storage and trusted proxy/client-IP handling; the current in-process cache cannot enforce global quotas across workers.
- Add process-group, container, filesystem, network, CPU, memory, process-count, and output isolation. Authenticated compilation is not production-safe until these controls and shared throttling exist.

## Phase 2 — Document model and backend rendering core

- [x] Define one canonical document contract containing title, source mode, source LaTeX, layout, ordered formula selections, schema version, and revision.
- [x] Persist every layout field, including spacing.
- [ ] Classify each field as plain text or raw LaTeX and enforce one escaping policy.
- [ ] Represent generated sections with stable topic and formula identities.
- [ ] Preserve custom user content separately from generated sections.
- [x] Make raw source authoritative in advanced mode.
- [x] Require explicit regeneration before replacing manual source.
- [ ] Extract layout validation, formula resolution, document assembly, and practice-problem rendering into focused services.
- [x] Create one compiler adapter boundary and remove duplicate Tectonic invocation paths.
- [ ] Keep Django models focused on persistence and views focused on HTTP orchestration.
- [x] Restrict normalization to marked generated documents rather than parsing arbitrary TeX with regexes.
- [ ] Fully isolate Tectonic with offline assets, resource limits, bounded diagnostics, and verified downloads.
- [x] Add golden document tests (`backend/api/test_rendering_boundary.py`).
- [x] Add a real compilation smoke journey with the networkless Compose sidecar (`frontend/e2e/real-stack.spec.js`).

### Gate

One backend path owns document construction and compilation, and structured documents can remove topics without damaging unrelated manual content.

### Historical PR6 implementation checkpoint — September 11, 2026

[PR #6](https://github.com/SloppyBobbert/TeXGen/pull/6) replaced closed, unmerged PR #5. The following is historical PR6 evidence, not the current PR7 validation status, a production release, or a merge into `main`.

- Shared rendering now owns document assembly, practice problems, plain-text escaping, and marker-based normalization. Explicit raw documents retain their source; fragments receive a document wrapper.
- The compiler adapter boundary selects `disabled`, development-only `local`, or `sidecar` without fallback. Source selectors reject explicit null values. Compilation remains disabled by default.
- PostgreSQL-backed compile quotas serialize admission across workers. This does not replace the general request throttle or complete deployment-specific proxy configuration.
- The dedicated compiler uses verified offline assets, a Unix socket, no network, a read-only root, bounded resources, bounded diagnostics, and a finite crash-restart policy. See [Compiler support](COMPILER_SUPPORT.md).
- The asset proof covers a curated sparse corpus on Linux ARM64. It does not establish arbitrary-LaTeX support or general security isolation. The peak near 234 MiB remains a capacity concern under the 256 MiB container limit.
- Local checks passed 372 backend tests with 96.46% API coverage, five separate PostgreSQL tests, and 160 frontend tests. Docker checks proved asset exclusions, crash recovery, and the three-retry limit. PR checks remain separate gates.

[CI run 34646076421](https://github.com/SloppyBobbert/TeXGen/actions/runs/34646076421) passed backend, frontend, and real-stack browser checks for `1cc6b6b`. Later commits require their own checks. External review remains a separate gate.

### Current PR7 follow-up — September 11, 2026

[PR #7](https://github.com/SloppyBobbert/TeXGen/pull/7) carries the backend review follow-up, including quota acceptance before START. At `d8d52423e14625ab50d7f3596e5a1331a7ae36db`, local validation passed 403 backend tests with 96.65% API coverage and five separate PostgreSQL tests. Existing Linux ARM64 compiler evidence showed healthy operation with swap disabled; these are separate checks, not a claim of passing current CI.

[CI run 34663945842](https://github.com/SloppyBobbert/TeXGen/actions/runs/34663945842) passed frontend and real-stack browser checks but failed backend on the v1 rejection test: Linux raised `ConnectionResetError` when the server closed with unread payload. This follow-up accepts that reset only for v1, retains EOF and no-runner assertions, and bounds adapter-test worker cleanup. Post-fix local validation passed 403 backend tests with 96.60% API coverage (95% floor); the five PostgreSQL tests were skipped in that local run, not rerun as new PostgreSQL evidence. Focused adapter/server/admission/protocol checks passed 88 tests, and Ruff passed. Fresh CI remains required; earlier green CI for `1f45c49` is historical evidence only.

Phase 2 remains incomplete. Stable generated-section identities, separation of custom content, and further model/view decomposition remain open.

Production targets, shared request throttling, proxy configuration, and deployment verification also remain open.

## Phase 3 — Frontend state, networking, and race-condition cleanup

- [ ] Replace competing document copies with one reducer-backed editor session.
- [x] Version and migrate the local draft format.
- [x] Derive checkbox state, selected counts, and generation payloads from one canonical ordered selection.
- [ ] Centralize API paths, auth headers, token refresh, payload mapping, errors, and cancellation.
- [ ] Remove raw `fetch()` orchestration from UI components.
- [x] Add operation-version tokens and ignore obsolete editor responses (implemented in Phase 1; retain during state consolidation).
- [x] Ensure only the newest generation and compilation can update content or preview (implemented in Phase 1; retain during state consolidation).
- [ ] Abort work invalidated by clear, reset, navigation, or document changes.
- [ ] Preserve the last valid PDF after a failed compile and clean up obsolete object URLs.
- [ ] Model Generate, Compile, Save, Clear, Restore, and Regenerate as explicit transitions.
- [ ] Add reducer, hook integration, save/reload, and stale-response tests.

### Gate

One state owner controls the editor, selection and source cannot silently disagree, and stale asynchronous responses cannot corrupt a session.

## Phase 4 — UI stabilization and component decomposition

- [ ] Fix the inline grid rule that defeats mobile creator layouts.
- [ ] Verify the creator at 320px, 375px, 768px, and desktop widths.
- [ ] Fix Dashboard card and action overflow.
- [ ] Make dialogs usable on short and landscape viewports.
- [ ] Add visible loading, failure, retry, and recovery states.
- [ ] Make selection controls and collapsible groups keyboard-operable.
- [ ] Add an accessible video dialog with focus management and Escape handling.
- [ ] Add live status announcements and reduced-motion behavior.
- [ ] Reduce `CreateCheatSheet.jsx` to a coordinator after state consolidation.
- [ ] Extract formula selection, reorder, layout, editor, preview, resources, and dialog components.
- [ ] Split LaTeX behavior into editor state, rendering operations, history, and PDF lifecycle.
- [ ] Split CSS by feature while preserving the current visual design.
- [ ] Remove dead controls and unused handlers.

### Gate

Creator and Dashboard workflows work on mobile and desktop and are operable using a keyboard.

## Phase 5 — Full validation, CI, and production readiness

- [x] Add App/editor integration tests and a real-backend Playwright smoke journey.
- [ ] Remove conditional and swallowed end-to-end assertions.
- [ ] Complete API permission and compiler-abuse test matrices.
- [x] Consolidate the two CI workflows.
- [x] Standardize Python 3.14 and Node 24 across development, CI, and production.
- [x] Enforce 95% backend coverage as an intentional CI regression floor, not a pursuit of 100% coverage.
- [ ] Run backend lint/tests/security checks and frontend lint/tests/build in one required pipeline.
- [ ] Lock Python dependencies and use `npm ci` consistently.
- [x] Verify and checksum the curated Linux ARM64 Tectonic assets.
- [ ] Create separate development and production container targets.
- [ ] Run Django through a production WSGI/ASGI server and serve static frontend assets appropriately.
- [ ] Add deployment checks, health checks, explicit migrations, and offline compilation verification.
- [ ] Deploy initially to managed Linux containers with explicit resource and concurrency limits.

### Gate

One CI pipeline proves the complete supported workflow, and production images run representative document compilation offline and within enforced limits.

## Deferred work

- Replacing Django or React.
- Introducing microservices before measured need.
- Adding Celery or Redis solely for compilation.
- Adding Redux solely for editor state.
- Migrating to TypeScript as an initial cleanup.
- Building a general-purpose LaTeX parser.
- Redesigning the formula catalog before editor correctness is restored.
- Broad visual restyling during state and responsive repairs.
- Pursuing arbitrary 100% coverage targets.

## Completion criteria

- [ ] Template → edit → topic removal has deterministic behavior.
- [ ] Manual edits are never silently discarded.
- [ ] Clear/reset cannot be reversed by stale responses.
- [ ] Selection controls always match generated payloads.
- [ ] Content, formulas, and layout survive save and reload.
- [ ] Authenticated compilation is isolated, bounded, and rate-limited; PR #7 carries the bounded sidecar controls and quota-acceptance follow-up, but the production gate remains open.
- [ ] Cross-user resource access is prevented.
- [ ] Mobile and keyboard workflows pass.
- [ ] One CI pipeline validates the production workflow.
- [ ] Production images compile representative documents offline.

## Download and installation gate

Saving this plan does not authorize downloads or installations. Before execution, obtain fresh approval for each applicable item with its exact version, source, and measured disk impact:

- Frontend dependencies from the npm registry for `npm ci`.
- Python dependencies from PyPI or the project's selected package source.
- Playwright browser binaries from Microsoft's Playwright distribution source.
- Tectonic binaries, bundles, or package caches from verified official sources.
- Docker base images and supporting service images from their configured registries.

**Download danger summary:** No persisted download or installation is approved by this document. Items exceeding 1 GiB require separate explicit approval even if an earlier, smaller download was approved.
