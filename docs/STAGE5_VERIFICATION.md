# Stage 5 verification

Status: Stage 5 passed on the current Apple Silicon Mac.
No Stage 6 implementation occurred. PDF compilation remains disabled.

## Decision and implementation

Before coding, the user selected disabled return for raw imports without structured recovery.
The editor explains this limit. Clear can create a separate structured document through the existing replacement path.
The application does not parse arbitrary TeX into blocks.

The existing editor session owns raw content, revision, recovery, and operation identity.
The raw textarea edits the complete source through canonical validation and ordinary draft saves.
Incomplete TeX remains editable. Formula and structured-layout controls remain disabled in raw mode.
Connection retries do not replace the editor session.

The first conversion obtains structured source from the existing Rust renderer.
The session validates the response tags and complete converted document before confirmation.
One atomic envelope write saves active raw content and structured mode recovery before memory changes.
Return to structured mode requires confirmation and preserves active manual source as mode recovery.
A later raw action restores that retained source without generation or a merge of structured edits.
Confirmation explains which content becomes active and which content becomes recovery.

Each transition restores the matching layout. Identity, title, and page allowance remain current.
Revisions increase across transitions and replacements. The draft writer lock remains held.
Mode changes preserve the separate Clear/Import replacement slot.
Portable JSON contains the active document and its mode recovery only.
The canonical model, Rust renderer, HTTP contracts, storage key, and portable JSON format remain unchanged.

A required recovery-write failure stops the mode change and offers JSON export.
Ordinary save failures retain in-memory source. Retry and export remain available.
Edits and mode changes invalidate earlier file reads and source requests.
Source responses require matching document identity, revision, and operation ownership.

## Automated checks

The monitored formatter and `./scripts/verify.sh` returned zero.
The checks passed:

- Catalog digest, counts, permanent IDs, and unit-circle content.
- UI formatting, lint, and TypeScript checks.
- 71 frontend tests across five files.
- Production UI build.
- Rust formatting and strict release-profile Clippy checks.
- 27 Rust tests and the release build.

The new tests cover both mode transitions, cancellations, recovery-save failures, and unsaved source.
They also cover JSON transfer, replacement separation, raw limits, missing locks, and stale asynchronous replies.
Existing structured-editor tests remain intact.

Command record:
`/Users/brandontran/TeXGen-backups/pre-rust-2026-10-17/approved-command-1792373737045234000.log`.
The matching `.json` file records the command, exit code, and disk measurements.
The final command ran the formatter, `./scripts/verify.sh`, and the extended browser harness in sequence.
The monitor reported no stop or measurement error.
The run ended at 350,720,000 bytes and peaked at 410,714,112 bytes, within the 512 MiB allowance.
The combined-size test also passed.
If source plus recovery exceeds the canonical JSON limit, conversion stops before confirmation.

An active LSP check examined the four changed TypeScript files and the browser harness.
The final probe returned no inconclusive results or compiler errors.
Existing FormEvent deprecation hints, project import-style warnings, and structural hints remain outside this stage.
Explicit TypeScript, ESLint, and release checks passed.

## Browser checks

The extended harness remains `scripts/verify-browser-stage4.py`.
It retains the Stage 4 assertions and adds the Stage 5 workflow.
It uses installed Chrome, a disposable profile, and private downloads under `target/`.
It does not read real browser drafts or install a browser.

Run it through the approved monitor:

```sh
python3 /Users/brandontran/TeXGen-backups/pre-rust-2026-10-17/run_with_budget.py python3 scripts/verify-browser-stage4.py
```

The final extended browser run passed, including the writer-lock assertion after mode changes.
Reports are `target/stage5-browser.json` and `target/stage5-mobile.png`.
The [automated-check record](#automated-checks) also contains the final browser result.
The earlier standalone browser run also passed at 350,699,520 bytes.
Its log is `/Users/brandontran/TeXGen-backups/pre-rust-2026-10-17/approved-command-1792373499958350000.log`.

The real browser verified:

- All retained Stage 4 structured controls, custom content, recovery, exports, and layout assertions.
- Conversion cancellation, canonical Rust source, manual raw edits, and save/reload.
- Actual JSON and byte-exact raw TeX files in the disposable download directory.
- Both transition cancellations, recovery-write failures, unsaved source export, and save retry.
- Return to structured content and restoration of manual raw source without a merge.
- Both mode recoveries through JSON export and import, with the unrelated replacement slot excluded.
- Disabled return for raw imports without structured recovery.
- A read-only raw tab and persistent raw controls through connection errors and retries.
- Retained writer ownership after repeated mode changes. The reader still cannot obtain the writer lock.
- Rejection of a late conversion reply and an invalid response identity.
- Clear/Restore with raw content, keyboard operation, and the 320px layout.
- Continued PDF compilation disablement.

## Preservation and limits

`target/stage5-originals-check.json` records the final passing preservation comparison.
`target/stage5-final-source.json` records the verified UI, test, and harness file hashes.
All 17 original worktrees retained their source, index bytes, HEADs, and original refs.
Checkpoint refs, supplementary source, and the private complete bundle also matched.
The bundle SHA-256 remains `bdd6d12d6ed514a186d6490acf80fc6542d71a01ee7a0a2ad27a96f28adbed08`.
During Stage 5 verification, the rewrite index remained byte-exact: `4ce7991412d364c1f207bf5c07a8568bd91285eaa11f31b47c5aa2c53d2eac97`.
No staging, commit, push, deployment, or original-worktree cleanup occurred during that verification.
After Stage 5 passed, the user explicitly requested one combined checkpoint commit with all current source changes.
That request permits staging and committing in the rewrite worktree only. It does not authorize a push or deployment.

Cargo remains offline. Rust language-server checks remain disabled.
No new dependency, browser binary, compiler asset, image, or toolchain was downloaded or installed.
No compiler, Docker boundary, overflow check, printed sample, or printer-margin approval ran.
Remote CI, independent review, clean-machine builds, and other operating systems remain unverified.
Browser draft recovery remains subject to quota, eviction, browser cleanup, and private-session loss.
