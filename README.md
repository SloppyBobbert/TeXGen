# TeXGen

TeXGen is a full application rewrite with a Rust server and a new TypeScript browser UI.
The current build provides structured and raw editing, a protected local connection, browser draft recovery, and an opt-in Docker compiler with PDF preview/export.
The Stage 4 and Stage 5 editor and recovery checks passed on the current Apple Silicon Mac.
This build is not a replacement release.

## Supported environment

The initial verification target is Apple Silicon macOS.
The selected tools are Rust 1.92.0, Node.js 24.15.0, and npm 11.12.1.
Other operating systems remain unverified.

The server uses the stable origin `http://127.0.0.1:3737`.
The launcher stops if that port is busy. It never selects another port.

## Installation gate

CAUTION: Obtain approval before each required installation or package download.
The lockfiles define exact versions, registry sources, and checksums.
Items larger than 1 GiB need separate explicit approval.
Docker images, compiler assets, and browser binaries need separate approval.
The setup script does not install tools or dependencies.

The current local dependency approval covers the locked macOS arm64 packages and a 512 MiB additional-output allowance.
That approval does not transfer to another checkout, machine, package version, or compiler image.
The private approval and size records are outside this repository.

1. Check the installed tools:

   ```sh
   ./scripts/setup.sh
   ```

2. After dependency approval, install the locked UI packages without lifecycle scripts:

   ```sh
   npm --prefix ui ci --offline --ignore-scripts --no-audit --no-fund
   ```

   Use only the approved npm cache. If offline resolution fails, stop for review.
   Do not fetch optional native canvas packages; the browser PDF worker does not need them.

3. If the Rust cache is incomplete, stop and obtain download approval.
   After that approval, fetch the exact lockfile:

   ```sh
   cargo fetch --locked --config net.offline=false
   ```

The default Cargo configuration uses offline mode.
Rust language-server checks remain disabled to prevent automatic package downloads.
Use explicit offline checks instead.

## Start the application

Run the launcher from this checkout:

```sh
./scripts/run.sh
```

The launcher builds the UI, binds the stable loopback port, and opens a protected browser session.
It does not create an account or request a password.
The browser removes the one-use launch fragment before its first API request.
Session cookies are HttpOnly and SameSite Strict.
The application never prints the launch credential.

If the session is unavailable, restart the launcher.
If the port is busy, stop the other process before you try again.
Do not send launch credentials to an unknown process at the occupied port.

## Opt into local PDF compilation

The default launcher does not contact Docker or enable compilation.
After runtime approval and verification, use:

```sh
./scripts/run.sh --compiler
```

This flag checks the existing ZIP bundle and cached format, the local Docker Desktop socket under `$HOME/.docker/run/docker.sock`, and the exact retained image metadata.
It does not download assets, pull/build an image, or compile automatically.
The current runtime payload is under `target/stage6-assets/payload`.
Missing or changed assets, an unavailable socket/image, or an unclean private job directory leave compilation disabled.
Source editing, JSON export, and TeX export remain available.

Only one compiler job can run. Editing cancels its pending result.
PDF parsing runs in a locally bundled browser worker before preview or export.
The page allowance produces a warning, not truncation or automatic resizing.
Use the page controls to inspect every page. A changed revision marks the retained PDF as outdated.
Parser checks and compiler diagnostics are not a visual or printed-readability check.
Detected overfull layouts are rejected without replacing the last valid PDF.

The retained PDF exists only in the active tab's memory. Draft recovery does not save PDF bytes.
Before you refresh or close the tab, export any PDF that you need to keep.
If PDF export reports an error, keep the tab open and select `Export PDF` to try again.

On Unix, Ctrl-C and SIGTERM cancel the active job and wait for owned cleanup.
A forced kill or power loss cannot complete graceful cleanup; retain any private job files for review.
Uncertain cleanup blocks further admission; preserve `target/compiler-jobs` for review instead of deleting it automatically.

The 16 approved retained-image test attempts are exhausted. Do not run another agent-driven image job without fresh approval.
The opt-in flag does not reset that test ledger or approve extra tests.

## Edit and save a document

1. Enter a page allowance before you create a document.
2. Select catalog formulas or add custom text and mathematics blocks.
3. Use the block controls to edit, remove, or move each block.
4. Use `\\` for manual equation line breaks.
5. Apply manual layout values or the compact candidate.
6. Export document JSON for a portable backup.

Version 1 supports A4 only.
The compact candidate uses example values, not approved font or printer limits.
Actual-size printed samples must establish those limits.
The editor never fits, shrinks, or removes content automatically.

Autosave provides draft recovery in this browser, not a durable backup.
Browser limits, browser cleanup, and private-session closure can remove drafts.
Save errors remain visible. Unsaved edits remain in the active tab.
After a save error, export JSON before you close the tab.

Clear and Import retain one replaced document in a separate recovery slot.
If that recovery save fails, replacement stops and the current document remains unchanged.
`Restore last replaced document` exchanges the active and replaced documents after confirmation.
A failed import leaves the current document unchanged.
Document JSON includes the active document and its mode recovery, not the unrelated replacement slot.

One tab holds the Web Lock for the active browser draft.
Other tabs remain read-only but can export the loaded document.
After the writer closes, use `Request editing` in another tab.
Browsers without Web Locks remain read-only.
The new `texgen.draft.v1` key does not read or change legacy storage keys.

Use `Open advanced raw editor` to convert structured content after confirmation.
The application obtains generated source from the Rust renderer and saves structured mode recovery before conversion.
The raw editor controls the complete source. Its formula and structured-layout controls remain disabled.

Use `Return to structured mode` to restore structured recovery after confirmation.
The application saves manual raw source as mode recovery before that return.
`Restore raw mode recovery` restores that source without generation or a merge of structured edits.
Each transition saves the alternate content and its layout. It does not change the separate replacement slot.
Raw imports without structured recovery cannot return to structured mode.
Use Clear to create a separate document, or continue to edit and export the raw document.
If a required recovery write fails, the transition stops. Export JSON before you close the tab.
TeX export uses the Rust renderer for structured documents and preserves raw source unchanged.
TeX export does not prove PDF layout or printed readability.

## Verification

Run the complete check:

```sh
./scripts/verify.sh
```

This command checks UI formatting, lint, types, tests, and the production build.
It also checks the catalog digest, Rust formatting, release-profile lint, tests, and the release build.
The shared release profile reduces duplicate build output.
One CI workflow runs the same checks.
The workflow downloads its exact locked dependencies on its runner. It does not deploy the application.

## Application boundaries

- `src/session.rs` owns process-local launch and session authorization.
- `src/web.rs` owns HTTP routes, request protections, and static UI service.
- `src/main.rs` owns loopback binding, browser launch, and server lifetime.
- `src/document.rs` owns the versioned model and format validation.
- `src/catalog.rs` owns the validated immutable catalog.
- `src/render.rs` owns deterministic structured TeX and byte-exact raw passthrough.
- `ui/src/document.ts` owns browser format validation and portable JSON.
- `ui/src/blocks.ts` owns immutable structured block operations.
- `ui/src/api.ts` owns the browser connection and response validation.
- `ui/src/draft.ts` owns the versioned browser envelope, separate from portable documents.
- `ui/src/editor-session.ts` owns the active document, revision, recovery, and asynchronous operation identity.
- `ui/src/browser-session.ts` owns browser storage, Web Locks, file reads, and download delivery.
- `ui/src/Editor.tsx` contains structured and raw controls without storage or HTTP access.
- `ui/src/BrowserApp.tsx` connects the editor session to React and connection status.
- `ui/src/App.tsx` contains accessible connection controls and keeps the editor mounted during retries.

The replacement contains no legacy application components, hooks, services, or state architecture.
The old implementation remains in its original worktrees and source backups.
The earlier refactor plan supplies behavioral lessons only.

## Remaining stages and gates

The document core, static catalog, and protected validation/rendering APIs are implemented.
`docs/DOCUMENT_FORMAT.md` describes the version-1 contract and its limits.
The structured editor and browser draft recovery passed the Stage 4 gate.
`docs/STAGE4_VERIFICATION.md` records the automated and isolated-browser evidence.
The raw editor and confirmed mode transitions passed the Stage 5 gate.
`docs/STAGE5_VERIFICATION.md` records the final automated and isolated-browser evidence.
The protected real-browser PDF workflow passed on this host, including two pages, overflow, stale-PDF export, raw-source preservation, and CSP.
Default startup keeps compilation disabled; `--compiler` provides explicit local opt-in after checks.
Startup/drain wiring passed code-only checks and real headless launcher checks, including missing-runtime fallback, Ctrl-C, and SIGTERM.
Active-job draining also passed a fake-engine regression. No additional image test is approved.
The corrected editor-browser rerun passed with private downloads, recovery, raw editing, exports, keyboard controls, and mobile layout.
That browser run predates the current light layout and later PDF-export and creation-retry fixes.
The current layout and later fixes also passed a separate browser check with synthetic documents and a saved two-page PDF replay.
At 1440 px and 320 px, the controls stayed in order without horizontal overflow.
Both PDF pages painted. Creation and PDF-export failure retries passed.
PDF downloads kept the replay bytes unchanged. JSON downloads matched the active document.

The [desktop screenshot](docs/screenshots/rust-web-desktop.png) and [mobile screenshot](docs/screenshots/rust-web-mobile.png) show that replay check.
These screenshots are not new native-compilation evidence or a dense-formula readability check.
The browser used blocked external traffic and private downloads. It did not use an original browser profile or authenticate API requests.


Earlier browser-budget and download-confinement failures remain recorded; the successful rerun does not erase them.
No native compiler fallback exists.
The renderer targets A4, Latin Modern, AMS packages, geometry, and multicol.
Stage 6 preparation selected Tectonic 0.17.0 and approved job limits.
The retained local image passed offline compilation and functional resource/isolation checks.
The earlier image-build budget gate remains failed; runtime success does not clear that historical failure.
Compiler-control helpers now cover job admission, private files, output limits, timeout, cancellation, and cleanup failure.
Compiler-control, ownership, protected-route, browser-worker, and lifecycle tests have passed with the scopes recorded in the verification documents.
`docs/STAGE6_CONTROL_VERIFICATION.md` records the code-only evidence and its limits.
`docs/STAGE6_RUNTIME_VERIFICATION.md` records the 16 attempts and protected-browser evidence.
The final code-only startup checks and broader editor-browser regression passed on this host.
Clean-host verification, visual checks of dense formulas, and physical printed samples remain separate release gates.
`docs/NEXT_SESSION.md` records the approvals, failure evidence, and remaining gates.
Actual-size printed samples must determine the minimum body size and usable printer margins.
The final compact preset is not approved.
No public deployment is permitted.

The full requirements remain in `docs/RUST_REWRITE_PLAN.md`.
