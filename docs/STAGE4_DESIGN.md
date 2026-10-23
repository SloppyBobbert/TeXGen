# Stage 4 implementation boundary

Status: Implemented. Stage 4 checks passed. See `docs/STAGE4_VERIFICATION.md`.

## Scope

Stage 4 replaces the connection placeholder with a structured editor.
The existing document format, catalog IDs, Rust renderer, and protected HTTP contracts remain unchanged.
The existing index remains unchanged. New source changes remain unstaged.

Affected files include the UI entry point, connection component, API client, styles, and their tests.
New modules own catalog decoding, the editor session, browser storage, and editor controls.
The browser verification harness must use the new editor assertions.
Documentation must distinguish the editor from the pending raw editor and compiler.

## Ownership and persistence

One editor session owns the active document and its monotonic session revision.
React subscribes to that session. Connection retries do not replace it.
Components receive state and action callbacks. They do not access HTTP or storage.

One new browser key stores an atomic envelope with the active document and one replaced document.
The envelope is not a portable document. JSON export uses the canonical active document only.
Each accepted edit attempts a synchronous draft save. There are no pending save timers.
A failed save retains the in-memory edit and displays an export action.
Replacement writes the complete envelope before it changes the active document.
A failed replacement save leaves the current document and recovery slot unchanged.

An exclusive Web Lock protects the draft key, not a changing document ID.
Other tabs remain read-only. Missing lock support does not permit writes.
A new writer reloads storage while it holds the lock.
Read-only tabs can refresh their view from storage notifications. Notifications do not grant ownership.

File reads and render requests carry the document ID, session revision, and operation identity.
Edits, replacement, clear, and session disposal invalidate prior operations.
Replacement increments the revision even when the imported document ID is unchanged.

## Controls and limits

The editor uses existing immutable block operations and stable block IDs.
Catalog selection and topic counts derive from formula blocks.
Topic removal leaves custom blocks unchanged.
New documents require an explicit page allowance. Version 1 remains A4-only.
The compact candidate uses the documented example values, not approved print limits.
No automatic fitting or shrinking is permitted.

Raw imports retain their source and mode recovery.
Their structured controls remain disabled. Raw editing and mode transitions belong to Stage 5.
TeX export uses the protected Rust renderer for structured documents.
PDF compilation remains disabled.

## Risk and checks

Risk: High. Draft replacement and writer ownership can cause data loss if they fail.

Checks must cover atomic recovery failure, ordinary save failure, malformed storage, invalid imports,
replacement races, same-ID imports, cancelled operations, export boundaries, and missing lock support.
Browser checks must verify save/reload, two tabs, writer release, keyboard controls, and a 320px layout.
Only an isolated browser profile is permitted.

No new package, tool, image, or browser download is necessary for this stage.
The approved output monitor and explicit locked, offline Rust commands remain required.
