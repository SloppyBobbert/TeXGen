# Stage 4 verification

Status: Stage 4 passed on the current Apple Silicon Mac.
The raw editor and PDF compiler remain outside this stage.

## Implemented boundary

The structured editor uses the existing canonical document and immutable block operations.
Catalog selection and topic counts derive from formula blocks.
Formula edits remain local to the document. Custom content remains independent of catalog selection.
The editor supports stable-ID movement, removal, manual equation breaks, and all structured layout fields.
Each new document requires an explicit page allowance. Version 1 remains A4-only.
The compact candidate is not an approved print preset.

One editor session owns the document and its monotonic session revision.
Connection retries do not replace that session or its controls.
File reads and render requests carry document, revision, and operation ownership checks.
Edits, replacement, Clear, and disposal invalidate earlier operations.

The new `texgen.draft.v1` key stores one atomic envelope with active and replaced documents.
The application does not read or change legacy keys.
Ordinary save failures retain in-memory edits and display a portable export action.
A failed recovery write prevents replacement and preserves both previous copies.
Restore exchanges the active and replaced documents after confirmation.

An exclusive Web Lock protects the browser draft across document replacements.
A new writer reloads the draft while it holds the lock.
Missing or denied locks leave the session read-only.
Storage notifications refresh readers but never grant writer ownership.

Document JSON includes the active canonical document and its mode recovery only.
It excludes the unrelated replacement document.
Raw imports retain complete source and mode recovery. Structured controls remain disabled for raw source.
TeX export uses the Rust renderer for structured documents and unchanged source for raw documents.
No action invokes a compiler.

## Automated checks

`./scripts/verify.sh` passed after the lock-test correction:

- Catalog integrity.
- UI formatting, lint, and TypeScript checks.
- 51 frontend tests across five files.
- The production UI build.
- Rust formatting and strict release-profile Clippy checks.
- 27 Rust tests and the release build.

The new tests cover storage errors, recovery-write errors, invalid imports, oversized imports,
raw recovery portability, export boundaries, same-ID replacement, stale file reads, stale render replies,
missing locks, denied locks, writer handover, stable block IDs, layout reload, and connection retries.
The writer-handover test waits for the test lock's release promise, not an assumed number of microtasks.

The final successful automated-check log is:
`/Users/brandontran/TeXGen-backups/pre-rust-2026-10-17/approved-command-1792359096033357000.log`.
The command returned zero. The monitor reported no stop or measurement error.
It ended at 350,572,544 bytes, within the 512 MiB allowance.
The separate successful browser run is recorded in the next section.

## Browser checks

Run the harness with the approved output monitor:

```sh
python3 /Users/brandontran/TeXGen-backups/pre-rust-2026-10-17/run_with_budget.py python3 scripts/verify-browser-stage4.py
```

The harness uses the real Rust router, installed Chrome, and a disposable profile under `target/`.
Its download directory also remains under that disposable directory.
It installs nothing and does not use real browser drafts.

The complete browser workflow passed. Reports are `target/stage4-browser.json` and `target/stage4-mobile.png`.
The browser log and monitored command record are:
`/Users/brandontran/TeXGen-backups/pre-rust-2026-10-17/approved-command-1792359049501134000.log` and its `.json` file.
The command returned zero. The monitor reported no stop or measurement error.
It ended at 350,564,352 bytes, within the 512 MiB allowance.

The real browser verified:

- Protected authorization, clean URLs, and HTTP rejection checks.
- Explicit page allowance, local formula edits, manual line breaks, custom blocks, and stable-ID movement.
- Topic removal without loss of custom content.
- The complete unit-circle fragment in the active document and rendered source.
- Every manual layout field and page allowance through save/reload.
- Actual JSON and TeX files in the private download directory.
- A read-only second tab, reader refresh, writer closure, and ownership handover with the latest draft.
- Clear, Restore, invalid import, raw import, mode recovery, and portable export boundaries.
- Injected quota errors during ordinary save and replacement recovery.
- In-memory export after a save error, followed by a successful save retry.
- Connection retries without replacement of the editor controls.
- Rejection of a late rendering response even when the simulated request ignores cancellation.
- Keyboard activation, a separate in-view pointer action, and no horizontal overflow at 320px.
- Continued PDF compilation disablement.

Earlier browser runs stopped at test-driver and harness errors.
The installed driver rejected selector syntax, a documented focus subaction, and positional tab integers.
The corrected harness uses explicit CSS targets, standard DOM focus, native keyboard events, and stable tab IDs.
Its evaluation variables remain inside functions.
It checks completed download files rather than waiting for an event after the download finished.
These corrections did not require application-code changes.

## Preservation

`target/stage4-originals-check.json` records the successful original-state comparison.
All 17 original worktrees retained their source, index bytes, HEADs, and original refs.
The checkpoint refs, supplementary source patches, and complete backup bundle also matched.

The rewrite index remained byte-exact against the session baseline:
`4ce7991412d364c1f207bf5c07a8568bd91285eaa11f31b47c5aa2c53d2eac97`.
The new Stage 4 changes remain unstaged. No commit, ref change, or push occurred.
The rewrite `.gitignore` now excludes `/.pi/tasks/` so generated task logs do not enter source snapshots.

## Remaining limits

No PDF compilation, overflow detection, printed-readability approval, or printer-margin approval occurred.
No raw-editor transition is implemented in this stage.
The browser checks cover the Stage 4 workflow, not a completed PDF workflow.
Stage 4 did not repeat the Stage 3 fresh-source build or open the default browser.
Browser draft recovery remains subject to quota, eviction, browser cleanup, and private-session loss.
Synchronous saves avoid timer races but do not make browser storage a durable backup.

Remote CI, independent review, a complete dependency vulnerability audit, clean-machine verification,
and operating systems other than the current Apple Silicon Mac remain unverified.
The initial pre-approval diagnostic download incident remains recorded.
No new dependency, browser binary, compiler asset, or container image was downloaded for Stage 4.
