# TeXGen Refactoring Plan

Approved: August 25, 2026

## Objective

Prepare TeXGen for a small public production launch without a full rewrite. The work should make template editing, topic removal, manual LaTeX editing, compilation, saving, and reloading deterministic while improving security, maintainability, accessibility, and deployment safety.

## Product decisions

- Require sign-in for PDF compilation and downloads.
- Support structured editing and an advanced raw-LaTeX mode.
- Preserve manual edits by default; replacing source requires explicit regeneration.
- Treat templates as staff-curated and publicly readable.
- Optimize initially for a small public launch on portable Linux containers.
- No existing production data or external API clients require compatibility.

## Confirmed problem areas

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

Phase 1 is not complete. Remaining containment work:

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
- [ ] Create one compiler adapter and remove duplicate Tectonic invocation paths.
- [ ] Keep Django models focused on persistence and views focused on HTTP orchestration.
- [ ] Restrict normalization to known generated documents rather than parsing arbitrary TeX with regexes.
- [ ] Fully isolate Tectonic with offline assets, resource limits, bounded diagnostics, and verified downloads.
- [ ] Add golden document tests and one real offline compilation smoke test.

### Gate

One backend path owns document construction and compilation, and structured documents can remove topics without damaging unrelated manual content.

## Phase 3 — Frontend state, networking, and race-condition cleanup

- [ ] Replace competing document copies with one reducer-backed editor session.
- [x] Version and migrate the local draft format.
- [x] Derive checkbox state, selected counts, and generation payloads from one canonical ordered selection.
- [ ] Centralize API paths, auth headers, token refresh, payload mapping, errors, and cancellation.
- [ ] Remove raw `fetch()` orchestration from UI components.
- [ ] Add request IDs or editor-version tokens and ignore obsolete responses.
- [ ] Ensure only the newest generation and compilation can update content or preview.
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

- [ ] Add App/editor integration tests and a real-backend Playwright smoke journey.
- [ ] Remove conditional and swallowed end-to-end assertions.
- [ ] Complete API permission and compiler-abuse test matrices.
- [x] Consolidate the two CI workflows.
- [x] Standardize Python 3.14 and Node 24 across development, CI, and production.
- [x] Enforce 95% backend coverage as an intentional CI regression floor, not a pursuit of 100% coverage.
- [ ] Run backend lint/tests/security checks and frontend lint/tests/build in one required pipeline.
- [ ] Lock Python dependencies and use `npm ci` consistently.
- [ ] Verify and checksum Tectonic assets.
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
- [ ] Authenticated compilation is isolated, bounded, and rate-limited; production sandbox enforcement remains deferred to PR2.
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
