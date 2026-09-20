# e01s01 task 2 — section persistence

Revision: `65a4938f11bd3b3817e3ba98b2b5e8fe1afa9783` (unstaged work).
Tracked diff SHA-256: `99784fc8cf8df06af335506b21469d017bf96bef2606b2691581e9032d31b60f`.
New untracked source files: `backend/api/document_sections.py`, migration `0015_cheatsheet_generated_sections_and_more.py`, and frontend `storage/documentSections.js` / `.test.js`. The final story check must identify all untracked files as well as the tracked diff.

## Changes

Existing fields could not store the last generated source independently of manual edits. Added nullable versioned `generated_sections` metadata to sheets/templates. Legacy rows remain null; comments alone do not grant authority. Metadata stores the exact baseline, not regenerated catalog text. API validation bounds source bytes, marker count, nesting, duplicate identities, catalog IDs, and metadata shape/version. Current source may be damaged or manually changed and stays authoritative; safe-edit validation is separate.

Generation uses checked-in formula IDs, with class/category region identities anchored to the first member ID rather than display labels. Persisted anchors do not change when display names change. Generation response, template creation, save/reload, browser adapters, canonical drafts, and legacy hook storage carry metadata. No compiler, ownership, or quota bypass was added.

## Checks

- Backend RED command: `.venv/bin/python -m pytest --no-cov api/test_generation_contract.py::test_generated_sections_keep_checked_in_ids_and_exact_baseline_on_save_reload` from backend. Exit 1, expected missing stable marker. `e01s01-task2-red.log`.
- Frontend RED: `npm test -- --run src/storage/documentAdapter.test.js` from frontend. Exit 1, expected missing metadata mapping. `e01s01-task2-frontend-red.log`.
- Task-2 backend command: `python3 -m pytest --no-cov api/test_catalog.py api/test_rendering_boundary.py api/test_document_contract.py api/test_document_migrations.py api/test_revision_api.py api/test_generation_contract.py`, using backend/.venv. Exit 0, 53 passed, 0 skipped. `e01s01-task2-backend.log`.
- Task-2 frontend command: `npm test -- --run src/storage src/App.test.jsx src/Phase1Journey.test.jsx`. Exit 0, 60 passed across 5 files, 0 skipped. `e01s01-task2-frontend.log`.
- Added seven API boundary/template regressions after that run. `.venv/bin/python -m pytest --no-cov api/test_generation_contract.py`: exit 0, all 13 passed. `e01s01-task2-metadata-tests.log`. No implementation changed between the task command and this test-only addition.
- `git diff --check`: exit 0.
- Background receipt `b50bc28f6`: completed, exit 0. `.pi/tasks/session-50465-50465/b50bc28f6.output`.

An earlier task-2 frontend run failed because a strict expected request omitted the newly added nullable metadata field. The test now explicitly expects it; assertions were not weakened.

## Analyzer evidence

See `ANALYZER_BASELINE.md` for the parent-verified Django inference findings. Exact per-finding false-positive dispositions clear the active model probe (20 known findings), without ignores, severity changes, or blanket casts. The turn-summary replay still lists old model findings and old line numbers; the supervisor explicitly ruled that cache replay stale. No tool execution was refused.

Other individual Django dynamic-attribute findings were checked with manage.py shell: Template/CheatSheet/PracticeProblem `objects` are Managers; CheatSheet.DoesNotExist is an ObjectDoesNotExist subclass; transaction.atomic() has __enter__/__exit__. Serializer Meta.model exists on both concrete subclasses. These exact inference failures received individual dispositions. A stale unresolved-new-module report was disproved by importing the exact file under the verified interpreter. Response casts and dictionary assertions in the changed tests address DRF response inference. Existing import ordering and exception chaining were corrected where edit checks reported them.

## Remaining gates

Task 3 owns UI atomicity, confirmation, and undo. Task 4 owns full recovery regressions. Full coverage, real-stack browser/compiler tests, and independent review are not passed by this task.
