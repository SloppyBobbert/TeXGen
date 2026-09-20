# e01s02: Make editor actions consistent and accessible

## 1. Outcome

Users can edit and recover documents with consistent actions on desktop, mobile, and a keyboard.

## 2. Status

Passing; risk P0; 8 BCPs. Both independent reviews passed at 100%. Final evidence: `specs/verifications/e01s02-acceptance.md`.

## 3. Baseline

Start from verified e01s01. Recheck the source revision and task evidence.

## 4. Users

Signed-in sheet users, signed-out draft users, mobile users, and keyboard users.

## 5. Scope

Editor state ownership, request handling, recovery, UI error states, responsive layout, accessibility, and focused component decomposition.

## 6. Exclusions

No framework change, new state library, broad redesign, or replacement of working cancellation and PDF lifecycle code.

## 7. MODIFIED requirements

**Before:** Source and selections are held in separate hooks; App and components also coordinate persistence and requests.

**After:** A single editor session owns document-changing transitions. Requests use a consistent error/authentication contract. Mobile and keyboard actions expose the same behavior as pointer actions.

## 8. Retained requirements

Retain all e01s01 rules, namespaced drafts, operation invalidation, authentication policy, save conflict behavior, compile snapshots, and the last valid PDF after failed compilation.

## 9. Existing modules

`App.jsx`, `CreateCheatSheet.jsx`, `Dashboard.jsx`, `AuthContext.jsx`, `hooks/formulas.js`, `hooks/latex.js`, `hooks/youtubeResources.js`, and `storage/`.

## 10. Minimal design

Introduce the smallest reducer-backed session that owns source, layout, ordered selections, section state, and recovery transitions. Keep network work outside the reducer. Move existing behavior incrementally; do not keep two authoritative document copies.

## 11. Reason for depth

A single session transition prevents source, selection, history, and request versions from changing independently. A small request helper is justified for shared auth/error/cancellation behavior; it is not a general networking framework.

## 12. Storage and API contracts

Retain document revision checks, draft namespace precedence, empty selections, and old draft migration. Keep local UI state local. Authentication refresh must be bounded and must not replay unsafe saves or compiles automatically without an explicit retry rule.

## 13. Security

Never log tokens or put them in URLs. Preserve owner checks. Cancellation is not proof that a server operation did not run. Do not retry a compile in a way that duplicates quota charges. No new security findings may remain in affected paths.

## 14. Steps

1. Add transition regressions and consolidate document-changing state one action at a time → verify: task 1 in `e01s02-tasks.yaml`.
2. Centralize repeated request handling without changing public API semantics → verify: task 2.
3. Complete abort, save-conflict, history, PDF, and failure/retry recovery checks → verify: task 3.
4. Audit existing UI behavior; repair confirmed mobile, dialog, keyboard, status, and reduced-motion gaps. Extract components only where it reduces the changed code → verify: task 4.
5. Run complete checks and independent review → verify: task 5.

## 15. Test cases

Generate, Compile, Save, Clear, Restore, Regenerate, topic removal, confirm/cancel, undo/redo; overlapping operations; unmount; token expiry; failed refresh; failed compile; invalid save revision; draft migration; object URL replacement and cleanup.

## 16. Browser coverage

Add `frontend/e2e/editor-accessibility.spec.js` using existing Playwright. Test 320px, 375px, 768px, and desktop, plus a short landscape viewport. Check horizontal overflow, action visibility, dialog focus/return/Escape, selection keyboard access, live status, and reduced motion. Use deterministic assertions, not screenshots alone.

## 17. Acceptance criteria

One document state owner controls user actions. Newer actions invalidate old publication. Errors retain work and offer safe recovery. No unrelated API or token behavior changes. Existing and new journeys pass on all specified widths and with keyboard input.

## 18. Manual verification

Use a keyboard to create, select, remove, confirm, cancel, compile, save, and reopen a sheet. Open and close the video dialog. Repeat at the narrowest width and in landscape. A failed compile retains the prior PDF and identifies it as an older result.

## 19. Dependencies

React, native AbortController, existing test tools, and CSS: [OK]. No new package is proposed. Fetch current framework documentation before relying on API details during implementation.

## 20. Handoff

Record the changed state contract and test evidence. Update stale checklist entries only after verification. Continue to production readiness.
