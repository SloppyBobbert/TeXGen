# UI recovery and keyboard controls

Baseline: `82c5a1e9b0cd929ef69c7b136c3f2374b3a241ae`. Approved cycle: up to five confirmed UI fixes, one PR; no merge or deployment.

## Findings and implementation order

1. **Source export blocked after first compile failure.** Generate UNIT CIRCLE with a controlled compile 503. The draft contains 2477 source characters, but no source-download control exists because the download row requires a PDF. Show the existing source-download action whenever nonempty source exists. Keep PDF-only controls conditional on a PDF.
2. **Incorrect PDF failure message.** In the same case, the alert says it shows the last successful PDF, but no PDF exists. Make the message depend on actual PDF availability. Keep the detailed error.
3. **Unavailable history controls remain enabled.** On a fresh sheet, Back and Forward are enabled but do nothing. Use the hook's existing canGoBack/canGoForward values.
4. **Resize controls cannot be used with a keyboard.** Focus Resize subject panel and press ArrowRight: the grid remains `280px 10px 824px 10px 300px`. Apply arrow-key resizing through the existing layout limits and persistence. Cover subject, video, and LaTeX panels; retain pointer behavior.
5. **Dashboard cannot retry a failed load.** Inject a list GET 503, then restore the connection. The view remains an error with no buttons. Add an explicit Retry action, accessible loading/error status, and retain cancellation on auth changes/unmount.

## Evidence and limits

Browser evidence is under the worktree's private `.pi/`: desktop-before.png, mobile-before.png, editor-before.png, dashboard-error-before.png, compile-error-before.png. The controlled failures affect only this browser against the owned test stack. No production data was used.

No horizontal page overflow was found at widths 320, 390, 768, and 1440 on the initial editor. This is not proof for all states. Mobile checks use a browser viewport, not physical devices.

## Test and release plan

Add failing regressions for each behavior, then minimal fixes. Run focused tests after each fix. Verify keyboard boundaries, history states, source download content, both PDF error states, and Dashboard retry/cancellation. Recheck affected real-browser journeys and screenshots in light/dark themes. Run full frontend/backend checks, audits, and rebuilt browser tests. Obtain independent review, publish one PR, and verify exact-head CI.

Keep all existing security gates, timeouts, retries, dependencies, authentication, and saved-document formats. Do not claim to fix the historical sign-in timeout.
