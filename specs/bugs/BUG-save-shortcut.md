# Repeated save shortcut during a pending save

## Scope

Approved site-quality cycle, 2026-10-14. Baseline: `6fb1f0c89c8e65366c2ecbc561189c723e135876`.
Worktree: `.slim/worktrees/site-quality-cycle`. Preserve all other worktrees.

The retained site-quality diagnostic files match merged main byte for byte. Do not copy them.

## Confirmed defect

The Save buttons are disabled by `isSaving`, but Ctrl+S and Command+S call the same save handler without a pending-save check. Separate key presses can submit another save while the first is pending. App then aborts the earlier request. An aborted POST may already have reached the server.

## Plan

1. Prove that repeated shortcuts submit more than one pending save.
2. Guard the shared editor save handler before it calls `onSave`. Keep browser-default prevention. Release the guard after success or failure.
3. Cover Ctrl+S, Command+S, button/shortcut overlap, externally pending saves, and retry after failure.
4. Run frontend tests, lint, build, backend PostgreSQL checks, security checks, and browser journeys on an isolated stack.
5. Obtain independent review and open one PR. Do not merge or deploy.

## Boundaries

No API, authentication, dependency, timeout, retry, or document-format changes. Keep edits made during a save. Do not claim to fix the historical mobile sign-in timeout.

## Status

Both regression cases failed on unchanged application code: two calls instead of one for Ctrl+S and Command+S. Test-only commit: `e31b066`. Log: background task `b9846dc30`.

The handler now checks the parent saving state and a synchronous ref. A `finally` block releases the ref after success or failure. Tests also cover button/shortcut overlap, parent saving state, and retry after failure. Browser cases cover desktop and mobile, a delayed real create response, later edits, subsequent save, and Dashboard reopen.

Verification is in progress. No merge or deployment.
