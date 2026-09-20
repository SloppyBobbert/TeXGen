# e01s01 task 4 — recovery and source authority

Revision: `65a4938f11bd3b3817e3ba98b2b5e8fe1afa9783`, unstaged.
Combined diff/new-source identity: `986ff58569ab9d047eab543822bb001cb8341a13b28bbf383b080eb0b5e5810d`. Manifest: `e01s01-task4-diff.json`.

Added boundary/order/duplicate/unknown-ID and empty-group regressions; saved-baseline catalog-label independence; raw draft reload; damaged draft retention; and late server-save reconciliation after atomic removal. Structured source, including damaged markers, is never normalized by the backend layout helper. Raw compilation keeps exact source bytes. Unsafe markers preserve source and selections; explicit regeneration keeps a recovery history entry.

## Checks

Commands run with backend/.venv first on PATH.

- From backend: `python3 -m pytest --no-cov api/test_rendering_boundary.py api/test_document_contract.py api/test_document_migrations.py api/test_compilation_permissions.py api/test_sidecar_admission.py api/test_document_sections.py`: exit 0; **69 passed**, 0 skipped. `e01s01-task4-backend.log`.
- From frontend: `npm test -- --run src/hooks/latex.test.jsx src/storage src/App.test.jsx src/Phase1Journey.test.jsx`: exit 0; **98 passed**, 0 skipped. `e01s01-task4-frontend.log`.
- Two further draft-only regression tests were then added. `npm test -- --run src/storage/draftStore.test.js`: exit 0; **21 passed**, 0 skipped. `e01s01-task4-draft-tests.log`. No implementation changed after the full focused run.
- `git diff --check`: exit 0.
- Background receipt `b7751b644`: completed, exit 0; `.pi/tasks/session-50465-50465/b7751b644.output`.

The section utility uses bounded marker parsing, not a TeX parser. It rejects altered marker topology and changed wrapper text. Custom bytes remain outside removal spans. Removal compares current content with the exact saved baseline, not current catalog text. All incoming baseline IDs are catalog-validated at the API boundary; source and baseline retain compiler size limits. No permission, quota, or compiler selection policy changed.

## Real-stack preparation

Copied the already verified compiler tree into this worktree. `python3 -S backend/compiler_sidecar/container/verify_assets.py backend/.compiler-assets`: exit 0. Added local size: 81680 KiB; the shared original was not changed. The Compose override reserves loopback ports 58000 (backend), 55173 (frontend), and 55439 (PostgreSQL). `docker compose ... config --quiet`: exit 0. Its standard Compose `!override` tags received targeted YAML false-positive dispositions after validation. No new services were started for this task.

Full suite/coverage and real-stack tests remain task 5. Independent review remains parent-owned.
