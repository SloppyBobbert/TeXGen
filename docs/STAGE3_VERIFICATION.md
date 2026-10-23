# Stage 3 verification

Status: Document-core gate passed on the current Apple Silicon Mac.
The editor workflow and compiler boundary remain incomplete.

## Implemented contract

`src/document.rs` defines the version-1 document and its validation rules.
`src/catalog.rs` loads and validates the immutable bundled catalog.
`src/render.rs` renders structured documents and passes raw source unchanged.
`ui/src/document.ts` implements matching browser validation and portable JSON.
`ui/src/blocks.ts` implements immutable block insertion, replacement, removal, movement, and layout changes.
`docs/DOCUMENT_FORMAT.md` describes the shared contract.

The HTTP layer adds protected catalog, validation, and rendering endpoints.
Source replies echo the document ID and safe session revision.
These endpoints do not compile TeX or invoke Docker.

## Catalog checks

The conversion read saved Python literal data without executing the modules.
The result contains 14 subjects, 76 categories, 385 formulas, and 475 unique IDs.
Every subject/category label, formula label, and formula string matched the saved source.
The complete unit-circle table remains a fragment.
`data/catalog-provenance.json` records the frozen source and file hashes.

The catalog digest, counts, unique IDs, and unit-circle checks passed.
The assigned IDs are permanent, including after label or order changes.
Saved documents retain local formula content and render without a current catalog entry.

## Automated checks

`./scripts/verify.sh` passed:

- Catalog integrity checks.
- UI formatting, lint, and type checks.
- 16 frontend tests across 3 files.
- The production UI build.
- Rust formatting and strict release-profile Clippy checks.
- 27 Rust tests: 10 unit tests and 17 integration/runtime tests.
- The release build.

The browser fixture remains excluded from ordinary unit runs.
The separate real-browser harness explicitly exercised it.

The tests cover:

- Document and mode-recovery JSON round trips.
- Required page allowance and A4-only layouts.
- Numeric precision, column geometry, and the single-column gap bound.
- Invalid versions, unknown fields, malformed recovery, and duplicate IDs.
- Plain-text escaping and preserved manual equation breaks.
- Duplicate display labels with distinct identities.
- Removal and layout changes without loss of unrelated content.
- Local formula edits without catalog mutation.
- Complete formula blocks and preserved order across topic continuation.
- Deterministic source against the reviewed golden fixture.
- Page allowance changes without source truncation or automatic fitting.
- Byte-exact raw source and exclusion of recovery content from rendering.
- Protected API access, revision tags, and oversized-input rejection.

## Browser and fresh-source checks

The installed Chrome browser reached the real Rust router.
It retrieved all 14 subjects and 385 formulas.
The authenticated rendering request returned status 200, document `doc-fixture`, and revision 42.
Its source exactly matched the golden fixture and excluded the inactive recovery marker.
Authorization, clean URLs, reload, keyboard focus, mobile width, and HTTP rejection checks passed again.
No browser binary was downloaded.

A fresh Git archive of the staged source passed the UI and Rust release checks.
That check reused the approved package installation and Cargo cache without downloads.
The actual macOS launcher opened the default browser and received protected authorization.
The fresh-source tree was `4388d4532c38244cf14171eb22010d9f6b4222bf`.
Later changes updated status and handoff documentation only.

The guarded checks ended at 350,650,368 bytes, within the 512 MiB allowance.
A prior debug-profile run stopped at the guard before completion.
Only new debug-build output was removed. Release-profile checks then passed.

## Private evidence

These paths are relative to `/Users/brandontran/TeXGen-backups/pre-rust-2026-10-17/`:

- `approved-command-1792305443608845000.json` and `.log`: complete core checks.
- `browser-stage3.json`: browser/API checks and golden-source comparison.
- `approved-command-1792306899707289000.json`: guarded browser success.
- `clean-source-stage3.json` and `.log`: fresh-source and actual launcher checks.
- `approved-command-1792306904600916000.json`: guarded fresh-source success.
- `stage3-originals-check.json`: original worktree and bundle comparisons.
- `convert_catalog.py`: the checked static-data conversion procedure.

The final comparison confirmed unchanged original source, index bytes, HEADs, and branch refs for all 17 old worktrees.
The supplementary source patches and complete bundle hash also matched.

## Remaining limits

No LaTeX fixture was compiled. No PDF layout or printed-readability approval is claimed.
The positive numeric font range is a format constraint, not a readable minimum.
The example 9 pt body and 5 mm margins are not approved printer limits.
Unbreakable minipages do not certify absence of overflow or overlap.
The compiler must detect invalid supported layouts and preserve source and the last valid PDF.
Raw source still needs a visual-review warning.

The structured editor, browser persistence, cross-tab lock, destructive-action recovery, raw transitions, and preview remain pending.
Remote CI, independent review, a complete dependency vulnerability audit, and clean-machine verification remain unverified.
Docker images, compiler assets, browser downloads, and public deployment remain outside the existing approval.
The pre-approval diagnostic download incident remains recorded. Later approval did not erase it.
