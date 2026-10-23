# Stage 6 retained-image runtime checks

## Approval

The user approved at most 16 sequential retained-image jobs after the adapter passed code-only checks.
The adapter gate passed in `approved-command-1792441717846519000.log`.
The approval does not permit a download, image pull, image build, staging, commit, push, or deployment.
The application compiler and PDF publication remain disabled.

Use `target/stage6-probes/attempts.jsonl` as the durable attempt ledger.
Do not reset the ledger or its approval and active markers.

## Attempt 1: Canonical document — failed

The canonical version-1 fixture passed validation and used the Rust renderer without changes.
The job used the retained image and requested the approved controls.
Tectonic printed `using only cached resource files`, then returned `Permission denied (os error 13)`.
No PDF candidate was returned. This is not a successful compilation or an asset-compatibility result.

The owned container was removed. The controller confirmed absence and preservation of original Docker identities.
The monitor did not stop the command or report a measurement error.
It ended at 449,794,048 allocated bytes, below the unchanged allowance.
Evidence: `approved-command-1792441983226334000.log`.
Additional evidence is in `target/stage6-probes/preflight-01.json`, `after-01.json`, and `completed-01.json`.

## Attempt 2: Permission and kernel-file diagnosis — completed

Do not repeat the failed compile without a diagnosis.
The locally generated read-only probe has 1,720 bytes, below the approved 4 KiB maximum.
SHA-256: `3b34f70aee5ecf6eec0731807b0f1080034c0a5adadffd230f426b221389499a`.
It was assembled with the installed Apple Clang and wrapped as Linux ARM64 ELF.
No image was built and no binary was downloaded.
ELF header, load-segment, code-preservation, and size self-checks passed.
Evidence: `approved-command-1792442469915621000.log`.

The probe checks fixed bundle, format, input, output, scratch, and cache paths.
It reads only its own process status and the active CPU, memory, swap, and PID cgroup files.
It does not read other processes, credentials, original worktrees, or arbitrary host directories.
The probe ran as UID and GID 10001. Input, output, and scratch opens succeeded.
Both the image bundle and cached format returned EACCES. This isolates the failure to image asset access.
Active kernel files reported CPU quota `100000 100000`, memory `536870912`, swap `0`, and PID maximum `32`.
Effective capabilities were zero. `NoNewPrivs` was 1 and seccomp mode was 2.
These are active kernel settings, not complete functional stress-test results.
Cleanup and original Docker identity comparisons passed.
Evidence: `approved-command-1792442652405547000.log` and `target/stage6-probes/attempt-02/inspect.txt`.
The monitor ended at 449,892,352 allocated bytes.

## Approved asset-access correction

After the diagnostic result, the user approved individual read-only mounts for the existing verified ZIP and format.
These remain shared immutable runtime assets, like the original image files. No per-job asset copies are created.
The 64 MiB input, PDF, diagnostics, and scratch budget remains unchanged. No host directory is mounted.
The image, non-root UID, other resource limits, and original 16-attempt counter remain unchanged.
No rebuild, pull, or download is approved.

`src/compiler/assets.rs` verifies regular-file type, exact size, and pinned SHA-256 before use.
Hash checks use the installed `/usr/bin/openssl` with user configuration disabled; no package was installed.
Both asset files are mounted read-only under scratch. Tectonic's cache directory is redirected to bounded scratch.
The cached format file itself remains read-only.
All 57 compiler checks and strict Clippy passed after this correction.
The live fixture contract check passed; actual live tests remained ignored.
Evidence: `approved-command-1792446727619310000.log`, ending at 450,068,480 monitored bytes.

## Attempt 3: Canonical document with verified asset mounts — passed

The canonical version-1 fixture compiled offline through the bounded Rust adapter.
The candidate is `target/stage6-probes/attempt-03/candidate.pdf`.
Container removal, confirmed absence, and original Docker identity comparisons passed.
Evidence: `approved-command-1792446822185577000.log`, ending at 450,129,920 monitored bytes.
No image build, pull, download, or permission widening occurred.
The host asset files still have mode 0600. Actual container access through the verified mounts succeeded.

The installed PDFKit parser reported one page with a 595.28 by 841.89 point media box and 197 text characters.
Those dimensions match portrait A4. This is actual parser evidence, not a PDF-header-only check.
Evidence: `approved-command-1792446996172557000.log`, ending at 450,162,688 monitored bytes.
Printed readability and the remaining sandbox stress tests are still unverified.

## Attempt 4: Byte-exact raw fixture — passed

The raw fixture used the canonical model and Rust renderer. It did not reuse structured recovery content.
Offline compilation, owned cleanup, and original Docker identity checks passed.
Evidence: `approved-command-1792447020377301000.log`, ending at 450,203,648 monitored bytes.
The candidate is `target/stage6-probes/attempt-04/candidate.pdf`.
PDFKit reported one 612 by 792 point page and 21 text characters.
That is the default US Letter paper from this raw article source; the renderer did not rewrite it to A4.
Evidence: `approved-command-1792447626400016000.log`.
Raw-source preservation does not imply that the structured layout settings control raw TeX output.

## Attempts 5–10: Functional resource probes — passed

The sequential CPU, PID, network, memory, file-size, and scratch cases all passed.
Each case confirmed exact owned cleanup and preservation of original Docker identities.
The controller stops at the first unexpected result. No result is accepted from an unfinished container.
The resource probe is 2,872 bytes, within the same approved 4 KiB maximum.
SHA-256: `8eec4c5ac0914851e0b34487de76c2037ae79007ccb8e834f9431b77d1a68098`.
It was built with installed tools only. No image was built or pulled.
The controller's positive and negative resource-result self-checks passed under normal and optimized Python.
Evidence: `approved-command-1792447412036012000.log`.

Attempt 5 observed CPU throttling increase from 0 to 14 periods while multiple workers contended for the one-CPU quota.
Evidence: `approved-command-1792447611777718000.log`.
Attempt 6 created 31 children plus PID 1; the next clone failed with EAGAIN.
Evidence: `approved-command-1792447618227720000.log`.
Attempt 7 created a socket but its connection failed with ENETUNREACH.
Evidence: `approved-command-1792447622071924000.log`.
Attempt 8 was terminated with exit 137 and Docker recorded `OOMKilled: true`.
The output monitor did not terminate that job. Evidence: `approved-command-1792447625818957000.log`.
Attempt 9 stopped output-file growth at exactly 10,485,760 bytes with EFBIG.
Evidence: `approved-command-1792447633313023000.log`.
Attempt 10 stopped scratch writes at 55,574,528 bytes with ENOSPC.
Evidence: `approved-command-1792447640560840000.log`.
These results exercise enforcement; they are not only requested-control metadata.

## Attempts 11–12: Live cancellation and timeout — passed

Attempts 11 and 12 are the sequential cancellation and timeout fixtures.
The cancellation fixture requires a confirmed running, application-owned container before it sends cancellation.
Their model-contract check and strict Clippy passed; all four live Rust fixtures remained ignored.
Evidence: `approved-command-1792447757485579000.log`.
Attempt 11 confirmed an owned running container before cancellation.
Execution stopped and cleanup completed in 2.549788125 seconds.
Evidence: `approved-command-1792447896037854000.log`.
Attempt 12 stopped an infinite raw TeX loop and completed cleanup in 55.389253958 seconds.
It remained within the original 60-second deadline, including the cleanup reserve.
Evidence: `approved-command-1792447903092295000.log`.
Both controllers confirmed container absence and preservation of original Docker identities.

## Attempt 13: Filesystem and shell absence — passed

Root and source-input write opens failed with EROFS.
Project and home paths, the default and host Docker socket paths, and `/bin/sh` returned ENOENT.
The probe only opened paths; it did not read host file contents.
Owned cleanup and original Docker identity comparisons passed.
Evidence: `approved-command-1792448244736178000.log`, ending at 462,082,048 monitored bytes.
It checks root/input writes, project/home visibility, both Docker socket paths, and shell execution.
The updated executable is 3,532 bytes. Its SHA-256 is `be4dced0770b2ee91cfae7cdfb490715c77fdf628c923763fa29af4b2d5e222a`.
ELF and size self-checks passed in `approved-command-1792448020513739000.log`.
Positive and negative result self-checks passed in `approved-command-1792448156973699000.log`.
No new image was built or pulled.

## Attempt 14: Hostile raw TeX — passed

The hostile raw TeX fixture compiled successfully within the original limits.
It checks a host project path without reading its contents and attempts a shell command inside scratch.
The fixture reports an error if either operation becomes accessible.
Its model-contract check, strict Clippy, and controller self-check passed in `approved-command-1792448341357245000.log`.
The engine test passed in 1.27 seconds. Owned cleanup and original Docker identity checks passed.
Evidence: `approved-command-1792448472571495000.log`.
PDFKit read one US Letter page with 53 text characters, including:
“Host project paths and shell commands were blocked.”
Evidence: `approved-command-1792448689979451000.log`.
Fourteen of the 16 approved attempts are complete. No attempt marker or approval was reset.

## Attempt 15: Real layout diagnostics — passed

The retained engine compiled an intentional overfull box with `--print` enabled.
It exposed `Overfull \\hbox (149.20001pt too wide) detected at line 1`.
Combined diagnostics were 1,596 bytes, below the unchanged 64 KiB limit.
Owned cleanup and original Docker identity checks passed.
Evidence: `approved-command-1792458744351081000.log`, ending at 487,211,008 monitored bytes.
The service rejects this diagnostic instead of replacing the retained PDF; its code test passed separately.

## Protected browser replay preflight — passed without an image job

The protected production router, CSP, two-page canvas preview, overflow warning, raw edits, stale-PDF identification, and PDF/JSON exports passed in installed Chrome with a replay engine.
The preflight asserted that the image ledger was byte-identical before and after the check.
An initial fixture-only failure came from JXA returning `pageCount` as a string.
A bounded diagnostic confirmed two input pages and an output count of two; explicit numeric conversion corrected the fixture check.
Evidence: `approved-command-1792459559320397000.log` and successful rerun `approved-command-1792459613382980000.log`.
This is replay/browser evidence, not another native compilation result.

## Attempt 16: Protected real compiler workflow — passed

The final approved attempt used the protected production UI and router with the actual retained compiler.
The recording engine wrote and synced the active record and ledger before container creation.
The test passed in 7.98 seconds with confirmed owned cleanup and unchanged original Docker identities.
Evidence: `approved-command-1792459736591293000.log`, ending at 489,594,880 monitored bytes.

The browser parsed two actual pages, painted the second page, and warned about the one-page allowance.
Both pages remained intact; no truncation or automatic resizing occurred.
Raw source remained byte-exact. A later raw edit appeared in JSON export while the retained PDF was clearly marked outdated.
The exported retained PDF was 4,981 bytes. Production CSP and unauthorized compilation denial passed.
Report: `target/stage6-probes/attempt-16/browser-report.json`.

The ledger has exactly 16 sequential records and no active marker.
No retry or further agent-driven image execution is approved.
The user approved explicit `--compiler` startup, off by default, with file/image metadata checks and owned shutdown cleanup.
That final startup wiring passed code-only regression in `approved-command-1792462624864765000.log`.
The command ended at 492,019,712 monitored bytes; no browser or container job ran.
The later headless opt-in launcher verification is recorded below. The earlier browser-budget failure remains recorded.

## Actual headless launcher and shutdown signals — passed

`scripts/verify_launcher.py` runs the actual release executable, not a test router fixture.
It sets `TEXGEN_NO_BROWSER=1`; no browser is opened and no launch credential is printed.
Default startup, opt-in initialization with the retained assets/local image metadata, missing-socket fallback, production static assets/CSP, and unauthorized HTTP rejection were checked.
No compile request was sent. Docker container/image/volume identities and the 16-attempt ledger stayed unchanged.
The private job root remained empty and private logs were removed.

The first run found a genuine shutdown failure: SIGTERM exited -15 without entering the cleanup future.
Red evidence: `approved-command-1792516691423063000.log` and `target/launcher-check-1792516693485321000.json`.
The launcher now registers Unix SIGTERM with fallible startup handling and selects it alongside Ctrl-C for the existing cleanup path.
Both signals then exited 0.
Green evidence: `approved-command-1792516884405226000.log` and `target/launcher-check-1792516889922035000.json`.
That command also passed full offline UI/Rust/release checks and self-checks, ending at 475,455,488 monitored bytes.

Authenticated browser availability, the default-browser handoff after opt-in, and native active-job draining were not exercised by this headless probe.
Native execution remains exhausted. A separate fake-engine regression passed with a still-owned active job: shutdown requests cancellation, waits for cleanup, rejects new admission, and remains idempotent.
Targeted/full Rust tests, strict Clippy, release build, controller self-check, and whitespace passed in `approved-command-1792517050410156000.log`, ending at 475,467,776 monitored bytes.
This fake-engine evidence must not be reported as native active-container termination.

## Final compiler-boundary code regression — passed

The locked/offline release Rust suite and strict Clippy passed after the runtime cases.
Formatting, normal and optimized Python controller checks, probe ELF checks, PDFKit self-check, and whitespace checks passed.
Evidence: `approved-command-1792448911495791000.log`.
That command ran no extra image job. Two attempts remained at that checkpoint; the later attempts are recorded above.
This completes current-host compiler-boundary verification, not the browser or clean-host workflow.

## Broader browser regression output incident — failed gate

The later code-only UI, Rust, release, and self-check stages passed before the broad Stage 4/5 browser test began.
Its monitor stopped the command at 505,921,536 allocated bytes to protect the reserve.
The CLI daemon retained Chrome outside that command group. Chrome continued writing the disposable test profile.
A later observation reached 551,874,560 bytes, above the approved 536,870,912-byte limit.
Log: `approved-command-1792461952107241000.log`.

Only the verified test Chrome PID 84358 was terminated. No original browser profile or replacement Rust analyzer was touched.
Only the abandoned test TemporaryDirectory `target/stage4-browser-sthwicne` was removed as owned test cleanup.
Evidence: `target/stage6-browser-budget-incident.json` and `target/stage6-browser-monitor-stop.json`.
No ledger, package cache, runtime asset, original worktree, index, ref, or backup was removed.
The failure remains recorded; cleanup does not convert it to a pass.

The old test harness now owns Chrome directly in the monitored command group and attaches the CLI through CDP.
The later bounded editor-only rerun verified actual Chrome process-group membership and the broader workflow.
The original 512 MiB allowance and 32 MiB reserve still apply. The earlier failed run remains recorded.
This incident did not run another compiler-image job or extend the prior 16-attempt approval.

## Exact cleanup and download-confinement correction

The user approved the 1,037 files pinned in `target/stage6-generated-cleanup-proposal.json`.
Its SHA-256 is `ac19117517b429522f9d2e59d53ee6348cc7f220496f35878319d5ccdaaecc2c`.
The cleanup rechecked every hash before removal: 57 check-only Rust metadata files, 8 completed host-test executables, and 972 duplicate unpacked assets.
All 972 asset files matched members of the retained pinned ZIP byte-for-byte.
Recorded allocation was 67,338,240 bytes. Runtime files, the application, browser fixture, and image ledger stayed byte-identical.
Proof: `target/stage6-generated-cleanup-completed.json`; log: `approved-command-1792473956345020000.log`.
Future full Rust checks must rebuild the removed test/check artifacts offline. No refetch is approved.

The first rerun failed actual JSON-download confinement, not the output monitor.
CDP attachment did not apply the CLI launch-time download directory; Chrome saved a new synthetic 2,479-byte test document in default Downloads.
Creation time, title, and all block data identified it as the new test file, not an original document.
The user separately approved its removal after exact SHA-256 verification.
Incident and cleanup proof: `target/stage6-unconfined-test-download.json` and `target/stage6-unconfined-download-cleanup.json`.
Failure log: `approved-command-1792474047630379000.log`; cleanup log: `approved-command-1792474757851086000.log`.
The harness now sets the absolute private download directory in its new disposable Chrome profile before startup.
The outer cleanup assertion now checks directories only, not the similarly named fixture log.

## Final editor-only browser regression — passed

Evidence: `approved-command-1792474854375489000.log`, exit 0, no monitor stop/error, final allocated output 425,009,152 bytes.
Reports: `target/stage5-browser.json` and `target/stage6-editor-review-result.json`.
The actual JSON and TeX downloads reached the disposable private directory.
Structured/raw editing, mode recovery, clear/import recovery, two-tab ownership, failure handling, keyboard controls, and the 320px layout passed.
Actual Chrome process-group membership and disabled compilation were checked during the run.
Default Downloads metadata stayed unchanged. Private profiles were removed.
The image ledger stayed byte-identical at 16 attempts with no active marker. No compiler, Docker, or image job ran.
The two mobile screenshots were also inspected; this is not a formula-PDF visual or physical print check.

This later success verifies the current editor/browser harness; it does not erase historical budget or confinement failures.
Clean-host verification, dense-formula visual inspection, actual-size printed samples, and actual opt-in launcher repetition remain separate release work.

## Approved artifact reclamation

The user approved removal of exactly the generated attempt-09 file-size output and downloaded Tectonic archive.
Their exact sizes and SHA-256 hashes were checked and saved before removal.
Evidence: `target/stage6-probes/approved-reclaimed-artifacts.json`.
The executable, runtime bundle, cached format, image, manifests, counters, and verification evidence remain.
The host allowance is still 512 MiB with a 32 MiB reserve. The 640 MiB alternative was not approved.
A separate pinned PDF.js package approval is recorded in `PDF_PREVIEW_PACKAGE_PROPOSAL.md`.
The bounded archive fetch, metadata-only cache approval, and offline installation passed. Optional native canvas is absent.
Later approvals permitted removal of the verified PDF.js staging copy and exactly 10 unused source maps; cached archive and runtime files remain.
See `PDF_PREVIEW_PACKAGE_PROPOSAL.md` for those exact records.
Its path, link, size, and integrity self-checks passed under normal and optimized Python.
Evidence: `approved-command-1792450626714765000.log`, ending at 441,171,968 monitored bytes after reclamation.
No new image job is part of package acquisition.

## Current-layout browser replay — passed

The current light layout passed a separate check in installed Chrome.
Evidence: `approved-command-1792730977865080000.log`, ending at 446,713,856 bytes.
Report: `target/current-layout-1792730978554775000/report.json`.
The browser used the live server for static assets and browser-only fixtures for API responses.
It did not authenticate API requests or run a compiler/container job.

Desktop geometry at 1440 px and mobile geometry at 320 px passed without horizontal overflow.
Creation retry retained the page allowance after a failed draft write.
The worker parsed the saved two-page PDF, and both pages painted.
An export failure retained the PDF and selected page. Retry exported the exact saved PDF bytes.
The JSON download matched the active synthetic document. A later edit marked the PDF outdated.
Screenshots: [desktop](screenshots/rust-web-desktop.png) and [mobile](screenshots/rust-web-mobile.png).

Chrome kept its own sandbox and used a closed proxy, DNS blocking, and disabled QUIC.
An external navigation had to fail at the closed proxy before the workflow started.
The profile used 1,560,576 bytes under a 16 MiB polling stop threshold, not a filesystem quota.
The unchanged 512 MiB monitor and 32 MiB reserve still applied.
Default Downloads metadata, listener PID 74798, and the exhausted image ledger stayed unchanged.
The disposable profile was removed. No original profile was automated or refreshed.

An earlier attempt failed the reserve gate at 521,109,504 bytes after Chrome created background model/cache files.
That failure remains recorded in `approved-command-1792727857493924000.log`.
The user approved cleanup of only its abandoned `target/layout-browser-37vyspaq` directory.
Proof: `target/layout-browser-37vyspaq-cleanup-completed.json`.
Later OS-wrapped Chrome attempts failed nested sandbox initialization. Chrome's own sandbox was not disabled to bypass that failure.
The current fixture uses focus and native Enter instead of unreliable pointer coordinates after sticky-pane scrolling.
This replay success does not establish new native-compilation, dense-formula, print, or clean-host evidence.

## PDF metadata tool

The installed macOS PDFKit framework can be accessed through `scripts/pdf_metadata.jxa` without a package download.
Its page-dimension self-check passed in `approved-command-1792442120426318000.log`.
No PDF was opened during that self-check. The subsequent canonical parser result is recorded above.
The script is a macOS verification tool, not the application's cross-platform PDF publication gate.
Default startup does not enable the compiler. Explicit opt-in startup uses the protected service and browser worker; it is not a public deployment.
Printed readability, a clean-host workflow, and historical image-build failures remain separate gates.
