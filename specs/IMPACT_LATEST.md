# Impact assessment

Baseline: main `65a4938`, source tree `e3496d5`. The recovered worktree has the same tracked source tree. Inspection was read-only; application tests were not rerun for this plan.

## Risk: High

Document changes cross persistence, API validation, generation, history, and the editor. A partial update can delete source or make selections disagree with saved content. Add regression tests before changing behavior.

## Modules and contracts

| Module | Purpose and callers | Contract to preserve | Story |
| --- | --- | --- | --- |
| `backend/api/formula_catalog.py` | Resolves catalog records for document validation and generation | Checked-in formula IDs; no runtime identity from names | e01s01 |
| `backend/api/rendering/renderer.py` | Builds documents for `models.py`, `views.py`, and `latex_utils.py` through the rendering export boundary | Deterministic output; raw source retention; bounded marked-document normalization | e01s01 |
| `backend/api/document_contract.py` | Maps canonical and legacy serializer fields | Ordered unique selections, layout validation, revision behavior, readable legacy data | e01s01 |
| `backend/api/models.py`, `serializers.py`, `views.py` | Persist sheets/templates and expose generation/save/compile | Ownership, template policy, source validation, same compiler adapter | e01s01, e01s03 |
| `frontend/src/storage/` | Maps API documents and stores drafts for App and editor hooks | Namespace isolation, schema version, empty selections, recovery | e01s01, e01s02 |
| `frontend/src/hooks/formulas.js`, `latex.js` | Supply selection and source behavior to `CreateCheatSheet.jsx` | Source authority, operation epochs, aborts, PDF snapshots, history | e01s01, e01s02 |
| `frontend/src/App.jsx` | Loads/saves documents and coordinates creator/Dashboard | Revision conflicts and invalidated saves cannot overwrite current work | e01s01, e01s02 |
| `CreateCheatSheet.jsx`, `Dashboard.jsx`, `AuthContext.jsx` | User actions, document requests, and authentication | Existing routes, token rules, dialog focus, error feedback | e01s02 |
| Dockerfiles, Compose, settings, CI | Development stack, isolated compiler, and validation | Sidecar protocol v2, network isolation, quotas, limits, supported ARM64 assets | e01s03 |

## Existing checks to retain

- Backend: `test_catalog.py`, `test_document_contract.py`, `test_document_migrations.py`, `test_revision_api.py`, `test_generation_contract.py`, and `test_rendering_boundary.py`.
- Compiler: `test_compilation_permissions.py`, `test_sidecar_admission.py`, adapter/protocol/server tests, and `tests/test_compile_quota_postgres.py`.
- Frontend: storage tests, formulas/LaTeX hook tests, App tests, creator/Dashboard tests, and `Phase1Journey.test.jsx`.
- Browser: `frontend/e2e/real-stack.spec.js` against the real Compose backend and compiler.

## New checks needed

Stable section identity; untouched versus edited removal; cancel/confirm/undo; damaged marker rejection; raw and legacy retention; confirmation revision races; persisted generated baselines and custom content; keyboard/mobile removal; production configuration failure cases.

## Existing work that must not be duplicated

`latex.js` already aborts requests, invalidates operations, revokes PDF URLs, and publishes successful compile snapshots. The creator already has video-dialog focus references and close handling. Verify behavior before changing these paths.

CI already runs backend lint, audit, coverage, PostgreSQL quota tests, frontend tests/lint/build, and a real-stack browser job. Old unchecked boxes are not evidence of a missing implementation.

The old `render-production` worktree starts from `70c10ec` and changes compiler code. Do not merge or cherry-pick that branch as a deployment shortcut. Reuse only individually verified ideas that preserve the current sidecar controls.

## Design limits

Use checked-in formula IDs for block identity. Establish stable topic identities without coupling them to display names. Persist the last generated baseline so an edited block is not compared with a later catalog version. Never trust client markers as permission, compiler, or quota controls.

A small section utility is justified only if it owns marker validation and conservative edit operations used by all removal paths. A document-wide parser or generic patch framework is not justified.

## Recommendation

Proceed in story order. Before each task, read its full changed functions and callers, verify the current baseline, and update this assessment for any new shared contract.
