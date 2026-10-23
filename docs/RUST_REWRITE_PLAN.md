# TeXGen Full Rewrite Plan — Rust Server and TypeScript UI

Status: Implementation in progress on `rewrite/rust-web`. Stages 1 through 5 passed.
Stage 6 current-host compiler/PDF integration and the corrected editor-browser regression are verified.
Default startup keeps compilation off; explicit `--compiler` startup has code-only checks. No image test attempts remain.
Stage 7 clean-host, dense-formula visual, and physical printed-readability checks remain open; historical budget failures remain recorded.
See `docs/NEXT_SESSION.md` for approvals and `docs/STAGE6_RUNTIME_VERIFICATION.md` for evidence and limits.
Date: 2026-10-18

## Full rewrite mandate

**Replace the entire application from scratch. This is not an incremental refactor, cleanup, or direct language port.**

The user rejects the old implementation because its tightly coupled code is too difficult to maintain.
Preserve the old project as a backup and a source of lessons, not as the foundation for new code.

Write a new Rust server, TypeScript UI, document model, editor state, persistence layer, and compiler integration.
Create tests, build configuration, CI, container configuration, setup scripts, and application documentation for the new design.
Design modules from the approved requirements rather than translating old functions line by line.
Do not copy the old components, hooks, services, state architecture, or application plumbing into the replacement.

Reuse only validated formula data, reviewed static assets, and documented behavioral requirements where they remain useful.
Use old tests as behavioral references. Write new tests against the new application contracts.
The earlier incremental refactor plan does not authorize repairs or extensions to the legacy application.

Build the replacement in an isolated rewrite worktree after backup verification.
Keep the original worktrees and Git history intact. A full application rewrite does not require destructive repository operations.
The stages in this plan build the new application, not successive repairs to the old one.
The first release still has the agreed core scope. Deferred features do not become rewrite requirements.

## 1. Confirmed decisions

- Preserve source changes, index states, and retained stash history from every Git worktree before the rewrite.
- Replace the entire application implementation from scratch under the full rewrite mandate.
- Write a new server in Rust and a new browser UI in TypeScript.
- Run the first version at one stable loopback origin. Stop clearly if its port is unavailable.
- Let the launcher open a protected browser session automatically, without user accounts.
- Keep editing, draft recovery, JSON export, and TeX export available when Docker is unavailable.
- Disable PDF compilation until Docker and the compiler boundary are ready.
- Verify Apple Silicon macOS first. Other operating systems remain unverified.
- Use Docker for isolated PDF compilation, subject to verification and separate installation approval.
- Deliver the core editor workflow first.
- Support a defined offline set of LaTeX packages and fonts.
- Use browser autosave for draft recovery and document export for portable backups.
- Provide structured editing and an explicit advanced raw mode.
- Permit document-local formula edits without changing the shared catalog.
- Permit topic breaks between complete formula blocks while preserving the user's order.
- Keep catalog diagrams. Defer custom image uploads and asset packaging.
- Preserve one recovery copy before Clear or Import replaces a document.
- Include the latest mode-recovery copy in document JSON exports.
- Permit only one editable tab per draft. Other tabs remain read-only.
- Maximize content per page with A4 paper as the default.
- Require the user to select the page allowance for each new document.
- Start with a compact preset and manual layout controls, not automatic fitting.
- Select the minimum body text size through actual-size printed samples.
- Show page-allowance warnings without clipping, overlap, or silent content removal.
- Require manual correction of oversized formula blocks. Do not export an invalid layout as successful.
- Defer public hosting, accounts, shared storage, templates, and practice problems.
- Keep the old application as a reference, not as the new application structure.

The user confirmed the documentation review decisions and density requirements before this update.
The minimum body text size and printer margin limits still require approval from printed samples.

This document does not authorize implementation in the planning session.
No backup branches, commits, or application changes exist from this session.

## 2. Purpose

The current application combines document state, formula selection, rendering, compilation, and persistence across several modules.
The user requests a complete replacement because the existing code structure is too difficult to maintain.
A language change alone will not correct these boundaries.

The rewrite will give each responsibility one owner.
The first version will support one complete workflow:

1. Select formulas.
2. Arrange the document.
3. Edit the document.
4. Change the layout.
5. Preview the PDF.
6. Save the document locally.
7. Reload the document.
8. Export TeX or PDF.

The main invariant is: **The application must never silently discard manual edits.**

## 3. Evidence and limits

The planning inspection found:

- Six modified tracked files, including four frontend test files.
- Additional untracked files, including the earlier refactor plan.
- Seventeen registered Git worktrees.
- A local `main` branch 250 commits ahead and 389 behind the local `origin/main` reference.
- Separate browser storage paths for formulas and LaTeX.
- Document assembly in both the Django model and LaTeX utilities.
- A compiler utility that starts Tectonic without an explicit timeout.

Sources include `docs/REFACTORING_PLAN.md`, the frontend hooks, backend models, and backend LaTeX utilities.
The earlier plan supplies useful regression scenarios.
Its proposed implementation phases do not control this rewrite.

The inspection did not fetch remote branches or inspect every worktree.
It did not establish a passing test baseline.
Existing production data and external API use remain unverified.
The earlier plan states that neither requires compatibility. Confirm this before implementation.

## 4. Preservation procedure — first execution stage

CAUTION: Do not reset, delete, clean, merge, or overwrite the old worktrees.
Unsaved work can exist outside the main directory.

1. Record every worktree path, branch, and HEAD commit.
2. Record staged, unstaged, untracked, and ignored files for each worktree.
3. Inventory retained stash entries and their reflog history without applying or dropping them.
4. Identify source changes separately from secrets, databases, caches, dependencies, and agent session files.
5. Review new snapshot content for secrets before each commit.
6. Create named checkpoint branches for every worktree.
7. Preserve source changes without changing the original worktree files or index.
8. Preserve separate index and working-file states in the backup records where they differ.
9. Preserve the inventoried stash commits and their parent commits under named backup refs.
10. Record every omitted path and its reason.
11. Leave credentials and local databases untouched.
12. If local data needs a separate backup, agree on its destination and access protection first.
13. Create a local Git bundle outside the repository for the checkpoint branches, stash backups, and existing refs.
14. Verify the bundle and restore representative source, index, and stash states into a temporary directory.
15. Compare the restored states with the recorded originals.
16. Confirm that the original worktrees, indexes, and stash entries remain unchanged.

Suggested branch prefix: `archive/pre-rust-<date>/`.
The execution report must give the actual branch names, bundle path, and verification results.

A Git bundle does not include ignored files, untracked files without snapshots, or browser storage.
It does not preserve index states or stash reflog history unless the backup procedure first makes them reachable through refs.
Git configuration, hooks, databases, and browser drafts are outside this source backup. Record these omissions explicitly.
A local bundle does not protect against loss of the computer.
See the [Git bundle documentation](https://git-scm.com/docs/git-bundle#_discussion).
Do not publish the bundle or push checkpoint branches without approval.

After preservation, create an isolated worktree on `rewrite/rust-web`.
Keep existing Git history. Do not replace `main` or reconcile its divergence as part of the rewrite.
Remove old application files only inside the new worktree, after backup verification.

## 5. Proposed design

This design records the confirmed product decisions.
Exact dependency versions, numeric limits, and remaining verification gates appear in Section 9.

### Application structure

Use one Rust application with focused modules, not microservices or a large workspace.
Use a new React UI in TypeScript to retain familiar browser tooling.
Use one stable loopback origin for the UI and API across launches.
Keep the hostname, protocol, and port consistent so browser drafts remain in the same storage area.
If the normal port is unavailable, stop with a clear explanation. Do not silently choose another port.
Do not send session credentials or document data to an unknown process at the occupied port.
See the [MDN origin definition](https://developer.mozilla.org/en-US/docs/Glossary/Origin).
Bind the first version to loopback. Do not expose the compiler through a public interface.
Verify the complete workflow on Apple Silicon macOS with the Docker-managed compiler.
Do not claim Linux, Windows, or Intel Mac support without separate verification.

The Rust application owns:

- Formula catalog loading and validation.
- Document validation.
- Structured document rendering into LaTeX.
- Compiler process control.
- HTTP input and output.

The browser UI owns:

- One editor session.
- User actions and accessible controls.
- Local document persistence.
- Request cancellation and stale-response rejection.
- PDF display and download actions.

Keep document operations independent of HTTP and compiler processes.
Keep browser components independent of network and storage details.
Start with ordinary modules and functions. Add interfaces only where tests or external systems require them.

### Protected local launch

Let the launcher open a protected browser session automatically.
This session protects the local API. It does not introduce user accounts or a password workflow.
Validate the request host and origin against the application's exact loopback origin.
Require app-local session authorization for protected API operations.
Reject unrelated website requests and unexpected request content types.
Do not rely on CORS or loopback binding alone as request authorization.
Keep session secrets out of URL query strings and logs.
Verify these protections with requests from an unrelated origin and an invalid host.

Relevant documentation:

- [MDN CORS simple requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS#simple_requests).
- [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

### Compiler availability

Check the Docker engine before PDF compilation, not only the presence of its command.
If Docker is unavailable, keep the editor, draft recovery, JSON export, and TeX export available.
Disable PDF compilation with a visible explanation and a retry action.
Never replace an unavailable or unsafe compiler with an unisolated native invocation.
See [Docker daemon availability checks](https://docs.docker.com/engine/daemon/troubleshoot/#check-whether-docker-is-running).

### Document model

Use one versioned document format for local storage, import, export, and API input.
Include a stable document ID, title, layout, and an explicit content mode.
Use a session revision to identify changes during asynchronous operations.

Structured mode contains ordered blocks with stable IDs.
A formula block retains its catalog identity and a document-local copy of its formula content.
Allow edits to that local content, including manual equation line breaks.
Never apply those edits to the shared catalog.
A custom block contains user-authored text or mathematics.
Retain built-in catalog diagrams, but do not add custom image files or asset packaging to the first version.
Block removal must not change unrelated blocks.
Formula labels are display text, not identifiers.

Raw mode contains one complete LaTeX source as its authority.
The application must not maintain a second, independently editable generated source.

Generated LaTeX and PDFs are derived outputs, not additional document owners.
Selection counts and category controls derive from the document blocks.
Layout fields include paper size, columns, margins, font size, and spacing.
Persist the user-selected page allowance with the document.
Plain text and raw LaTeX have distinct field types and escaping rules.

### Dense cheat sheet output

The objective is maximum content per page, not minimum paper size or minimum PDF file size.
Use A4 paper by default.
Require the user to select the page allowance for each new document. Do not assume one page or two pages.

Start with a compact preset and manual controls for font size, columns, margins, and spacing.
Reduce unused space in headings, equations, and column gaps within the compact preset.
Do not add an automatic layout search or automatic fit operation to the first version.
Do not claim a globally smallest layout.

The layout must preserve all selected content and mathematical meaning.
Do not meet a page target through clipping, overlap, hidden content, or silent content removal.
Compare the compiled page count with the selected allowance.
If content exceeds the allowance, show a visible warning and retain the complete document.
The page allowance is a target, not permission to truncate output.

Allow a topic to continue across columns only between complete formula blocks.
Preserve the user's formula order. Do not split a formula block across columns or reorder it to fill space.
If a block cannot fit, require manual equation edits or a wider layout.
Show a clear layout error for detected overflow and preserve the source and last valid PDF.
Do not treat detected overlapping or clipped output as a successful preview or PDF export.
The absence of diagnostics does not certify arbitrary raw TeX as visually correct.
Full-width formula blocks and automatic shrinking are outside the first version.
See the [AMS math guide, Section 3.3](https://www.latex-project.org/help/documentation/amsldoc.pdf) for multiline equation support.

Choose the minimum body text size from actual-size printed samples with the user.
Do not fix that size before sample approval.
A PDF preview alone cannot establish readability on printed paper.
Confirm usable printer margins through those samples.

Apply the compact preset through structured editing only.
In raw mode, the source remains authoritative. Density controls must not rewrite manual source.
Keep the supported package set and compiler limits unchanged by any density feature.

Relevant documentation:

- [geometry: page dimensions and margins](https://ctan.org/pkg/geometry).
- [multicol: multiple columns and column balancing](https://ctan.org/pkg/multicol).

### Editing rules

Structured edits operate on blocks rather than searches inside generated TeX.
Custom blocks survive formula removal and layout changes.

An explicit action converts a structured document into raw mode.
The application saves the structured recovery copy before conversion.
In raw mode, formula and structured-layout controls cannot rewrite the source.
The raw editor controls the entire source, including its layout commands.

Return to structured mode requires explicit confirmation and a recoverable copy of the raw source.
Include the latest mode-recovery copy in document JSON exports.
Validate and restore that copy on JSON import so mode recovery survives transfer to another computer.
Do not include an unrelated document from the Clear or Import recovery slot in the active document's export.
Render and compile only the active content, never the recovery copy.
Do not attempt to parse arbitrary LaTeX back into structured blocks.
Do not use regular expressions to synchronize arbitrary source and selections.

### Formula catalog

Reuse the existing formula content after validation.
Do not copy the old Python application into the Rust server.
Convert the catalog into a static, language-neutral data file during implementation.
Give subjects, categories, and formulas stable IDs.
Preserve special content, including the unit circle.

Verify catalog counts, labels, formula content, and ID uniqueness against the saved source.
Saved documents retain their formula content so later catalog changes cannot silently alter them.

### Local save

Start with one active document and a new, versioned browser storage key.
Do not automatically read, combine, migrate, or delete the old storage keys.

Provide document JSON export and import for portable backups.
Validate imported documents and unsupported format versions before replacing the active document.
Preserve one recovery copy of the current document before Clear or Import replaces it.
If that recovery save fails, stop the replacement and offer document export instead.
A failed import must leave the current document unchanged.
Keep only the latest replaced document in this recovery slot. Do not add a multi-version history.
Keep this slot separate from the active document's mode-recovery copy.
Show save failures. Never report success after a storage error.
See [MDN Storage.setItem() exceptions](https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem#exceptions) for storage failure behavior.
Describe autosave as draft recovery, not as a durable backup.
Keep portable document export visible in the editor.
Handle browser storage limits and private-session data loss without a false durability promise.
See [MDN storage limits](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria#web_storage).

Permit one writer per draft across tabs. Other tabs must remain read-only with a visible explanation.
Use a cross-tab lock rather than a storage-change notification as mutual exclusion.
If the required lock mechanism is unavailable, fail safely without permitting competing writers.
See the [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).

On clear or document replacement, invalidate pending save timers and network requests.
An earlier operation must not recreate or overwrite the new document.
Local browser storage is not a durable backup or shared storage.

### Rendering and preview

Use one Rust rendering path for TeX export and structured PDF compilation.
Pass raw source unchanged to the compiler after input validation.
Keep compiler-specific behavior outside the document model.

Start with an explicit Preview action. Defer automatic compilation until the complete workflow is reliable.
Associate each request with its document ID and session revision.
Only a response for the current document revision can become the current preview.

Retain the last valid PDF after compilation failure.
Mark an older PDF as out of date.
Release obsolete browser object URLs.
PDF export must identify the compiled revision. Never present an old PDF as the current document.

Separate compilation success, automated layout diagnostics, and visual review.
Run supported-layout checks and expose relevant compiler diagnostics.
Block a current PDF export when those checks detect an invalid layout.
Show a visual-review warning for unrestricted raw TeX. Do not label it automatically overlap-free.
Verify representative structured layouts visually and through the printed-sample gate.
Neither a successful compiler exit nor page count alone proves the absence of clipping or overlap.
See the [AMS math guide, Section 4.13](https://www.latex-project.org/help/documentation/amsldoc.pdf#page=21) for zero-height typesetting with `\smash`.

### Compiler safety

Retain Tectonic as the proposed compiler. Confirm its version and operational limits before implementation.
Rust memory safety does not isolate a TeX compiler.
A temporary directory alone is not a security boundary.

Define and verify the compiler isolation mechanism before local compilation of imported or user-authored TeX.
Require these controls:

- A fixed executable and argument list without a shell.
- Request-size and output-size limits.
- A process timeout with termination of descendant processes.
- Bounded concurrency and admission limits.
- CPU, memory, process, and disk limits.
- A separate temporary directory for each job.
- No compiler access to application secrets or unrelated host files.
- Filesystem access limited to job files and approved read-only compiler assets.
- No project-directory, home-directory, or Docker-socket mounts inside the compiler container.
- Write access limited to the job's scratch and output locations.
- No compiler network access.
- Explicit denial of external command execution through Tectonic untrusted mode.
- A defined offline package and font set with prepared TeX assets.
- An explicit cached-only compiler setting, independent of untrusted mode.
- A clear error for unavailable packages or fonts. Never download them during a compilation request.
- Bounded, sanitized diagnostics without unbounded output collection.
- Explicit process termination and reaping after failure, timeout, or cancellation.
- Cleanup after success, failure, timeout, and cancellation.

Use a Docker-managed compiler isolation boundary. Do not invent a custom TeX sandbox.
Keep compilation blocked until the actual Docker boundary passes the required isolation tests.
Docker acceptance does not authorize an installation, image download, or compiler asset download.
Configure actual resource limits. A container does not supply those limits by default.
Validate the actual runtime boundary with abuse tests.
Keep all development and release services on loopback for the first version.
Public access requires a separate decision, anonymous quotas, rate limits, and deployment verification.

Documentation grounds these requirements:

- [Tectonic security](https://tectonic-typesetting.github.io/book/latest/v2cli/compile.html#security): untrusted mode disables known-dangerous features.
- [Tectonic build options](https://tectonic-typesetting.github.io/book/latest/v2cli/build.html#command-line-options): cached-only mode refuses network requests for support files.
- [Tokio process control](https://docs.rs/tokio/latest/tokio/process/struct.Command.html#method.kill_on_drop): dropping a child handle does not kill it by default.
- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/): containers have no resource constraints by default.
- [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/#considerations-and-constraints): bind mounts provide host-file write access by default.

Docker is the confirmed compiler runtime boundary for the first macOS version.
Tokio and specific library versions remain unselected.
Verify Docker engine availability, image configuration, and enforced limits before compilation.
The presence of a Docker command alone does not establish a working engine or a safe sandbox.
See [Docker installation requirements for macOS](https://docs.docker.com/desktop/setup/install/mac-install/#system-requirements).

## 6. Implementation stages and checks

Each stage must leave a usable result with documented commands.
The next prompt must select dependency versions and establish actual tool availability before installation.

### Stage 1 — Preserve the old project

Complete the preservation procedure in Section 4.
Record the old test baseline where existing tools permit it.
Do not repair the old application as a prerequisite to the rewrite.

Gate: Verified source snapshots exist for every worktree. Original files and indexes remain unchanged.

### Stage 2 — Establish the new application

Create the isolated rewrite worktree.
Create one Rust server and a minimal TypeScript UI.
Add a health endpoint and a browser page that reaches it.
Use the stable loopback origin and a launcher that opens the protected local session.
Verify busy-port failure and rejection of unauthorized, invalid-host, and unrelated-origin API requests.
Add formatting, lint, type checks, build checks, and tests to one CI pipeline.

Gate: A fresh checkout builds and runs with documented commands.

### Stage 3 — Build the document core

Define the document format and validation rules.
Convert and validate the formula catalog.
Implement block operations and deterministic LaTeX rendering.
Add golden TeX fixtures and document round-trip tests.
Include escaping, invalid layout, duplicate IDs, and special catalog content.
Verify that local formula edits preserve catalog identity without changing the shared catalog.
Verify formula order and topic continuation between complete blocks.

Gate: Identical documents produce identical TeX. Removing a formula preserves unrelated custom content.

### Stage 4 — Build the structured editor

Add formula selection, ordering, custom content, and layout controls.
Use one editor state owner.
Add local save, reload, JSON export, and validated import.
Add document-local formula edits and manual equation line breaks.
Preserve and restore the last replaced document for Clear and Import.
Verify that a failed recovery save prevents replacement.
Add visible save failures and keyboard-accessible controls.
Prevent simultaneous writers to the same draft across tabs.
Add the compact preset and manual density controls with A4 as the default.
Require a page allowance for each new document.
Persist the page allowance and paper size through save, reload, export, and import.

Gate: Content and layout survive save and reload. A second tab cannot overwrite an active editor.

### Stage 5 — Add the raw editor and recovery

Implement explicit conversion to raw mode.
Implement recovery copies and confirmed replacement actions.
Disable controls that cannot safely modify raw source.
Add tests for both mode transitions and clear/reset.
Verify that JSON export and import preserve the latest mode-recovery copy.
Verify that exports exclude the unrelated Clear or Import recovery document.

Gate: No mode transition silently replaces manual source.

### Stage 6 — Add safe compilation and preview

Implement and verify the Docker-managed compiler boundary and its resource controls.
Connect preview, TeX export, and PDF export.
Add stale-response tests and compiler failure tests.
Run a real offline compilation smoke test.
Show the actual compiled page count and a warning for an exceeded page allowance.
Retain every page after page-allowance overflow. Do not shrink or remove content automatically.
Reject detected clipped or overlapping formula layouts without losing the source or last valid PDF.
Distinguish diagnostics from visual verification, especially for raw TeX.
Verify that editing and source exports still work when Docker is unavailable.
Test filesystem access, network access, command execution, timeouts, output limits, and simultaneous jobs.
Verify that the compiler cannot access project files, home files, or the Docker socket.

Gate: Preview works, outdated PDFs remain identifiable, and hostile TeX stays within the runtime boundary.

### Stage 7 — Verify the full workflow

Run the browser journey against the real server.
Verify mobile layouts, keyboard operation, status messages, and recovery from failures.
Verify the release build and offline compiler assets from a clean Apple Silicon macOS environment.
Include the Docker engine and compiler image in that verification.
Compare candidate body text sizes in actual-size printed samples with the user.
Record the approved minimum body text size and usable printer margins before finalizing the compact preset.
Verify dense-layout fixtures against those approved limits and the user-selected page allowance.
Inspect long equations, fractions, matrices, subscripts, and superscripts for clipping and overlap.
Verify that an exceeded page allowance produces a warning without content loss.
Document setup, local storage limits, backup recovery, and the public deployment gate.

Gate: All acceptance checks pass. No public deployment occurs without separate approval.

## 7. Acceptance checks

- [ ] Every old worktree has a verified source checkpoint.
- [ ] The old worktree files, indexes, and stash entries remain unchanged.
- [ ] Retained stash history has verified backup refs.
- [ ] The first release uses a stable loopback origin and stops clearly if its port is busy.
- [ ] The launcher opens a protected local browser session without user accounts.
- [ ] Unauthorized, invalid-host, and unrelated-origin API requests fail safely.
- [ ] Editing, draft recovery, JSON export, and TeX export work without Docker.
- [ ] PDF compilation remains disabled until the Docker boundary is available and verified.
- [ ] The full workflow passes on Apple Silicon macOS with the Docker-managed compiler.
- [ ] The new application has no Python runtime dependency.
- [ ] The replacement contains no copied legacy components, hooks, services, or application plumbing.
- [ ] Tests, build configuration, CI, containers, setup scripts, and application documentation match the new design.
- [ ] Formula selection and block order have one source of truth.
- [ ] Formula removal preserves unrelated manual content.
- [ ] Local formula edits leave the shared catalog unchanged.
- [ ] Topics continue only between complete formula blocks, in the user's order.
- [ ] Built-in diagrams work without custom image uploads.
- [ ] Raw edits survive compilation, save, reload, and failed operations.
- [ ] Conversion and restoration cannot silently replace content.
- [ ] All layout fields survive save and reload.
- [ ] Invalid imports cannot damage the current document.
- [ ] Clear and Import preserve one replaced document before replacement.
- [ ] A failed recovery save stops replacement and offers export.
- [ ] JSON transfer preserves mode recovery without including an unrelated replaced document.
- [ ] Storage failures produce a visible error.
- [ ] The UI distinguishes draft recovery from portable document backups.
- [ ] Only one tab can edit a given draft.
- [ ] Clear/reset invalidates pending saves and responses.
- [ ] An old response cannot replace a current preview.
- [ ] TeX export matches the authoritative document.
- [ ] PDF export identifies the compiled document revision.
- [ ] Real offline compilation passes within enforced limits.
- [ ] Missing packages and fonts cause clear errors without network downloads.
- [ ] The compact preset defaults to A4 with manual density controls.
- [ ] Each new document requires a user-selected page allowance.
- [ ] Paper size and page allowance survive save, reload, export, and import.
- [ ] Representative structured outputs preserve all selected content and pass visual clipping and overlap checks.
- [ ] Page-allowance overflow produces a visible warning and retains all compiled pages.
- [ ] Detected oversized formula blocks require manual correction and cannot become successful current PDF exports.
- [ ] Raw TeX has a visual-review warning, not an automatic certificate of correct layout.
- [ ] Compilation success, automated diagnostics, and visual verification have distinct statuses.
- [ ] The user approves minimum body text size and printer margins from actual-size printed samples.
- [ ] Density checks use those approved limits without automatic fitting.
- [ ] Compiler abuse tests verify denied access to project files, home files, and the Docker socket.
- [ ] Compiler abuse tests pass before public access.
- [ ] Keyboard and mobile workflows pass.
- [ ] One CI pipeline validates the new server and UI.
- [ ] A clean checkout has reproducible setup and verification commands.

## 8. Deferred work

The first version excludes:

- Public hosting, public compiler access, and anonymous service operations.
- Accounts, JWT handling, and cloud synchronization.
- Shared projects, curated templates, and practice problems.
- Compatibility with old API endpoints or automatic database migration.
- Automatic migration of old browser drafts.
- A Rust browser UI, desktop application, or CLI product.
- Verified support for Linux, Windows, or Intel Mac hosts.
- Custom image uploads and portable asset packaging.
- A multi-version document recovery history.
- Full-width formula blocks and automatic formula shrinking.
- A Docker-free compiler runtime.
- Microservices, Redis, background job infrastructure, and plugin systems.
- A general LaTeX parser or automatic raw-to-structured conversion.
- Automatic compilation on each edit.
- Automatic fitting, layout searches, or claims of a globally smallest layout.
- A separate visual redesign project.
- Merges, force pushes, branch deletion, and cleanup of the old worktrees.

Old regression tests are references for behavior. Do not copy tests that depend on the old implementation structure.

## 9. Decisions required at execution

- Confirm the absence of production data and external API consumers.
- Select exact Rust, web framework, frontend, and compiler versions from current official documentation.
- Select the Docker and compiler image versions with explicit installation and download approval.
- Verify the Docker engine and the enforced compiler isolation on Apple Silicon macOS.
- Agree on numeric local compiler resource limits.
- Select the supported offline packages and fonts.
- Approve the minimum body text size and usable printer margins through actual-size printed samples.
- Do not reopen the confirmed A4 default, user-selected page allowance, or manual fit method without a new request.
- Confirm the backup destination and available disk space.
- Confirm any separate backup needs for ignored data and browser drafts.

Unresolved decisions block detailed implementation planning for the affected stage.
Do not generate task specifications or start implementation from an unresolved assumption.
Any further product choices require shared-understanding confirmation before plan updates.
Public compiler quotas belong to a later public-release decision, not to the first local version.

Preserve the earlier download approval gate.
Before each required installation, request approval for its exact version, source, and measured disk impact.
Items larger than 1 GiB require separate explicit approval.
Do not download dependencies, browser binaries, compiler assets, or container images during this planning session.

## 10. Prompt for the implementation session

This is one entry prompt for the complete rewrite, not a guarantee of completion in one uninterrupted run.
Installation approvals, backup verification, compiler isolation, and printed samples remain mandatory gates.
Pause at unmet gates rather than bypassing them or claiming completion.

> Read `docs/RUST_REWRITE_PLAN.md`, starting with the full rewrite mandate.
> Replace the entire application from scratch. This is not an incremental refactor or a direct language port.
> Use `docs/REFACTORING_PLAN.md` only for known defects and behavioral lessons, not as an execution plan.
> Use the full rewrite plan as the implementation scope.
> Preserve source changes from every worktree before any rewrite changes.
> Do not reset, merge, delete, or overwrite the old worktrees or replace `main`.
> Verify the backups before you create the isolated rewrite worktree.
> Build the Rust server and new TypeScript browser UI in the documented stages.
> Preserve the document invariants and compiler safety gates.
> Confirm the remaining decisions before the affected stage.
> Request installation approval as specified in the plan.
> Record actual verification results and unresolved risks after each stage.
> Do not claim completion with failing checks or an unsafe compiler boundary.

## 11. Confirmed execution decisions

The user approved source-only preservation in the private sibling backup directory.
The user confirmed that no production data migration or external API compatibility is required.
`docs/IMPLEMENTATION_STATUS.md` records preservation and the protected local foundation checks.

The user approved the exact locked application dependencies with a 512 MiB additional-output allowance.
That approval excludes Docker images, compiler assets, browser binaries, and toolchain installations.
The pre-approval automatic diagnostic downloads remain a recorded gate violation.

Before Stage 3, the user confirmed:

- Version 1 accepts A4 only. A4 remains the default.
- The structured renderer targets article/base LaTeX, amsmath, amssymb, amsfonts, geometry, multicol, and lmodern.
- The font baseline is Latin Modern and AMS fonts.
- Exact compiler assets, image versions, and downloads still require separate approval.

Before Stage 5, the user confirmed that raw imports without structured recovery cannot return to structured mode.
The raw editor and exports remain available. Clear can create a separate structured document with replacement recovery.
A later return to raw mode restores retained manual source rather than generating a replacement.
Its confirmation explains that structured edits do not merge into retained raw source.

The baseline does not establish a minimum body text size or usable printer margins.
Those limits still require actual-size printed samples.
Numeric document validation is not a printed-readability approval.
PDF compilation remains disabled until the verified Docker boundary is ready.

After commit `5f34d6e`, the user requested continuation into Stage 6 preparation.
The user selected Tectonic 0.17.0 for ARM64 Linux.
The user approved one job and no queue.

The approved maximums are 1 CPU, 512 MiB RAM, no swap, and 32 processes.

Scratch space is limited to 64 MiB. The timeout is 60 seconds.

The PDF limit is 10 MiB. The diagnostics limit is 64 KiB.

These limits require enforcement checks before compilation.
`docs/NEXT_SESSION.md` records the exact archive, extraction, and bundle-index approvals.
Additional downloads, the compiler image, and isolation verification remain separate gates.

The retained image passed only its approved version check. The earlier build-budget failure remains recorded.
Code-only compiler controls now have 42 passing checks and strict Clippy verification.
These cover admission, private files, bounded output, cancellation, container arguments, and a fake-engine lifecycle.
`docs/STAGE6_CONTROL_VERIFICATION.md` records the evidence and remaining limits.
The local Docker adapter, actual kernel checks, offline compilation, PDF validation, and preview integration remain pending.
