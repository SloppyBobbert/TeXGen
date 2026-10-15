# UI polish batch

Baseline: `51716cd` (merged PR #17). Scope: seven small UI fixes in one PR. Keep the existing layout and theme identity. No dependency, authentication, compiler, data-format, or deployment changes.

## Confirmed defects

1. Compile/PDF-load errors are unreadable in Light and Blossom. Compile contrast was 1.25:1 and 1.15:1; PDF-load errors were 1.90:1 and 1.72:1. Dashboard error text also failed the 4.5:1 target across all nine themes (2.76–4.48:1). Use existing theme error tokens, including light error colors for Blossom.
2. Secondary text fails contrast in Light, Forest, Cool Grey, Neon, and Blossom. Measured editor ratios ranged from 2.23:1 to 4.46:1. Adjust only those themes' muted-text tokens.
3. Native controls have `color-scheme: normal` in all themes. Set dark by default and light for Light/Blossom.
4. Custom text-size and spacing inputs have no accessible name. Add distinct names without changing their values or validation.
5. Subject, video, LaTeX, and snapshot controls do not expose expanded state. Bind `aria-expanded` to the existing visible state.
6. Long Dashboard titles are clipped to one line on mobile, with no way to read the full title. Wrap titles within the card, including unbroken text.
7. Repeated Dashboard actions lack sheet-specific context. Describe each button with its existing card title; retain the visible button names and handlers.

## Regression checks

- Baseline frontend: 335 tests passed (`bb29cfee9`).
- Input-name/disclosure tests failed before the fix (`bdd5e85c6`); all 42 editor component tests passed afterward (`b84a9c07f`).
- Browser baseline failures: `bfaee3a16`, `b1b88ee63`, `b8c8e95de`, `b777032f6`.
- Early browser probes used selectors for states not yet rendered. These setup errors are not defect evidence. Corrected probes select a subject before reading the count, inject invalid PDF bytes before checking a PDF-load error, and use client navigation to retain the in-memory login session.
- Contrast uses computed colors, canvas conversion, alpha composition, and WCAG sRGB relative luminance. A solid/translucent-color self-check passed. The 4.5:1 threshold is not reduced for small failures.
- New browser tests cover nine themes, mobile title wrapping, control states, accessible names/descriptions, and error surfaces. Component tests also cover an untitled sheet and snapshot toggling.

Full verification and visual inspection must pass before publication. This is targeted UI verification, not complete accessibility certification or physical-device testing.
