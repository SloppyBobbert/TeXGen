# Stage 2 verification

Status: Foundation gate passed on the current Apple Silicon Mac.
This result does not approve the complete application or its compiler boundary.

## Source and tools

The replacement resides in `/Users/brandontran/TeXGen-rust-web` on `rewrite/rust-web`.
The old application files were removed only from this isolated worktree after complete backup verification.
All application modules and tests are new. No legacy component, hook, service, or state architecture was copied.

Verified tools: Rust 1.92.0, Node.js 24.15.0, npm 11.12.1, and the installed Chrome browser.
Exact package versions and sources remain in `Cargo.lock` and `ui/package-lock.json`.
The browser check did not download a browser binary.
The Cargo configuration uses offline mode.

## Checks

The following commands passed:

```sh
./scripts/setup.sh
npm --prefix ui run check
cargo fmt --all -- --check
cargo clippy --offline --locked --all-targets -- -D warnings
cargo test --offline --locked
cargo test --offline --locked --release
cargo build --offline --locked --release
```

The UI checks passed formatting, lint, types, 6 tests, and the production build.
Rust passed 5 unit tests and 1 occupied-port runtime test.
The persistent browser fixture is excluded from ordinary test runs.
The separate browser harness exercised that fixture against the real Rust router and production UI assets.

The browser and live HTTP checks verified:

- A one-use launch fragment establishes the protected API session.
- The browser removes the fragment before its first API request.
- The session cookie is HttpOnly and SameSite Strict.
- Session authorization survives page reload.
- Invalid hosts, unrelated origins, and unauthorized API requests fail.
- Missing app headers fail.
- No CORS authorization is supplied to unrelated websites.
- Keyboard focus reaches the connection control.
- The 320px page has no horizontal overflow.
- The page identifies the unfinished editor and disabled PDF compiler.

A fresh Git archive of the staged source passed UI checks, formatting, Rust release tests, and the release build.
That check reused the approved package installation and Cargo cache. It did not install or download packages.
The fresh-source test does not represent a clean macOS installation.

The actual release executable invoked the macOS browser opener at the stable origin.
The default browser then supplied the one-use authorization and opened a protected session.
The launcher log contained no launch fragment or bearer credential.
The test server stopped after verification. The browser tab can remain open.

## Private evidence

All evidence paths below are relative to `/Users/brandontran/TeXGen-backups/pre-rust-2026-10-17/`.

- `browser-stage2.json`: protected browser, HTTP, keyboard, and mobile results.
- `stage2-mobile.png`: the inspected 320px screenshot.
- `clean-source-stage2.json`: source-tree ID, fresh-source checks, and actual automatic browser launch.
- `clean-source-stage2.log`: fresh-source build and launcher output.
- `stage2-originals-check.json`: final original-worktree and bundle-hash comparisons.
- `approved-command-1792301715457350000.json`: corrected monitor and fresh-source success.
- `approved-command-1792302043847362000.json`: final strict Clippy success and disk measurement.
- `test_budget.py`: regression checks for the disk monitor and child cleanup.

The latest measured output was 370,429,952 bytes, within the approved 512 MiB allowance.
No original worktree source, index bytes, HEAD, or branch ref changed.
The complete backup bundle hash still matched its preservation record.

## Limits

The CI workflow is defined and pinned to exact action commits. No remote CI run is claimed.
Independent review and a complete third-party vulnerability audit have not run.
The document model, catalog conversion, editor, persistence, recovery, and PDF workflow remain pending.
Docker engine availability does not establish compiler safety.
No compiler image, compiler asset, or browser download is approved by this stage.
No PDF compilation or native compiler fallback exists in this build.
The printed-sample and clean Apple Silicon environment gates remain open.
Other operating systems remain unverified. No public deployment occurred.

The pre-approval automatic Rust downloads remain a recorded gate violation.
`IMPLEMENTATION_STATUS.md` and the private `DOWNLOAD_GATE_INCIDENT.md` describe that incident.
Later approval did not erase the violation.
