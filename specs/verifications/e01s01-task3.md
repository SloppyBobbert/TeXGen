# e01s01 task 3 — atomic removal

Revision: `65a4938f11bd3b3817e3ba98b2b5e8fe1afa9783`, unstaged.
Combined tracked diff and new-source identity: `bfb192b4628310b9b4ef6a5a95fae63e6f653a42c3f652b1a465d6221eff3b2d`. Exact manifest: `e01s01-task3-diff.json`.

All removal entry points use the same guard. A valid untouched section is removed conservatively. Edited affected sections require an application dialog; cancel keeps source and selection unchanged. Confirmation checks the source revision and the whole current document/selection signature. Undo restores source, mode, metadata, and selections together. Formula actions pass checked-in IDs, including where display names collide. Class/category bulk removal is one operation.

Ordinary edits retain verified structured mode. Explicit Use raw source preserves bytes and creates history. Raw removals change selections only and explain that source is unchanged. Old or damaged generated content cannot authorize removal. Regeneration asks before replacing nonempty source and records the previous source. Hook history is saved to its browser sidecar. Local persistence notifications update the existing App save boundary so a late remote response cannot overwrite a removal.

Compile requests for raw or section-owned source use raw rendering to preserve bytes. Layout normalization is skipped for these sources; explicit regeneration applies layout changes. Last successful PDF/snapshot remains intact. Existing abort and epoch controls are reused.

## Checks

- RED: `cd frontend && npm test -- --run src/hooks/latex.test.jsx -t 'confirms edited structured removal'`: exit 1; expected missing structured edit behavior. `e01s01-task3-red.log`.
- Gate: `cd frontend && npm test -- --run src/hooks/formulas.test.js src/hooks/latex.test.jsx src/components/CreateCheatSheet.test.jsx src/Phase1Journey.test.jsx`: exit 0, **95 passed**, 0 skipped, four files. `e01s01-task3.log`.
- Background `b7fd41af2`: terminal completed, exit 0. `.pi/tasks/session-50465-50465/b7fd41af2.output`.
- `git diff --check`: exit 0.

The journey covers untouched category removal, edited confirmation/cancel, undo, metadata/selection save mapping, and reload. Hook tests cover stale confirmation and raw-mode authority. Existing race and PDF tests remain. Tests that previously expected mocked raw normalization now require exact source retention, while keeping their abort/PDF assertions. Hook-call contract assertions include the new selection/persistence callbacks explicitly.

The native dialog uses browser modal focus handling, focuses Cancel, supports Escape, and returns focus on close. Real browser keyboard/mobile evidence remains task 5. No independent review is claimed.
