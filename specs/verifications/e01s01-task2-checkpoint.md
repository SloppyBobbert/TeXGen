# e01s01 task 2 — blocked checkpoint

Status: blocked at an analyzer gate. Task 2 is NOT passing. No commit or staging.

Revision: `65a4938f11bd3b3817e3ba98b2b5e8fe1afa9783`.
Tracked diff SHA-256: `a4c24f26bfcad986e8c624f528bd3d981f25558228992debc1907bfc6a0c27ed`.
`git diff --check`: exit 0.

## Verified RED

Command, from worktree root:

```sh
cd backend && .venv/bin/python -m pytest --no-cov \
  api/test_generation_contract.py::test_generated_sections_keep_checked_in_ids_and_exact_baseline_on_save_reload
```

Exit 1. One collected test failed at the intended assertion: generated output does not contain `% @texgen-section v1 begin f:algebra-i.slope-formula`. Log: `e01s01-task2-red.log`. This run preceded renderer and model changes. No GREEN result exists.

The test requires versioned formula boundaries, exact generated baseline, and save/reload retention. Existing DRF response values in this file now use `typing.cast(Response, ...)`; assertions also verify dictionary response bodies. This is a targeted correction for the analyzer's APIClient return inference. No runtime assertions were removed. Active LSP check of the test file returned zero errors.

## Partial source changes

- `backend/api/rendering/renderer.py`: begin/end boundaries around class, category, and formula regions. Formula IDs are checked-in IDs. Group boundaries use an existing member ID as an anchor; display names are not identity. This is preliminary, not an accepted complete section contract. Parser/validator, duplicate/ordering checks, and catalog-change tests are not implemented. Callers without IDs retain legacy output. Import ordering uses collections.abc.
- `backend/api/models.py`: one nullable `generated_sections` JSON field on each of Template and CheatSheet. **Migration, serializer validation, API response, and persistence wiring do not yet exist. Do not deploy or run this partial model change as a finished feature.**
- `backend/api/test_generation_contract.py`: RED regression and response typing noted above.
- `pyrightconfig.json`: selects the verified `backend/.venv` instead of the nonexistent `backend/venv`; excludes the local environment. No diagnostics were suppressed or reduced.

Frontend application code remains unchanged. Removal, mode switch, confirmation, history, and recovery are not implemented. The accepted mode decision is recorded in the story file.

## Exact analyzer gate

Before model edits, `lens_diagnostics(source=lsp, scope=paths, paths=[models.py, views.py], severity=error)` found 20 model errors and 11 view errors (10 Pyright, one auxiliary). They are present in unchanged baseline content. After adding only the two JSON fields, the edit extension returned:

> STOP — 41 issue(s) must be fixed

A fresh model-only active LSP probe returned **20 errors**, all at pre-existing expressions; no error names the added fields. The edit output appears to aggregate repeated findings; use the active 20-error list as the distinct current model evidence.

Current model locations and diagnostics:

| Lines | Code | Message |
| --- | --- | --- |
| 17, 20, 21, 67, 74, 75, 123 | reportArgumentType | Literal integer defaults cannot be assigned to `type[NOT_PROVIDED]` |
| 40, 91 | reportIncompatibleMethodOverride | Model `__str__` returns inferred CharField rather than str |
| 96 | reportAttributeAccessIssue | TextField has no `strip` |
| 104 | reportAttributeAccessIssue | CheatSheet has no `problems` reverse relation |
| 108 | reportArgumentType | TextField cannot be assigned to source_latex: str |
| 109 | reportArgumentType | CharField or literal mode cannot be assigned to source_mode: str |
| 110 | reportArgumentType | CharField cannot be assigned to title: str |
| 111 (six arguments) | reportArgumentType | IntegerField/CharField cannot be assigned to LayoutSpec int/str parameters |
| 129 | reportAttributeAccessIssue | ForeignKey has no `title` |

Baseline byte identity check: removing exactly the two added JSON-field lines from current models.py reproduces HEAD byte-for-byte. Baseline models.py SHA-256: `72d84ae73ba3c35341371260638633b320df5f054978451fa6e53513165fb737`. Current views.py is also byte-for-byte HEAD; SHA-256: `18978b0f49acc4b40b00714fc81d6c977954a621159401ccbe420790ef93621b`.

Correcting the environment selection did not remove the findings. `effective_config(file=backend/api/models.py)` reported zero configuration override documents and selected built-in Python/Pyright/Jedi plus auxiliary analyzers. No new typing packages, blanket casts, ignores, or severity changes were added. Supervisor directed this worker to save a checkpoint and pause while the parent inspects the analyzer gate.

## Resumption

1. Resolve the mandatory analyzer gate without hiding findings or rewriting unrelated model typing.
2. Complete task 2's versioned section contract, migration, API validation, and frontend draft/server adapters. Existing fields cannot store a separate last-generated baseline; the new nullable field is only a starting point.
3. Re-run the RED regression to GREEN, then all task 2 commands. Do not mark it passing before those checks succeed.
4. Complete tasks 3–5, including real compiler/browser checks. Independent review remains parent-owned.

## Resources

See `e01s01-task1.md`. Worker-owned Compose project `texgen-e01s01-document-sections` has only db running, loopback port 55439. Override `.pi/e01s01-compose-test.yaml`. Parent-owned Docker Desktop must remain running. No worker background commands remain active. Local Python environment, copied node_modules, and isolated browser assets remain available for continuation.
