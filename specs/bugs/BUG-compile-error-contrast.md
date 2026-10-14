# Follow-up: compile-error text contrast

Status: confirmed, deferred to the next approved cycle. This is a sixth finding; the current cycle is limited to five fixes.

## Reproduction

Generate a sheet with a controlled compile failure. Select the Light or Blossom theme. The error text uses pale red on a pale red background and is difficult to read. This styling existed before the current changes; the before and after screenshots show the same colors.

## Browser evidence

Measured on the owned production test stack at a 390-pixel viewport. Browser-computed colors were converted through canvas and alpha-composited over ancestor backgrounds. WCAG sRGB relative-luminance ratios:

| Theme | Foreground | Effective background | Contrast |
| --- | --- | --- | --- |
| Light | 252,165,165 | 227,205,205 | 1.25:1 |
| Blossom | 252,165,165 | 227,193,199 | 1.15:1 |
| Dark | 252,165,165 | 50,28,32 | 8.38:1 |

Other themes measured at least 5.67:1 for this element. This is a targeted measurement, not a complete accessibility audit.

## Proposed next fix

Use theme-appropriate error text/background colors. Add a browser contrast assertion for all nine themes, then inspect screenshots. Keep the existing error detail and live alert. Do not change document data or compilation behavior.

Before/after evidence remains in `.pi/compile-error-before.png` and `.pi/compile-error-after.png`. No CSS change was made in the current five-fix cycle.
