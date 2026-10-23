# Stage 6 — verified compiler boundary and browser PDF integration

## Start here

1. Use `/Users/brandontran/TeXGen-rust-web` as the working directory.
2. Confirm that the branch is `rewrite/rust-web`.
3. Read `docs/IMPLEMENTATION_STATUS.md`, `docs/RUST_REWRITE_PLAN.md`, and `docs/STAGE5_VERIFICATION.md`.
4. Read `docs/DOCUMENT_FORMAT.md` before changes to the model, editor, or compiler input.
5. Read `docs/STAGE4_VERIFICATION.md` for the retained structured-editor checks.
6. Inspect Git status with `GIT_OPTIONAL_LOCKS=0 git status --short`.

## Current PR corrections — overrides all earlier notes

- GitHub reports PR #19 as merged at `2026-10-23T05:22:41Z`. Its merge commit is `c63542cf03b0bf004ebaf833fa00c439a67a4867`.
- The review used actual base `51716cd51837dfdcabda09479bd752c7297bf9aa` and head `ce4b6129d8de5ac5c4a2e512b3bafde0cb238c86`. Local HEAD remains `92fb47b00682f50d1e20d9dbd4549b9e163e579a` on `rewrite/rust-web`.
- The user approved the review findings, continuous correction work, and a safe commit and push. Publish only the nine approved files on `fix/pr19-lifecycle-recovery`, based on GitHub main `c63542cf03b0bf004ebaf833fa00c439a67a4867`. That base has the verified rewrite tree. PR #19 is already merged, so the fixes need a follow-up PR.
- Use the separate publication worktree at `target/pr19-fixes-publication`. Preserve the implementation worktree and its index. Do not push `rewrite/rust-web` or change existing protected refs. No force push, merge, deployment, or stored-artifact cleanup is approved.
- PDF close now waits for document destruction before worker termination. A one-second fallback bounds a stalled teardown. Focused PDF and retained-preview tests passed: 16 tests.
- Rust layout serialization now matches browser integer and negative-zero encoding. Both validators use a shared fixture at the compact JSON byte limit. Focused document tests passed: 7 Rust tests and 13 UI tests.
- API body collection now has a five-second deadline. It retains the 1 MiB limit and security headers. The deadline does not interrupt compiler execution or cleanup. All 7 focused web tests passed.
- A fake CLI reproduced delayed creation after cancellation and an empty container listing. The adapter now retains unresolved creation state until a successful reply contains a valid ID. Unresolved creation keeps private files and blocks admission, even after owned removal. All 13 CLI tests passed.
- PDF teardown, document byte limits, the incomplete request body, and delayed fake creation each failed their regression checks before correction. Actual daemon timing remains unverified. No native compiler attempt ran.
- The first complete gate passed all 101 UI tests, UI lint/types/formatting, and the UI build. It then failed a Rust formatting check. Log: `approved-command-1792784992184304000.log`. Preservation passed for 23 recorded files, the Git index, refs, and the active marker. The failed report remains at `target/pr-review-fix-verification.json`.
- The Rust formatting correction passed its separate check in `approved-command-1792785170247745000.log`. The repeated complete gate passed in `approved-command-1792785188061910000.log`. It passed catalog integrity, all 101 UI tests, formatting, lint, types, the UI build, strict release Clippy, all offline Rust tests, and the release build. No ignored native fixture ran.
- The complete gate ended at 485,277,696 allocated bytes, below the unchanged cap and reserve threshold. Hash checks preserved all 25 recorded files, including old UI assets, retained probe PDFs, and the exhausted attempt ledger. The Git index, refs, and active marker remained unchanged. Proof: `target/pr-review-fix-verification-1792785230343462000.json`.
- A fresh independent read-only review found no actionable defects in the four corrections. Real-browser font cleanup and native Docker timing remain unverified.
- Keep the 512 MiB cap and 32 MiB reserve. All 16 native attempts remain exhausted. Keep Rust LSP denial and automatic Rust scans disabled. Do not stop replacement analyzers or restart PID `74798`.
- Reviewer records remain untracked under `.pi/`. Do not remove them without exact approval. No original browser profile, stored document, recovery copy, or in-memory PDF was opened or changed.

## Previous handoff — historical evidence and limits

- The user wants the local site working and visually improved, not clean-Mac/release work. Task 13 is deferred. Do not request another machine or resume release gates unless requested.
- The user now authorizes the remaining checks, source staging/commits, normal pushes for the intended PR, and PR creation. Do not merge or deploy. No new compiler-image job, installation, package/browser/font download, or original-worktree cleanup is approved.
- The final complete local gate passed in `approved-command-1792731397681980000.log`, ending at 480,751,616 bytes. `./scripts/verify.sh` passed catalog integrity, all 95 UI tests, UI formatting/lint/types/build, Rust formatting, strict release Clippy, all offline release Rust tests, and the release build. Normal and optimized current-layout harness self-checks also passed. No browser, compiler-image, or ignored native fixture ran in this gate. This does not establish clean-host or printed-readability approval.
- The user approved the 57 hash-listed files in `target/pr-check-metadata-cleanup-proposal-1792725099.json`. Exact cleanup removed 30.87 MiB of unpaired release-check metadata without removing libraries, executables, source, or PDFs. Proof: `target/pr-check-metadata-cleanup-completed-1792725099.json`. Log: `approved-command-1792726635384111000.log`, ending at 444,907,520 bytes. The original index, refs, exhausted image ledger, and listener PID `74798` stayed unchanged.
- The first new Rust run failed because `tests/runtime.rs` required a free port while the user's site occupied it. The test now accepts an existing occupied port and bounds its own child to five seconds. It never stops the existing listener. Red: `approved-command-1792726668911541000.log`. The focused check and full offline release Rust suite passed in `approved-command-1792727379145289000.log`. No ignored native/image fixture ran.
- The current-layout browser check passed in `approved-command-1792730977865080000.log`, ending at 446,713,856 bytes. Report: `target/current-layout-1792730978554775000/report.json`. It checked 1440 px desktop and 320 px mobile geometry without horizontal overflow. Creation retry, two painted PDF pages, exact PDF and matching JSON downloads, export-failure retry, and stale-PDF warnings passed. The private profile used 1,560,576 bytes. The live listener, default Downloads metadata, and exhausted image ledger stayed unchanged.
- This browser check used browser-only API fixtures and a saved two-page PDF replay, not authenticated API requests or a new compilation. Chrome kept its own sandbox. External navigation failed at the closed proxy. Desktop and mobile screenshots were inspected and copied to `docs/screenshots/rust-web-desktop.png` and `docs/screenshots/rust-web-mobile.png`. These synthetic screenshots do not establish dense-formula or printed readability. No original browser profile was used or refreshed.
- Earlier current-layout browser attempts failed. The first fixture setup failed in `approved-command-1792727470878345000.log`. A later run failed the reserve guard in `approved-command-1792727857493924000.log`: exit -9, monitor stop true, 521,109,504 allocated bytes. This stayed below the 512 MiB cap but failed the 32 MiB reserve gate. Chrome created background model/download-cache files despite disable flags. No background asset transfer gained approval from that failure.
- The user separately approved removal of only `target/layout-browser-37vyspaq`. No process or open file remained in that exact owned test directory. Cleanup removed 217 files with 76,021,760 allocated bytes. Proof: `target/layout-browser-37vyspaq-cleanup-completed.json`. Log: `approved-command-1792728823650510000.log`. The running site stayed unchanged.
- OS socket checks allowed loopback and denied external IPv4/IPv6 connections in `approved-command-1792728925584730000.log`. However, OS-wrapped Chrome failed its own sandbox initialization. Failed runs: `approved-command-1792729205071637000.log` and `approved-command-1792729533691595000.log`. The bounded Chrome log confirms `sandbox initialization failed: Operation not permitted`. Do not disable Chrome's own sandbox to work around this incompatibility.
- The current browser harness uses Chrome's documented closed-proxy settings, external DNS blocking, and disabled QUIC instead of the incompatible outer sandbox. A navigation to a reserved external address must fail with `ERR_PROXY_CONNECTION_FAILED` before the workflow starts. Chrome's own sandbox remains enabled. The private profile has a 16 MiB polling stop threshold and fail-closed measurement checks. This is not a filesystem quota. The original output monitor still applies, with no reset or limit change.
- GitHub access is available for public repository `SloppyBobbert/TeXGen`; its default branch is `main`. Remote main `51716cd51837dfdcabda09479bd752c7297bf9aa` differs from protected local main `c8ef11aef18cfb737989610656b4b2ceedb5b3dc`. Publishing the current ancestry would include 251 older commits outside remote main. Use a new clean PR branch with the verified rewrite tree and remote main as parent. Keep existing history and original refs intact. `target/pr-originals-before-publication-1792725099.json` records 17 other indices, 18 worktrees, and 108 refs before publication.
- The earlier pre-PR hygiene pass changed repository text only in `.gitignore`, `README.md`, and this handoff. Python bytecode now stays outside Git status. Existing bytecode files remain on disk. The README now warns that draft recovery does not retain PDFs and distinguishes older browser evidence from the current layout. No staging, commit, push, or PR creation occurred.
- Bytecode-ignore checks went red in `approved-command-1792720212384568000.log` and green in `approved-command-1792720276552175000.log`. Python source and TeX fixtures remain visible to Git. No runtime source or dependency pin changed during this pre-PR pass.
- Safe pre-PR checks passed in `approved-command-1792720305004536000.log`. They covered catalog integrity, all 95 UI tests, UI formatting/lint/types/build, Rust formatting, and shell syntax. Controller, probe-wrapper, package, metadata, and browser-ownership self-checks also passed. The controller checks passed with normal and optimized Python. No browser, native compiler, container, download, or installation ran.
- Final static checks preserved and served all eight old assets with matching hashes. The listener remained PID `74798`. Runtime source, dependency pins, the rewrite index, refs, and the exhausted image ledger stayed unchanged. Eight pending Python files passed syntax checks. Evidence: `approved-command-1792720456287545000.log`. Snapshots: `target/pr-prep-before-1792719939.json` and `target/pr-prep-after-1792719939.json`.
- A secret-pattern scan checked 59 pending source/doc files and found no matches. Positive and negative controls passed for all four patterns. This is not a full security audit or registry vulnerability audit. Evidence: `approved-command-1792720492156056000.log` and `target/pr-prep-secret-check-1792719939.json`, ending at 477,241,344 bytes.
- The earlier pre-PR pass did not repeat full Rust tests or Clippy because they would recreate removed artifacts. The later approved verification includes the full Rust run recorded above. The current light-layout replay check passed. The final complete verification, including Clippy, passed as recorded above. The continuous site guard remains inactive. This work does not establish release readiness.
- Current site check (2026-10-22): branch `rewrite/rust-web`, PID `74798`, and origin `http://127.0.0.1:3737` remain unchanged. The site returns HTTP 200. `target/debug` remains absent. No `local_site_guard.py` process was found. No server, browser, or analyzer was stopped or restarted. Evidence: `approved-command-1792706365387522000.log`, ending at 476,479,488 bytes.
- The previous task `b0bb5cb14` is not registered in this session. The prior process check reported parent PID 1. The current listener remains PID `74798`.
- The running marker is not proof of an active guard. Do not claim continuous storage monitoring is active.
- The user approved removal of only `/Users/brandontran/TeXGen-rust-web/target/debug` after the original budget monitor refused preflight. That cleanup removed about 60.7 MiB of generated Rust files. No Cargo/rustc process was active. The next unchanged monitor run confirmed the directory absent and measured 475,836,416 bytes.
- If an analyzer recreates this directory, obtain fresh approval before cleanup. Keep Rust LSP denial and automatic Rust scans disabled. Do not stop a replacement analyzer.
- The user removed only the session timer. The 512 MiB cap and 32 MiB reserve remain unchanged. Run all new output-producing checks through the original `run_with_budget.py`. Do not reset accounting or verification ledgers.
- `target/local_site_guard.py` is the retained continuous-startup guard, not evidence of an active guard. Preserve `target/continuous-site-*.json`. Do not start another listener. Do not restart this server. Do not refresh the user's tab automatically.
- Creation retry now preserves the selected page allowance after a failed draft write. This applies to first-document creation and Clear replacement. `Editor.create` no longer calls `form.reset()` after an unsuccessful operation. A successful replacement still resets the controls through the existing keyed workspace. The current document and replacement recovery remain unchanged after failure. A successful retry preserves the previous in-memory document in replacement recovery.
- The creation regression failed both failure-path assertions in `approved-command-1792706486722383000.log`. All 16 focused Editor tests, lint, and type checks then passed in `approved-command-1792706528143953000.log`. The TypeScript LSP probe confirmed one clean path and left one path unconfirmed. Do not report a full LSP pass for this change.
- The latest full UI check passed 95 tests, formatting, lint, type checks, production build, and whitespace checks. Evidence: `approved-command-1792706609880557000.log`. No browser or compiler job ran.
- The creation-fix static check preserved all six prebuild assets and verified HTTP 200 with matching hashes for all eight served assets. The listener remained PID `74798`. Document, draft, and editor-session source hashes stayed unchanged. The rewrite index, refs, and exhausted image ledger stayed unchanged. Evidence: `approved-command-1792706663710561000.log`, ending at 477,220,864 bytes. Snapshots: `target/creation-recovery-before-1792706365.json` and `target/creation-recovery-after-1792706365.json`.
- PDF export errors now appear separately from compiler diagnostics. A successful export attempt clears only the export error. The retained PDF, selected page, and compiler diagnostics remain unchanged after a download failure. The outdated-PDF confirmation still applies after document replacement. Red regression: `approved-command-1792634405060679000.log`. Eight focused mocked-PDF tests, lint, and type checks passed in `approved-command-1792634466244169000.log`.
- The earlier PDF-export UI check passed 94 tests, formatting, lint, type checks, production build, and whitespace checks. Evidence: `approved-command-1792634548070366000.log`. TypeScript-only LSP checks reported no diagnostics in the two changed PDF preview files. No Rust check or native compiler job ran.
- Live static checks confirmed the new export-error code in the served entry module. All six assets returned HTTP 200 and matched local hashes. All four prebuild assets stayed byte-identical. The server PID, rewrite index, refs, and exhausted image ledger stayed unchanged. Evidence: `approved-command-1792634629486909000.log`, ending at 476,573,696 bytes. Snapshots: `target/pdf-export-before-1792634405.json` and `target/pdf-export-after-1792634405.json`.
- The earlier PDF-export code check did not include a browser profile, screenshot, or native PDF check. The later current-layout replay review is recorded above. Do not run the broad browser check without sufficient storage headroom. Before a manual refresh, export any required in-memory PDF. No automated refresh occurred.
- The user then requested the old site's appearance. Task 18 recreates its light design: centered Cheat Sheet Generator header, gray pill controls, blue Select Classes panel, left title/class/layout sidebar, large central PDF canvas, and right document/recovery controls. Reference images `ui-final-desktop.png` and `ui-final-phone.png` in the original project's `.pi/site-quality/screenshots` were read only. No legacy components were imported or edited; no fake login/video/theme features were added.
- Old-style layout code evidence: 89 tests, lint, types, formatting/build and live CSS HTTP checks passed in `approved-command-1792611145497510000.log`. Final CSS format/build, whitespace, static mobile sidebar-first order, and live asset checks passed in `approved-command-1792611357398075000.log`, ending at 475,791,360 bytes. Title editing remains outside the disabled structured controls; PDF preview remains mounted across source replacement. Source/draft formats and compiler behavior are unchanged.
- The new-document/page-allowance form is now in the left sidebar for both empty and active documents, outside raw-disabled structured controls. The empty Editor anchor targets its legend. The existing confirmation, writer lock, recovery, and form reset are unchanged. Placement regression went red in `approved-command-1792612103879448000.log`; targeted/full 90-test UI gate, build, and live assets passed in `approved-command-1792612432760284000.log`.
- Open-tab PDF assets are retained during local UI builds with `build.emptyOutDir: false` in `ui/vite.config.ts`. Earlier PDF module GET returned 404; config regression went red in `approved-command-1792613283362996000.log`. Full 91-test UI gate and a real temporary JavaScript probe surviving rebuild passed in `approved-command-1792613425376142000.log`, ending at 475,828,224 bytes. All prior current assets stayed byte-identical; only the newly created probe was removed. See `target/open-tab-asset-check-*.json`.
- Do not empty `ui/dist/assets` while old tabs need those files. Old hashed files now accumulate under the unchanged storage guard; plan approved/versioned cleanup before release. Already-deleted older chunks cannot be recovered by this fix. The user should refresh once, after exporting any needed in-memory PDF; never force reload automatically.
- The earlier three-pane-editor styling and its 88-test evidence (`approved-command-1792605085051829000.log`) are superseded visually, not erased. The running server now serves the old-style design. The user needs to refresh; export any required in-memory PDF first.
- The original redesign check did not include a screenshot/browser visual review. The later current-layout replay review is recorded above. Earlier mobile screenshots and native browser reports predate the redesign. Do not call those artifacts a visual pass for the redesigned layout. No new dependency, font archive, browser profile, compiler job, or deployment was part of the redesign.

- All 16 approved image attempts are consumed. There is no active marker and no approval for another image job or retry.
- Attempt 15 passed bounded real layout diagnostics. Attempt 16 passed the protected real-browser workflow, including both painted pages, overflow, raw edits/JSON, stale-PDF export, CSP, authorization, cleanup, and original Docker identities.
- Final real workflow: `approved-command-1792459736591293000.log`; report: `target/stage6-probes/attempt-16/browser-report.json`.
- The user selected explicit `--compiler` startup. Default startup does not contact Docker. Opt-in checks existing verified assets, local socket/image metadata, and an empty private job directory; unavailable runtime leaves source editing/export available.
- Actual headless launcher checks now pass for default startup, real `--compiler` initialization, missing-socket fallback, and Ctrl-C/SIGTERM shutdown. `TEXGEN_NO_BROWSER=1` prevents opening an original profile; authenticated browser availability was NOT checked in this probe. No compilation request or image job ran.
- The first actual probe found SIGTERM exit -15, bypassing cleanup. Red log: `approved-command-1792516691423063000.log`; report: `target/launcher-check-1792516693485321000.json`. `src/main.rs` now selects Unix SIGTERM alongside Ctrl-C and enters the existing compiler shutdown path. Signal-registration errors fail startup.
- Real launcher and full offline UI/Rust/release regressions then passed in `approved-command-1792516884405226000.log`, ending at 475,455,488 monitored bytes. Green report: `target/launcher-check-1792516889922035000.json`. Docker container/image/volume identities and the exhausted 16-attempt ledger stayed unchanged; temporary logs were removed.
- The focused fake-engine test passed: shutdown cancels a still-owned active job, waits for cleanup, closes admission, and supports repeat shutdown. Targeted/full Rust tests, strict Clippy, release build, controller self-check, and whitespace passed in `approved-command-1792517050410156000.log`, ending at 475,467,776 monitored bytes. Task 14 is complete for headless startup/shutdown scope. No native job was part of this test.
- Code-only UI/Rust/release/self-check stages passed in `approved-command-1792461952107241000.log` before the broad browser stage was stopped. The prior stale `--print` test expectation was corrected without removing its safety assertions.
- The broad Stage 4/5 browser rerun FAILED its output-budget gate. Monitor observation: 505,921,536 bytes. Detached Chrome then continued writing; later observation: 551,874,560 bytes, above the 536,870,912-byte limit.
- Only verified test Chrome PID 84358 was stopped. Only its abandoned disposable directory `target/stage4-browser-sthwicne` was removed as owned test cleanup. Evidence: `target/stage6-browser-budget-incident.json` and `target/stage6-browser-monitor-stop.json`.
- The browser harness now starts owned Chrome in the monitored command group and connects via CDP. It checks actual process-group membership and that the populated editor keeps compilation disabled.
- The user first deferred the rerun, then requested continuation and approved exact cleanup plus editor-only browser review. This later choice supersedes the deferral, not the failed incident record.
- Exact cleanup completed: 57 check-only Rust metadata files, 8 completed host-test executables, and 972 unpacked asset files verified byte-for-byte against retained ZIP members. Total recorded allocation: 67,338,240 bytes. No runtime ZIP, format, compiler, application/browser-fixture executable, package cache, evidence, ledger, original, or backup was removed.
- Proposal: `target/stage6-generated-cleanup-proposal.json`, SHA-256 `ac19117517b429522f9d2e59d53ee6348cc7f220496f35878319d5ccdaaecc2c`. Proof: `target/stage6-generated-cleanup-completed.json`. Cleanup log: `approved-command-1792473956345020000.log`, ending at 424,976,384 bytes.
- Full Rust checks must rebuild the removed test/check artifacts offline; do not run them merely to refill the recovered space. Duplicate subset files remain available inside the verified ZIP; no refetch is approved.
- Browser task `bee4ae558` failed at actual JSON-download confinement, not the output monitor. Log: `approved-command-1792474047630379000.log`. Chrome saved the synthetic 2,479-byte document in default Downloads instead of the private directory. Its title and all block data matched the failing test. The new file's creation time ruled out replacement of an original file.
- Incident: `target/stage6-unconfined-test-download.json`. The user approved removal of only this exact file after SHA-256 verification (`48adc73d9ed524471c9b905804ca73555d291ff3235f2afc07777dad1cf9318f`). Cleanup completed; proof: `target/stage6-unconfined-download-cleanup.json`; log: `approved-command-1792474757851086000.log`.
- The harness now writes the absolute private `download.default_directory` into its new disposable Chrome profile before startup. Its self-check verifies that configuration. The outer cleanup check now tests directories only; the previous wildcard had incorrectly included the fixture log.
- Browser task `b3799c3d2` PASSED under the unchanged 512 MiB allowance and 32 MiB reserve. Log: `approved-command-1792474854375489000.log`, exit 0, no monitor stop/error, final output 425,009,152 bytes. Reports: `target/stage5-browser.json` and `target/stage6-editor-review-result.json`.
- Actual private JSON/TeX downloads, recovery, raw editing, both mode transitions, two-tab ownership, failure recovery, keyboard controls, the 320px layout, and actual Chrome process-group ownership passed. Default Downloads metadata and the 16-attempt ledger stayed unchanged; no active marker remained. The private profile was removed. Compilation stayed disabled; no Docker/image job ran.
- Both mobile screenshots were inspected. This does not verify dense-formula PDF layout or physical printed readability. The successful rerun verifies the current harness, not retrospective compliance of the failed runs.
- No additional image job, allowance reset, persistent cleanup beyond the exact manifest and separately approved stray test file, installation, package download, or public deployment is approved.
- Separate code-only final gate `bdceb9166` PASSED: `approved-command-1792462624864765000.log`, ending at 492,019,712 monitored bytes. UI/Rust/release checks, controller/package/PDFKit/static browser-ownership self-checks, launcher shell syntax, and whitespace passed. No browser/image started in that command. Tasks 9, 10, and 12 have verified current-host evidence; the Stage 6 rollup is complete for that scope. Do not confuse code-only, editor-only, replay, and native compiler evidence. Normal and optimized harness self-checks, shell syntax, and final whitespace checks also passed in `approved-command-1792475173071256000.log`.
- Keep the pinned package/cache/runtime files, all ledgers and evidence, original worktrees/indices/refs, and private backups. No downloads, optional canvas installation, pulls/builds, staging, commits, pushes, or deployment.
- Retain Rust LSP denial. Do not stop replacement analyzers. Historical failures remain recorded. Next release work requires a clean Apple Silicon environment, visual review of dense formula PDFs, and actual-size printed samples with approved body sizes/margins. These checks and authenticated normal-browser handoff after opt-in remain unverified. Actual headless CLI startup/shutdown is now verified separately. Do not claim the whole rewrite or release is complete.

## Earlier interim handoff — superseded; not execution approval

- Compiler-boundary task 9 passed on this host. Fourteen of 16 approved image attempts are complete; only two remain.
- See `STAGE6_RUNTIME_VERIFICATION.md` for actual resource, cancellation, timeout, filesystem, socket, and hostile-TeX results.
- Final locked/offline Rust, strict Clippy, formatting, controller, ELF, PDFKit, and whitespace checks passed in `approved-command-1792448911495791000.log`.
- Task 10 is in progress; blocker 11 is resolved. `pdfjs-dist@6.4.299` installed offline after archive validation and the explicitly approved metadata-only cache warmup. Optional native canvas is absent. See `PDF_PREVIEW_PACKAGE_PROPOSAL.md`.
- The gated preview passed 85 UI tests, typecheck, lint, format, and its production build, including the local worker. Evidence: `approved-command-1792456006172838000.log`.
- Real installed Chrome parsed and painted three existing PDFs, preserved export bytes, and rejected malformed data. That worker-only test used no image attempt and did not verify production CSP. Evidence: `approved-command-1792457481218227000.log`.
- Four service-coordinator tests and strict Clippy passed in `approved-command-1792456270305165000.log`.
- Task `b0d84d1e0` now checks protected compile/cancel routes, health-driven UI availability, worker/font CSP, and detected-overfull rejection. Await its result before changing its code scope. All engines in that check are fake; normal startup still uses the disabled router.
- `spec::COMPILE_ARGS` now adds `--print` for bounded engine diagnostics. A real retained-image retest is pending. Keep the remaining two attempts reserved for diagnostic/layout enforcement and protected application integration.
- The user separately approved removal of the new PDF.js staging archive only after verifying identical cached SHA-512 bytes. That removal is complete. Cached bytes, `verified.json`, and the started marker remain; evidence is `target/pdfjs-package-6.4.299/staging-reclaimed.json`.
- No optional native canvas archives, install scripts, unrelated package archives, image pull/build, staging, commit, push, or deployment is approved.
- The host budget is still 512 MiB with a 32 MiB reserve. The user rejected the 640 MiB alternative.
- Only the two explicitly approved generated files were reclaimed: attempt-09 stress output and the compressed Tectonic archive. Hash/size evidence is in `target/stage6-probes/approved-reclaimed-artifacts.json`.
- Retain the executable, runtime ZIP, cached format, image, manifests, attempt ledger, all original worktrees/indexes/refs, and private backups.
- The user additionally approved only the 10 hash-listed PDF.js `.map` files for removal. Cleanup freed 18,223,104 allocated bytes; proof is `target/pdfjs-package-6.4.299/source-map-cleanup-completed.json`. Runtime code, types, fonts, licenses, and cached archive remain.
- The latest browser-worker command ended at 483,332,096 monitored bytes after private-profile cleanup. Do not reset the allowance or bypass monitoring.
- Protected production-CSP browser workflow, final native integration, startup/drain wiring, clean-host and printed checks remain incomplete. Application compilation/publication are disabled in normal startup.
- Keep Rust LSP denial and automatic Rust scans disabled. Do not stop a replacement editor analyzer; earlier permission applied only to PID 96826.
- Historical image-build budget failures, clean-host verification, printed readability, and final browser checks remain separate gates.

## Earlier checkpoint notes

The following sections record earlier states. They are not a new execution approval.

Stages 1 through 5 passed on the current Apple Silicon Mac.
Commit `5f34d6e` contains the approved combined checkpoint. The working tree was clean at this session's start.
The user then requested continuation after that commit and authorized Stage 6 preparation.
The full rewrite is not complete. Do not resume the old incremental refactor plan.
The user approved one local image build and its restricted version check. That build failed during export.
The user approved cleanup of only the six identified cache records.
The local-context retry exceeded its approved counter limit. That failure remains recorded.
The approved cache cleanup and version check passed. The user retains the one new image.
No new build-cache records remain. Further image builds, downloads, staging, commits, pushes, and deployment remain unapproved.
A later fresh approval permits the limited retained-image tests described below.

## Historical execution approval — exhausted

The user explicitly approved up to 16 sequential retained-image test jobs through the execution-gate question.
This approval applies only after the local Docker adapter passes code-only checks.
Use the retained image only. Keep one job, no queue, 1 CPU, 512 MiB RAM, no swap, and 32 processes.
Each job has a 60-second deadline and a 64 MiB total storage budget.
Keep PDF output at 10 MiB and combined diagnostics at 64 KiB.
A read-only probe executable of at most 4 KiB is permitted if needed, using installed tools only.
No download, image pull, image build, staging, commit, push, or deployment is authorized.
Preserve all original Docker objects and worktrees. Remove only newly created, application-owned test objects.
Count attempts durably before container creation. Do not silently retry or exceed 16 attempts.
All 16 test jobs have now run under this approval. The earlier version check is separate evidence.
No attempts remain. Never reset or extend this count without fresh approval.
The application compiler and PDF publication remain disabled until their safety gates pass.

## Current implementation plan

The user requested continued work in this session with the retained image, not another image build.
Use `docs/RUST_REWRITE_PLAN.md`, Stage 6, as the implementation plan.
Keep real compiler execution and the public compiler API disabled until separately approved isolation checks pass.

1. Add a job-storage budget that accounts for input, PDF output, diagnostics, and a kernel-limited scratch mount.
2. Test the derived source bound against the current canonical document and renderer limits.
3. Add bounded subprocess output, timeout, cancellation, and explicit child reaping.
4. Exercise these behaviors with harmless test processes, not Docker or TeX.
5. Add one-job admission and application-owned file paths without changing the document format.
6. Use the new 16-job approval only after the local Docker adapter passes code-only checks.

Use working-tree red/green checks. Do not commit, stash, download, or rebuild an image for these checks.
The earlier image-build failures remain recorded. This work does not clear that gate.

The offline Rust baseline passed in `approved-command-1792389169116203000.log`.
An automatic Rust checker then created a 200,712,192-byte debug profile outside the approved monitor.
The next monitored test stopped before execution because output exceeded the allowance. It did not establish a red test.
Project `.pi-lens.json` now excludes automatic Rust scans and disables autofix. Rust LSP denial remains active.
Only the new generated `target/debug` directory was removed. No original worktree or source file was deleted.
A subsequent Rust edit did not recreate that profile.

The implemented storage-budget and overflow checks passed in `approved-command-1792390079752405000.log`.
Explicit Rust formatting, release-profile Clippy, and tests must still run through the approved monitor.
The subprocess output-limit test produced the expected assertion failure in `approved-command-1792390456576280000.log`.
Its implementation then passed 11 compiler unit checks and one large-source regression check.
Strict release-profile Clippy also passed in `approved-command-1792433847542388000.log`.
That monitored run ended at 446,332,928 allocated bytes, below the unchanged allowance.

`src/compiler/process.rs` now caps combined stdout and stderr, closes stdin, handles timeout and cancellation,
and waits for child termination. Caller futures must remain alive until this cleanup completes.
A killed Docker client does not prove that its container stopped. Container cleanup and enforcement probes remain pending.
Single-job admission, private job files, the container argument builder, and the lifecycle coordinator now have passing checks.
All 40 compiler checks and strict Clippy passed in `approved-command-1792435575491185000.log` at 446,722,048 monitored bytes.
The admission slice also passed the full Rust suite in `approved-command-1792434473452989000.log`.
The complete Rust suite, strict Clippy, formatting, and whitespace checks passed in `approved-command-1792435859386032000.log`.
A subsequent worker-drop correction passed 42 compiler checks and strict Clippy in `approved-command-1792436244657023000.log`.
Unclean space drop now disables admission, including dropped unpolled or suspended worker futures.
Its complete Rust regression run passed in `approved-command-1792436330786146000.log` at 446,984,192 monitored bytes.
The local adapter then passed 12 metadata and fake-executable checks with strict Clippy in `approved-command-1792441067336156000.log`.
The probe controller passed normal and optimized Python self-checks in `approved-command-1792441670166093000.log`.
The live fixture contract check passed; both actual Docker fixtures were ignored. The full adapter regression gate is running.
Read `docs/STAGE6_CONTROL_VERIFICATION.md` for the exact scope and all red/green evidence.

`src/compiler/cli.rs` now binds the lifecycle to a local Unix socket and the existing Docker CLI.
It checks application ownership before start or removal, verifies requested controls, and confirms absence after removal.
A failed list or inspection is not absence. Foreign ownership never reaches start or removal.

Neovim later created a separate 63,393,792-byte debug cache through workspace Rust analyzer PID 96826.
With explicit user approval, the agent verified and stopped only that analyzer, then removed only the new debug cache.
Neovim, source, release artifacts, original worktrees, and global settings remained unchanged.
Do not terminate any replacement analyzer without approval.

Next: complete the full adapter regression gate, then run `python3 scripts/stage6_probe.py --approved-case canonical`.
This controller uses the approved monitor, reserves attempts before container creation, and checks original Docker identities.
Its `approval.json`, `attempts.jsonl`, and `active.json` files are under `target/stage6-probes/`.
Never reset them to retry. No real attempt has been used yet.
Live Rust fixtures are ignored by ordinary Cargo tests. Invoke them only through the controller.
Use the bounded process runner and retain blocked job files after uncertain cleanup.
Do not release admission on an unknown cleanup result. Do not reset the blocked state to retry.
The lifecycle uses a fake engine in tests. No actual container cleanup or kernel enforcement has been verified.
No public compiler API is enabled.

## Current Stage 6 approvals and findings

The user selected Tectonic 0.17.0 for ARM64 Linux.
The approved job limits are one job, no queue, 1 CPU, 512 MiB RAM, no swap, and 32 processes.
Scratch space is limited to 64 MiB. The timeout is 60 seconds.
The PDF limit is 10 MiB. The diagnostics limit is 64 KiB.
These are approved targets, not verified enforcement.

The local `desktop-linux` context uses a Unix socket.
Docker CLI and engine versions are 29.4.1. The engine uses Linux ARM64 and cgroup v2.
Read-only inspection used no host mounts, network, old sidecar, or TeX compilation.
The cached compiler image is `sha256:194889db4ab16c7f868e2eaf0c7fe7a23e239c99ab5aa36cfdf39e1a39eb15a4`.
Its Tectonic version is 0.15.0. All 364 asset records matched their hashes.
Its manifest does not list `fontenc.sty` or `lmodern.sty`.
Inspection does not approve reuse of that image as the new compiler runtime.

The user approved the official 0.17.0 archive download and executable extraction under `target/stage6-assets/`.
The archive contains 9,926,834 bytes. Its SHA-256 is `b10954a95404f3ab2328d2fa59a5ebab8e657f893fab096f98be8db7c0c979b8`.
Its official source is the [ARM64 Linux release archive](https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-aarch64-unknown-linux-musl.tar.gz).
The extracted executable contains 25,896,944 bytes. Its SHA-256 is `19a2b763e5875fffefaa193c42e460ceba5983d027b6d50b0094130d26ba4e4a`.
The local filename is `tectonic-0.17.0-linux-arm64`. Its mode is `0600`. No host execution or global installation occurred.

The user also approved the 1,276,215-byte [bundle index](https://data1b.fullyjustified.net/tlextras-2022.0r0.tar.index.gz).
Its SHA-256 is `979a52178eb353c803dde1f66efe43ff7ae2ab908000323d4fef29e98e382ebd`.
The first Python request returned HTTP 403 before any index file was created.
The bounded Node request succeeded with the expected ETag. The index expands to 5,143,485 bytes.
The full bundle contains 2,881,562,112 bytes. Its download remains unapproved.

The user approved all 972 range downloads in `target/stage6-assets/asset-download-proposal.json`, with 14,699,888 total bytes.
The proposal SHA-256 is `824a578ab141cc7f3c942cc0adf12abb98ae8ccfb7c30b895f3559724d1a4ddf`.
The source is `https://data1b.fullyjustified.net/tlextras-2022.0r0.tar`.
The expected bundle ETag is `"d05e3fe386482141bf5a66dec029ef49-275"`.
The subset contains Latin Modern runtime fonts, encoding files, and the bundle digest.
The approval excludes the full bundle and unrelated font documentation.
The download passed through the approved monitor with `target/stage6-assets/download-subset.mjs`.
Its self-checks rejected incorrect ranges, sizes, ETags, encodings, and paths.
`subset-downloads.jsonl` records completed files. `verified-subset.json` records all 972 files and their hashes.
An independent local check confirmed every byte count and hash.
The verified manifest SHA-256 is `64419cd03bb5531f42f5d90fc2d77d5e6db7420385a395b650e6bf944982198b`.
The downloaded bundle digest matches the cached assets: `6ffe055852f8faf66c0acbe1a7fb27f87b869a90bad1204f3bf4d9683f597c7c`.
File inspection identified the 0.17.0 executable as statically linked ARM64 Linux ELF.
The subset download passed. A complete offline compilation set remains unverified.

The approved monitor recorded archive, extraction, and index results in these private command logs:
- `approved-command-1792377436913910000.log`: archive size and hash passed.
- `approved-command-1792377603557889000.log`: extraction passed, then the index request returned HTTP 403.
- `approved-command-1792377626146049000.log`: bounded index download passed.
- `approved-command-1792377751480161000.log`: proposal generation passed at 387,948,544 monitored bytes.
- `approved-command-1792377986234034000.log`: all 972 range downloads passed at 405,250,048 monitored bytes.

The user approved local payload preparation from 363 cached assets with 45,315,210 total bytes.
The approved source is the pinned cached image listed earlier.
The approval permits hash checks and combination with the verified 972-file subset under `target/`.
It excludes the old compiler executable, Python, and application code.
`target/stage6-assets/prepare-payload.py` prepares the ZIP bundle and cached format without container execution.
The script checks paths, hashes, sizes, duplicate resources, ZIP contents, and membership in the pinned bundle index.
Payload preparation passed. No container started, and no image build or TeX compilation occurred.
The first two attempts stopped at a comma-encoded cache filename.
The corrected helper accepts commas and retains traversal, exact-allowlist, size, and hash checks.
Its captured-path regression passed before the successful full run.
The failed command logs are `approved-command-1792378451364557000.log` and `approved-command-1792378505290427000.log`.
The successful log is `approved-command-1792378557054845000.log`.
The monitor ended at 444,313,600 bytes without a stop or measurement error.

`target/stage6-assets/payload/bundle.zip` contains 1,324 resources with 30,357,434 logical bytes.
The ZIP contains 14,568,158 bytes. Its SHA-256 is `7547dfdbc9650b30588c107defddf25d4d8cf47712d7ba750d1ba5c1afb6acdb`.
The cached format contains 24,451,466 bytes. Its SHA-256 is `a86ffcac335474fb9fae47cd9986b929719dc3ddf29bfb31123ecc1790ef6bbb`.
`target/stage6-assets/payload-manifest.json` records the exact paths, sizes, and hashes.
Its SHA-256 is `7a79e17689f8a033749f6a6af9be6d57187f1554a4ed6f101e399acc4aa68e75`.
Independent checks confirmed both payload file hashes, ZIP integrity, resource count, and bundle identity.
The runtime files total 64,916,568 bytes with the selected compiler executable.
Docker storage overhead remains unmeasured. These checks do not prove compiler compatibility or isolation.

Retain the verified file hashes and the exact bundle identity.
Reject a server response that ignores the byte range or changes the expected ETag.
The user approved `texgen-compiler:0.17.0-stage6-arm64`, built from scratch with only the three verified runtime files.
`compiler/Dockerfile` defines that image. Its default command is `--version`.
The approved new Docker storage allowance is 256 MiB, including image and build overhead.
The host output allowance remains 512 MiB. No image pull or other download is approved.
The existing local builder uses the Docker driver, Buildx `v0.33.0-desktop.1`, and BuildKit `v0.29.0`.
The build stopped during export. The destination image is absent. The version check did not run.
The command log is `approved-command-1792378949806520000.log`.
The host monitor ended at 444,338,176 bytes without a stop or measurement error.

`target/stage6-assets/image-build-failure.json` records the post-failure evidence.
The image and unshared-cache counters grew by 414,024,384 combined bytes since preflight.
This sum exceeds the selected threshold, but it is not a reliable physical disk measurement.
The monitor added overlapping counters. [Moby PR 52901](https://github.com/moby/moby/pull/52901) describes the image snapshot-accounting problem.
When the build-exit assertion failed, the script lost its exact build baseline, peak, and cancellation reason.
The physical peak and compliance with the 256 MiB Docker allowance remain unverified.

Six new, unused, unshared cache records match this build's steps and creation times.
They report 219,202,240 bytes. Their exact IDs and sizes remain in `image-build-failure.json`.
No image was created after the build began. No pre-existing image or cache was deleted.
The user approved cleanup of those six IDs only, provided each remains unused and unshared.
`target/stage6-assets/cleanup-failed-build.py` records identities before and after the exact-ID cleanup.
The first cleanup selected no records and reported `0B`. All image, cache, container, and volume identities remained unchanged.
Its log is `approved-command-1792379571598804000.log`.
`cleanup-before.json` and `cleanup-after.json` preserve that attempt's snapshots.
BuildKit exposes boolean filter fields by presence, not the strings `true` and `false`.
The helper now uses the exact-ID expression and `private~=^$`, with explicit unused-record checks before deletion.
BuildKit also excludes active records from pruning.

The corrected cleanup passed. Its read-only selector matched exactly the approved six records before deletion.
Its snapshots are `cleanup-retry-before.json` and `cleanup-retry-after.json`.
`image-build-cleanup.json` records the successful identity comparisons.
All six approved records are absent.
The other 325 cache IDs, 52 image IDs, 61 container IDs, and 39 volume-name hashes remained unchanged.
The daemon counters returned exactly to their preflight values.

The successful cleanup log is `approved-command-1792379885671397000.log`.
The host monitor ended at 444,473,344 bytes without a stop or measurement error.
No image-build retry or TeX compilation occurred. The failed attempt's physical peak remains unverified.

The failed `target/stage6-assets/build-image.py` now stops before any Docker command.
Its command-line regression check passed. A replacement requires verified accounting and fresh retry approval.
Preserve existing images, containers, volumes, and unrelated build cache.
Before a new build request, verify the accounting method and output limits.
Obtain new approval before any TeX boundary tests.
Keep PDF compilation disabled until isolation verification passes.

### Local build retry failed — reported-object limit exceeded

`target/stage6-assets/local-build-context/` contains exactly three verified hardlinks to the runtime files.
The hardlinks duplicated no host file data. The local directory method was intended to reduce build-context copies.
That change did not bound the reported-object ledger.
`target/stage6-assets/prepare-local-build.py` tested a conservative ledger against the captured failure and synthetic state changes.
The ledger counts per-ID peak sizes for new cache and image records only.
It ignores global layer counters and retains shared cache records and earlier peaks.
Image/cache overlap can overstate this counter. It is not a physical VM quota.

`target/stage6-assets/local-build-proposal.json` records the proposed method and exact file hashes.
The files contain 64,916,568 bytes. Their measured gzip-6 streams total 29,910,936 bytes.
The planning estimate is 207,480,800 bytes, including copies, compression, and metadata allowances.
This estimate does not certify physical peak use.
The approved reported-object limit is 256 MiB, with a 16 MiB reserve. The host limit remains 512 MiB.

Preparation passed in `approved-command-1792380524443650000.log` at 444,493,824 monitored bytes.
No Docker command or image build ran during that preparation.
The user approved one retry with that reported-object limit, not a physical VM quota.
`target/stage6-assets/build-local-image.py` retains baseline, per-ID peaks, stop reasons, and failure evidence.
Its actual-failure replay and forced-failure audit checks passed in `approved-command-1792380932414296000.log`.
The runner pins the Dockerfile SHA-256: `c0f59de6c763c04fb1a21c4ccd2dfeb25c109330b1e5055a1362efc3ad26ffc9`.
It sends only the Dockerfile through stdin. The three runtime files use the local directory context.

`local-build-approved-attempt.json` identifies the one permitted attempt and its `local-build-audit-*.json` record.
The exclusive attempt marker prevents a second invocation. Do not remove it to bypass the approval gate.
No additional retry is approved.
The local build created image `sha256:e5d0bc4192004f06fc32f2df5bca1dc90b5918daeb6c8072313493d21edf3b31`.
The reported-object ledger then reached 320,387,582 bytes, beyond the approved 268,435,456-byte limit.
The polling guard detected the overrun after export. It did not enforce the cap.
The planning estimate was insufficient. No version check or TeX compilation ran.

The audit is `local-build-audit-20261019T033653537756Z.json`.
The log is `approved-command-1792381013451560000.log`. Host output ended at 444,547,072 bytes.
The audit retained the baseline, per-ID peaks, error, and failed status.
Its cache peaks contain ten IDs. Three transient IDs are no longer present.
`local-retry-cleanup-proposal.json` lists the remaining seven unused cache IDs and the one unused image.
The image reports 95,257,318 bytes and has only the `texgen-compiler:0.17.0-stage6-arm64` tag.

All 325 original cache IDs and 52 original image IDs remain present.
The previous 320,387,582-byte counter overrun remains a failed gate, regardless of any later artifact decision.
The user selected image retention, exact cleanup of the seven remaining cache IDs, and a restricted version check.
`target/stage6-assets/check-retained-image.py` performs only that approved action.
It checks the exact private-record selector, preserves image identities, and verifies the requested container controls before execution.
The version process uses the pinned image, no network, no host mounts, and the approved limits.
The cleanup removed exactly seven approved cache IDs. The pinned image remains.
The restricted check returned `Tectonic 0.17.0` with exit code zero.
`retained-image-check.json` records the successful cleanup and version check.
The log is `approved-command-1792384500059790000.log`. Host output ended at 444,649,472 bytes, within 512 MiB.

All 325 original cache IDs, 52 original image IDs, 61 container IDs, and 39 volume identities remained intact.
The final image count is 53, including the retained compiler image. No temporary version container remains.
The requested controls matched container metadata. Actual kernel enforcement and the compiler boundary remain unverified.
No offline compilation, PDF generation, abuse tests, cancellation tests, or application regression suite ran in this preparation.

`retained-image-action.started` prevents another invocation under the same approval.
The prior build gate remains failed. No additional image execution, build, or TeX input is approved.

Do not retry this polling-only build method or raise its limit.
A new build requires a bounded-output design and fresh approval.
TeX compilation remains unapproved.

## Preservation boundary

Modify only the rewrite worktree. The legacy deletions in its index are intentional.
The user explicitly approved one commit with all current source changes on `rewrite/rust-web` after Stage 5 passed.
This checkpoint combines the previously staged Stage 3 source with the Stage 4 and Stage 5 changes.
Do not stage later changes automatically. Preserve unrelated working files.
Before the approved checkpoint, the rewrite index remained byte-exact throughout Stage 5 verification.
Its verification SHA-256 was `4ce7991412d364c1f207bf5c07a8568bd91285eaa11f31b47c5aa2c53d2eac97`.

Keep all 17 original worktrees, their source and index states, `main`, and checkpoint refs intact.
The original project is `/Users/brandontran/TeXGen`.
Private records remain in `/Users/brandontran/TeXGen-backups/pre-rust-2026-10-17/`.
`REPORT.md` and `verification-complete.json` describe the original preservation checks.
`target/stage5-originals-check.json` records the Stage 5 comparison, including the rewrite index.

The private bundle is `texgen-pre-rust-complete.bundle`.
Its SHA-256 remains `bdd6d12d6ed514a186d6490acf80fc6542d71a01ee7a0a2ad27a96f28adbed08`.
Keep the bundle private. It contains old history with development defaults.
Credentials, databases, real browser drafts, and agent transcripts remain outside the source backup.
Do not access or change them.

Do not run the private `clean_source_stage2.py` helper unchanged.
It stages all source and opens the default browser. Both actions conflict with this boundary.
Use a disposable browser profile and a private download directory for browser checks.

## Confirmed Stage 5 behavior

The user selected disabled return for raw imports without structured recovery before coding.
Keep the raw editor and exports available for those documents.
Explain the missing copy. Use the existing Clear workflow to create a separate structured document.
Do not parse arbitrary TeX into blocks.

One persistent editor session owns the canonical document and monotonic revision.
Raw content owns the complete source string. It accepts incomplete TeX within format limits.
Formula and structured-layout controls remain disabled in raw mode.
Connection errors and retries do not replace the session or its editor controls.

The first structured-to-raw conversion uses the existing Rust renderer.
The response must match document identity, revision, and operation ownership before confirmation.
An atomic draft write saves structured mode recovery and active raw content before memory changes.
Return to structured mode requires confirmation and a structured recovery copy.
That return saves the complete manual source as mode recovery.
A subsequent raw action restores that source instead of generating a replacement.
Its confirmation explains that current structured edits will not merge into retained raw source.
Each transition restores the matching layout and saves the alternate content with its layout.
Identity, title, and page allowance remain current. Only the latest alternate copy remains.

Keep mode recovery separate from the Clear/Import replacement slot.
Mode changes must not update that slot.
JSON export includes only the active canonical document and its mode recovery.
The atomic browser envelope is not a portable document and must not pass JSON import validation.
The browser key remains `texgen.draft.v1`, with `version`, `active`, and `replaced`.
Ordinary edits attempt synchronous saves. No save timer exists.
Ordinary save failures retain in-memory edits and offer export.
Required recovery-write failures stop replacements and mode changes before memory changes.

Edits, replacements, Clear, mode changes, and disposal invalidate earlier file reads and source requests.
Revisions increase even across same-ID imports.
Keep Web Lock ownership across mode changes. Missing or denied locks remain read-only.

## Reuse the existing boundaries

- `src/document.rs`: canonical document format and validation.
- `src/catalog.rs` and `data/catalog.json`: immutable catalog with permanent IDs.
- `src/render.rs`: the only structured TeX path and unchanged raw passthrough.
- `src/web.rs`: protected validation, catalog, and rendering APIs.
- `ui/src/document.ts`: canonical browser validation and portable JSON.
- `ui/src/blocks.ts`: immutable structured operations.
- `ui/src/api.ts`: protected requests and tagged source responses.
- `ui/src/editor-session.ts`: one document owner, revision, both recovery boundaries, and mode actions.
- `ui/src/draft.ts`: atomic browser envelope, separate from portable JSON.
- `ui/src/browser-session.ts`: storage, Web Locks, file reads, and downloads.
- `ui/src/BrowserApp.tsx`: persistent React session and connection status.
- `ui/src/Editor.tsx`: structured and raw controls without HTTP or storage access.

The catalog retains 385 formulas, including the complete unit-circle fragment.
Saved formula copies remain independent of later catalog changes.
Do not add another document representation or an independently editable generated source.

## Verification and output allowance

Run `./scripts/verify.sh` through the private approved-output monitor.
It checks catalog integrity, UI formatting, lint, types, tests, production build, and offline Rust release checks.
The final Stage 5 run passed 71 frontend tests and 27 Rust tests.
It includes the combined-size test and the browser assertion for lock retention after mode changes.
Use `docs/STAGE5_VERIFICATION.md` for the final evidence and remaining limits.

`scripts/verify-browser-stage4.py` now verifies both Stage 4 and Stage 5.
It retains all earlier assertions and extends the installed-Chrome workflow.
It checks actual JSON and TeX files, recovery, two tabs, mode changes, failure injection, and the 320px layout.
The Stage 5 report and screenshot are `target/stage5-browser.json` and `target/stage5-mobile.png`.
The final combined automated and browser run passed.
It ended at 350,720,000 bytes and peaked at 410,714,112 bytes, within 512 MiB.
Its command record is `approved-command-1792373737045234000.log` in the private records directory.

Use explicit CSS targets, standard DOM focus, native keyboard input, and stable tab IDs.
Keep browser-evaluation variables inside functions.
Verify completed download files rather than waiting for an event after the download finishes.
Do not weaken the retained structured checks.
Stage 5 does not repeat the Stage 3 fresh-source build or default-browser launch.
Remote CI and other operating systems remain unverified.

The private `run_with_budget.py` monitors the rewrite directory and approved npm cache.
Its allowance remains 512 MiB. Avoid duplicate debug and release builds.
If cleanup is necessary, remove only new generated artifacts in the rewrite worktree.
Do not clean or reset original worktrees.

## Download and compiler gates

Keep `.cargo/config.toml` offline controls and the Rust language-server denial.
Use explicit locked, offline Rust commands.
The earlier unauthorized diagnostic download incident remains recorded in private `DOWNLOAD_GATE_INCIDENT.md`.
Later approval did not grant retrospective approval for that incident.

Installed tools and exact locked dependencies retain their existing limited approval.
New downloads and installations require exact version, source, measured size, and fresh approval.
Items larger than 1 GiB require separate explicit approval.
The archive, index, and subset approvals apply only to the exact files listed at the start of this handoff.
Other compiler assets, additional Docker images, browser binaries, toolchain installation, and public deployment remain unapproved.
No new download or installation occurred in Stage 5.

Stages 6 and 7 require compiler/runtime decisions, image and asset approval, isolation abuse tests, and printed samples.
Keep PDF compilation disabled until the actual Docker boundary passes verification.
A Docker command or running daemon does not prove that boundary.
Verify the local engine/context, exact image, enforced resource limits, offline assets, cached-only mode,
untrusted mode, cancellation, and cleanup before compilation.
Use application-owned job IDs and scratch locations, not document IDs as file paths.
No native compiler fallback or public deployment is permitted.

Keep source and the last valid PDF after future compilation failures.
Identify stale compiled revisions.
Treat page allowance as a warning target, never permission to remove content.
Keep compilation, automated diagnostics, and visual-review statuses separate.
The A4 and Latin Modern/AMS decisions remain confirmed.
Font-size and printer-margin examples are not approved print limits. Actual-size printed samples remain mandatory.
