# PDF preview package proposal — approved

The approved archive has been downloaded, verified, and installed offline with scripts disabled.
Actual compressed size: 8,539,589 bytes, below the 12 MiB cap.
SHA-512, safe tar paths/types, 554 regular files, and 34,913,648 unpacked bytes all passed.
Archive SHA-256: `86269b40170eb41740ea05ad2102d71d33de4f122b34eb2f478be0ea7779c415`.
Evidence: `target/pdfjs-package-6.4.299/verified.json` and `approved-command-1792450631814495000.log`.
The fetch ended at 449,724,416 monitored bytes. No optional native archive was fetched.
Cache import passed. The first offline lock resolution stopped with ENOTCACHED for the PDF.js registry metadata.
Evidence: `approved-command-1792451033995380000.log`, ending at 461,000,704 monitored bytes.
Both package manifests remained byte-identical to their pre-attempt copies; PDF.js was not installed.
The user then explicitly approved registry JSON only for the pinned package and declared optional-dependency records.
Metadata cache warmup and the offline lock-only retry passed in `approved-command-1792454953046009000.log`.
All old dependency entries stayed unchanged. The new canvas/platform lock entries are optional; none of their archives is cached.
Offline installation then added exactly one package, PDF.js 6.4.299. The optional canvas package is absent.
Evidence: `approved-command-1792455117931789000.log`, ending at 494,706,688 monitored bytes.
Worker tests, type checking, lint, formatting, and the UI build passed. The protected real-browser PDF workflow passed in attempt 16; the later editor-only regression also passed.
See `STAGE6_RUNTIME_VERIFICATION.md` for the actual scopes, historical failures, and remaining release gates.
The metadata-scope self-checks passed under normal and optimized Python in `approved-command-1792454947606735000.log`.
The user explicitly approved the pinned package, 12 MiB cap, and unchanged 512 MiB output allowance.
The user approved reclaiming the two earlier generated files below; the 640 MiB alternative was not approved.
A later explicit approval also permitted removal of only the new PDF.js staging archive after verifying identical SHA-512 bytes in the approved npm cache.
That check passed and the staging copy was removed. The cached archive, `verified.json`, and started marker remain.
Evidence: `target/pdfjs-package-6.4.299/staging-reclaimed.json`.

## Proposed browser dependency

- Package: `pdfjs-dist`, exact version `6.4.299`.
- Source: `https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz`.
- License: Apache-2.0.
- Registry unpacked size: 34,913,648 bytes across 554 files.
- Proposed compressed-download cap: 12 MiB. The HEAD response supplied no Content-Length.
- SHA-1 from the registry: `4a46f5146ac6505564c1a5d472900be4df8bf628`.
- Integrity: `sha512-AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g==`.
- Registry source revision: `d0991a0d53f3bb3a7307e3b83f279c1d117aafb3`.
- Required Node version: `>=22.13.0 || >=24`. The current installed version is `v24.15.0`.

Abort the download if the size cap or integrity check fails.
Do not use a different version or download an unlisted archive automatically.

## Purpose and restrictions

Use the browser library and a locally bundled worker for page counting and canvas preview.
No CDN, React wrapper package, server PDF parser, or native canvas dependency is proposed.
Do not install or fetch optional `@napi-rs/canvas` binaries.
Do not run package installation scripts.
Keep existing approved platform dependencies and use the approved offline npm cache.
If offline resolution needs another package archive, stop for review instead of fetching it.

The existing PDFKit script is a macOS test oracle. It is not a safe cross-platform publication service.
PDF preview must retain every page, preserve the last valid PDF, and reject stale job ownership.
The canonical document remains the only editable source of truth.

## Output-budget decision

The host output allowance is still 512 MiB, with a 32 MiB reserve.
New package bytes, npm cache data, worker assets, and build output must all remain monitored.

The user selected reclamation of exactly these two new generated artifacts.
Their sizes and hashes were checked and saved before removal in `target/stage6-probes/approved-reclaimed-artifacts.json`:

- `target/stage6-probes/attempt-09/output.pdf`: the file-size stress output, 10,485,760 logical bytes and 11,177,984 allocated bytes.
  SHA-256: `e5b844cc57f57094ea4585e235f36c78c1cd222262bb89d53c94dcb4d6b3e55d`.
- `target/stage6-assets/tectonic-0.17.0-aarch64-unknown-linux-musl.tar.gz`: the downloaded archive, 9,926,834 logical bytes and 9,928,704 allocated bytes.
  SHA-256: `b10954a95404f3ab2328d2fa59a5ebab8e657f893fab096f98be8db7c0c979b8`.

Keep the extracted compiler executable, ZIP bundle, cached format, image, manifests, attempt ledger, and all verification evidence.
Do not delete original worktrees, indexes, refs, or private backups.
Do not increase or reset an allowance without explicit approval.

The 640 MiB alternative was not selected. Do not raise the 512 MiB allowance.
The private original monitor and backup files remain unchanged.
The earlier failed image-build gates remain failed.

## Execution gate — exhausted

All 16 approved retained-image attempts are consumed. No retry or further agent-driven image job is approved.
Default startup keeps compilation disabled. The user separately approved explicit `--compiler` startup with runtime checks.
The protected browser PDF workflow has current-host evidence; it is not a public deployment or clean-host verification.
This package proposal does not approve a commit, push, or deployment.
