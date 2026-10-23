# Rewrite implementation status

## Stage 1: Preservation passed

The private source backup contains verified checkpoints for all 17 original worktrees.
Each worktree has separate HEAD, staged-source, and working-source checkpoints.
A supplementary checkpoint preserves three source patches found inside an agent runtime directory.
No retained stash ref or reflog existed.
All 55 original refs restored into an empty repository.
Original source, index bytes, HEADs, and branch refs remained unchanged.

Complete bundle: `/Users/brandontran/TeXGen-backups/pre-rust-2026-10-17/texgen-pre-rust-complete.bundle`.

Bundle SHA-256: `bdd6d12d6ed514a186d6490acf80fc6542d71a01ee7a0a2ad27a96f28adbed08`.

The private `REPORT.md` records branch names, exclusions, restore results, and local data limits.
The backup does not include credentials, local databases, browser drafts, or agent transcripts.
It does not protect against loss of the computer.

The old frontend baseline passed 48 tests.
The guarded old backend baseline passed 86 tests with 6 warnings.
Both runs used disposable restored source copies without package installation.
The backend test used an existing virtual environment and in-memory SQLite.
It blocked external processes and network connections.

## Download gate incident

An automatic Rust diagnostic check downloaded 18 locked crate archives before approval.
Their total size was 2,311,408 bytes. The check also created 62,130,395 bytes of build files.
This action did not meet the plan's download gate.
The private `DOWNLOAD_GATE_INCIDENT.md` records exact packages and evidence.
The agent then added Cargo offline controls and disabled Rust language-server checks.
A disposable check proved that Cargo rejects an uncached dependency in offline mode.
No global user configuration changed.

The user subsequently approved the remaining exact locked dependencies with a 512 MiB additional-output allowance.
That decision did not grant retrospective approval for the incident.
Docker images, compiler assets, browser binaries, and public deployment remain outside this approval.

## Stage 2: Foundation passed

The isolated worktree is `/Users/brandontran/TeXGen-rust-web` on `rewrite/rust-web`.
The inherited legacy application files were removed only from this worktree after complete backup verification.
The new server and UI were written from scratch.
The implementation uses a stable loopback origin and process-local session authorization.

The protected-launch foundation passed its gate on the current Apple Silicon Mac.
UI formatting, lint, type checks, 6 tests, and the production build passed.
Rust formatting, strict Clippy checks, 5 unit tests, 1 runtime test, and the release build passed.
The occupied-port test stopped before browser launch or credential output.
A real Chrome session verified authorization, URL cleanup, reload, keyboard focus, and the 320px layout.
Live HTTP requests verified rejection of invalid hosts, unrelated origins, and missing authorization.
A fresh source snapshot built with the approved cached dependencies.
The actual macOS launcher opened the default browser and received protected session authorization.
Launcher logs did not contain session credentials.
The CI workflow is defined and pinned to exact action commits. Its remote run is not yet verified.
The latest guarded checks used 370,429,952 bytes of output, within the 512 MiB allowance.
The final preservation check confirmed that all 17 original worktrees and the complete bundle remained unchanged.

The disk monitor first stopped a release build before its allowance was exhausted.
The agent removed only new debug-build output and completed the release build.
A later directory-removal race interrupted the monitor, although the application verification completed.
Regression checks verified the monitor correction. The guarded fresh-source run then passed without a monitor error.

`docs/STAGE2_VERIFICATION.md` records commands, evidence paths, and remaining limits.
No application release is approved.

## Stage 3: Document core passed

The user confirmed A4-only version-1 documents and the Latin Modern/AMS rendering baseline.
The static catalog contains 14 subjects, 76 categories, 385 formulas, and 475 unique permanent IDs.
All converted labels and formula strings matched the saved source, including the unit-circle table.
No Python module was executed during conversion. The new application has no Python runtime dependency.

Rust owns the typed document model, validation, immutable catalog, and deterministic TeX rendering.
TypeScript owns matching document validation, portable JSON encoding, and immutable block operations.
The protected APIs expose catalog retrieval, document validation, and source rendering with document/revision tags.

Raw source remains byte-exact. Recovery content is validated but never rendered.

Local formula edits preserve catalog identity and do not change the catalog.
Formula removal preserves unrelated custom content. Rendering preserves the user's block order.

The complete check passed: catalog integrity, formatting, lint, types, 16 frontend tests, 27 Rust tests, and the release build.
A real browser verified catalog retrieval and the golden TeX response with document ID and revision tags.
The fresh-source UI and Rust release checks passed with the approved cached dependencies.
The actual macOS automatic protected-browser launch passed again.
The latest measured output was 350,650,368 bytes, within the 512 MiB allowance.
The final original-state check confirmed that all 17 original worktrees and the complete backup bundle remained unchanged.

`docs/STAGE3_VERIFICATION.md` records the evidence and limitations.
The LaTeX fixtures have not been compiled. Source checks do not prove PDF layout or printed readability.

## Stage 4: Structured editor passed

The browser now provides structured formula selection, local formula edits, custom text and mathematics,
stable-ID ordering and removal, manual equation breaks, and all structured layout controls.
New A4 documents require an explicit page allowance. The compact candidate has no approved print limits.

One editor session survives connection failures and retries.
The new `texgen.draft.v1` envelope retains the active document and one separate replacement copy.
Ordinary save errors preserve in-memory edits. Recovery-write errors prevent replacement.
Validated JSON import and portable export preserve raw source and mode recovery without exporting the unrelated replacement slot.
An exclusive Web Lock permits one writer. Missing or denied locks remain read-only.
Document ID, monotonic revision, and operation ownership checks reject stale file reads and rendering results.

Catalog integrity, formatting, lint, types, 51 frontend tests, 27 Rust tests, and release builds passed.
The isolated installed-Chrome workflow passed against the real Rust router.
It verified actual JSON and TeX downloads, save/reload, writer handover, recovery, quota failures,
connection retries, a late render reply, keyboard controls, pointer controls, and the 320px layout.
No browser binary or dependency was downloaded.
The browser run ended at 350,564,352 bytes, within the 512 MiB allowance.

The preservation comparison confirmed unchanged original worktrees, checkpoint refs, supplementary source, and the complete bundle.
The rewrite index also remained byte-exact. Stage 4 changes remain unstaged and uncommitted.
`docs/STAGE4_VERIFICATION.md` records commands, evidence, test-driver corrections, and remaining limits.

## Stage 5: Raw editor and confirmed mode transitions passed

The existing editor session now provides complete raw-source editing and confirmed mode transitions.
The first conversion uses the Rust renderer and saves structured mode recovery atomically.
Return to structured mode saves manual raw source before it restores structured content.
A later raw action restores that saved source without generation or a merge of structured edits.
Raw imports without structured recovery cannot return, as the user selected before coding.

Recovery-write failures stop transitions. Ordinary save failures retain in-memory edits and offer export.
The Clear/Import replacement slot remains separate and never enters portable JSON.
Writer locks, monotonic revisions, canonical validation, and asynchronous ownership checks remain active across modes.

The final complete run passed 71 frontend tests and 27 Rust tests, with lint, types, formatting, and release builds.
The extended isolated-browser workflow passed all retained Stage 4 checks and the new Stage 5 checks.
It verified actual raw downloads, both mode recoveries, failure handling, stale replies, and writer-lock retention across mode changes.
The monitored run ended at 350,720,000 bytes and peaked at 410,714,112 bytes, within the 512 MiB allowance.
Original worktrees, refs, supplementary source, the private bundle, and the rewrite index remained unchanged during Stage 5 verification.
No new download, installation, staging, commit, push, or deployment occurred during that verification.
After Stage 5 passed, the user explicitly approved one combined checkpoint commit with all current source changes on `rewrite/rust-web`.
`docs/STAGE5_VERIFICATION.md` records the commands, evidence, and remaining limits.

## Stage 6: Current-host PDF integration and editor regression verified

All 16 approved retained-image attempts are consumed. No further agent-driven image job is approved.
The final protected real-browser workflow passed in `approved-command-1792459736591293000.log`.
It verified two painted pages, overflow without truncation, raw-source preservation and edits, stale-PDF export, production CSP, authorization, and owned cleanup.
The retained-image boundary passed current-host resource and isolation verification.
Canonical, raw, and hostile TeX fixtures produced parser-readable PDFs.
Functional CPU, memory, PID, network, file-size, scratch, read-only filesystem, host-path, socket, and shell checks passed.
Live cancellation and the original deadline passed with confirmed cleanup.
Original Docker identities remained unchanged in every comparison.
The adapter uses four file-only binds: source, output, verified ZIP bundle, and cached format.
No image was pulled or rebuilt for these checks.

The final locked/offline Rust suite, strict Clippy, formatting, controller checks, ELF checks, PDFKit self-check, and whitespace check passed.
Evidence: `approved-command-1792448911495791000.log`.
See `STAGE6_RUNTIME_VERIFICATION.md` for individual attempts and limitations.

The user approved only `pdfjs-dist@6.4.299`, with a 12 MiB archive cap and pinned integrity.
The host allowance remains 512 MiB with a 32 MiB reserve.
The package passed its size, digest, and archive-member checks, then installed offline with scripts disabled.
Optional native canvas packages were not installed. Existing dependency entries stayed unchanged.
Fresh metadata-only and exact-file cleanup approvals are recorded in `PDF_PREVIEW_PACKAGE_PROPOSAL.md`.
The verified cached archive and all runtime assets remain.

The gated preview passed 85 UI tests, strict type checking, lint, formatting, and its production build.
The local worker is bundled without a CDN. Evidence: `approved-command-1792456006172838000.log`.
Real installed Chrome then parsed and painted all three existing candidates, preserved export bytes, and rejected malformed data.
That worker-only check used no compiler-image attempt and did not verify production CSP.
Evidence: `approved-command-1792457481218227000.log` and `target/stage6-pdf-worker-browser.json`.
The four service-coordinator tests and strict Clippy passed in `approved-command-1792456270305165000.log`.

Protected compile/cancel routes, overfull-layout rejection, health-driven availability, and worker/font CSP passed their tests.
Attempt 15 verified `--print` diagnostics within the unchanged 64 KiB limit. Attempt 16 verified the real protected workflow.
Default startup remains disabled. The user approved explicit `--compiler` startup with checked existing assets, local socket/image metadata, and owned shutdown cleanup.
That startup wiring has flag, missing-asset, and image-metadata tests.
The actual release launcher then passed headless default startup, opt-in initialization, missing-socket fallback, protected HTTP rejection, and Ctrl-C/SIGTERM shutdown.
The first real probe found SIGTERM exit -15; `src/main.rs` now routes SIGTERM into the existing shutdown path.
Red evidence: `approved-command-1792516691423063000.log`. Green launcher and full UI/Rust/release evidence: `approved-command-1792516884405226000.log`, ending at 475,455,488 monitored bytes.
No browser or compile job ran; the image ledger and Docker object identities stayed unchanged.
Authenticated browser availability and the default-browser handoff were not checked by that headless probe.

The broad Stage 4/5 browser rerun failed the output-budget gate after the UI/Rust/release/self-check stages passed.
The monitor stopped the command at 505,921,536 bytes, but daemon-owned Chrome continued writing.
A later observation reached 551,874,560 bytes, above the 536,870,912-byte allowance.
Only the exact owned test Chrome was stopped; its abandoned disposable directory was removed as test cleanup.
Evidence: `target/stage6-browser-budget-incident.json` and `approved-command-1792461952107241000.log`.
The harness now owns Chrome directly in the monitored command group. The later bounded rerun verified that ownership.
The budget failure remains recorded. Do not retry the browser test without safe headroom; the 512 MiB limit and 32 MiB reserve remain unchanged.
A separate code-only final gate passed: `approved-command-1792462624864765000.log`, ending at 492,019,712 monitored bytes.
It passed UI formatting/lint/types/tests/build, offline Rust formatting/Clippy/tests/release build, self-checks, launcher shell syntax, and whitespace.
No browser or image job ran in that code-only command. It did not clear the earlier failed browser run.

After exact user-approved cleanup, the corrected broader editor-browser workflow passed in `approved-command-1792474854375489000.log`.
Final monitored output was 425,009,152 bytes, with no monitor stop or error.
Recovery, raw editing, both mode transitions, two-tab ownership, actual private JSON/TeX downloads, failure recovery, keyboard controls, and the 320px layout passed.
Compilation remained disabled; the 16-attempt image ledger and default Downloads metadata stayed unchanged. Private profiles were removed.
Reports: `target/stage5-browser.json` and `target/stage6-editor-review-result.json`.
The correction also addresses the intermediate CDP download-confinement failure; its separately approved test-file cleanup remains recorded.
Historical incidents are not retroactively passed or erased.
Clean-host workflow, printed readability, dense-formula visual checks, authenticated default-browser handoff after opt-in, and historical failed budget gates remain separate.
The rewrite is not complete. No staging, commit, push, or deployment occurred.

### Preparation history — earlier checkpoints, not current approval

Commit `5f34d6e` contains the approved checkpoint through Stage 5.
The user requested continuation after that commit and approved initial compiler limits.
The user selected Tectonic 0.17.0 for ARM64 Linux.
Approved downloads include its 9,926,834-byte archive and the 1,276,215-byte TeX bundle index.
The archive hash passed. Approved extraction produced one 25,896,944-byte executable under `target/`.
No host execution, global installation, or TeX compilation occurred.

Local Docker 29.4.1 runs on Linux ARM64 with cgroup v2.
The inspected cached compiler uses Tectonic 0.15.0. Its asset hashes passed.
Its manifest does not list the renderer's required `fontenc.sty` and `lmodern.sty` files.
The retained image now passes the Tectonic 0.17.0 version check.
Offline compilation and complete asset compatibility remain unverified.
The user approved the 972-file subset and its 14,699,888-byte range download.
The download passed with exact range, size, and ETag checks. All 972 saved files passed an independent hash check.
The monitored download ended at 405,250,048 bytes, within 512 MiB.
Approved local preparation combined the cached assets and new subset into a 1,324-resource ZIP and one cached format.
Their file hashes and ZIP integrity passed independent checks.
The runtime files total 64,916,568 bytes with the selected compiler executable.
The payload run ended at 444,313,600 monitored bytes.
Payload preparation did not start a container, build an image, or compile TeX.
The 2,881,562,112-byte full bundle remains unapproved.

The user approved one local scratch image build and a restricted `--version` check.
`compiler/Dockerfile` copies only the three verified runtime files.
The new Docker storage allowance is 256 MiB. Image pulls and TeX compilation remain unapproved.
The first export stopped. That attempt created no destination image and did not run the version check.
The storage monitor added overlapping Docker counters and did not retain a reliable peak.
Compliance with the 256 MiB Docker allowance remains unverified.
Six identified new cache records report 219,202,240 bytes.
The user approved cleanup of only those six unused, unshared records. The exact-ID cleanup passed.
All other cache, image, container, and volume identities remained unchanged. Daemon counters returned to preflight values.
`target/stage6-assets/image-build-cleanup.json` records the successful comparisons.
`target/stage6-assets/image-build-failure.json` records the failed attempt's evidence.

The user then approved one local-context retry with a 256 MiB conservative reported-object limit and a 16 MiB reserve.
That limit is not a physical VM quota. The host output limit remains 512 MiB.
The three-file local context replaced the tar-stream context. That change did not bound the reported-object ledger.
Actual-failure replay and forced-failure audit checks passed for the replacement runner.
The runner records baseline identities, per-ID peaks, and failure reasons. An exclusive marker permits only one attempt.
The local retry created the image, then recorded 320,387,582 bytes against its approved 268,435,456-byte counter limit.
The polling guard detected the overrun after export. The planning estimate and polling control did not enforce the cap.
No version check or TeX compilation ran.
The audit retained the baseline, per-ID peaks, error, and failed status.
One unused image and seven unused new cache records remain. Original cache and image identities remain present.
The user approved retention of that image, exact cleanup of those seven private records, and a restricted version check.
The exact cleanup and restricted version check passed: Tectonic 0.17.0, exit code zero.
The retained image is `sha256:e5d0bc4192004f06fc32f2df5bca1dc90b5918daeb6c8072313493d21edf3b31`.
All original cache, image, container, and volume identities remained intact. Only the approved image remains as a new Docker artifact.
The requested controls matched container metadata. Actual kernel enforcement and safe compilation remain unverified.
The final host output was 444,649,472 bytes, within 512 MiB.
The prior build-budget gate remains failed. No further image execution, build, or TeX compilation is approved.

Start in `/Users/brandontran/TeXGen-rust-web` and read `docs/NEXT_SESSION.md` for exact approvals, limits, hashes, and evidence.
Stage 6 compiler-control helpers now implement storage budgeting, bounded process output, timeout, cancellation, one-job admission, and private job files.
The container argument builder pins the retained image and requests the approved controls with two file-only mounts.
The lifecycle coordinates creation, execution, container removal, and file cleanup through a test engine.
Uncertain cleanup disables future admission, even after the failed result is dropped.
The full Rust suite, strict Clippy, formatting, and whitespace checks passed after the initial control slices.
A worker-drop correction then passed 42 compiler checks and strict Clippy at 446,980,096 monitored bytes.
Unclean job-space drop now disables admission without deleting files or claiming container removal.
The complete regression rerun for this correction is pending.
`docs/STAGE6_CONTROL_VERIFICATION.md` records the red/green checks, budget incident, and remaining limits.
The local Docker adapter, actual isolation verification, and public compiler integration remain pending.
The compiler and complete workflow remain pending. The whole rewrite is not complete.

The approved job limits still require runtime enforcement checks.
Offline compilation, isolation abuse tests, cancellation, clean-host verification, and printed samples remain mandatory gates.
Future image builds require a bounded-output design and fresh approval.
This preparation did not repeat the Stage 5 application regression suite.
PDF compilation remains disabled. No release or public deployment is approved.
