# e01s01: Remove generated topics without losing manual edits

## 1. Outcome

A user can remove a topic, compile, save, and reload without losing unrelated manual content.

## 2. Status

Planned; all tasks start unverified. Risk P0; 8 BCPs.

## 3. Baseline

Use the main revision and worktree procedure in `../../CONTINUOUS_PLAN.md`.

## 4. Users

People editing template-based or saved sheets, including signed-out draft users. Compilation still requires sign-in.

## 5. Scope

Stable generated-section identity, saved generation baselines, custom-content retention, removal confirmation, history, and end-to-end persistence.

## 6. Exclusions

No arbitrary LaTeX parser, automatic legacy conversion, compiler-policy changes, or complete editor rewrite.

## 7. MODIFIED requirements

**Before:** Selection removal changes selected formulas but does not reliably remove existing source. Generation replaces source. Generated comments use display names.

**After:** Structured removal deletes only known untouched generated blocks. Edited blocks require confirmation; cancel changes neither source nor selections. Confirmation checks the current document revision. Undo restores the previous source and selection together.

Raw documents remain authoritative. Legacy or damaged documents are preserved until explicit regeneration. Regeneration creates a recoverable snapshot before replacement.

Confirmed mode contract (supervisor, 2026-09-19): ordinary textarea edits in a newly generated document with verified persisted section metadata keep structured mode. Track manual modification separately. An explicit **Use raw source** action changes mode only, preserves source bytes and a recovery snapshot, and disables automatic removal. Existing saved raw documents remain raw, even with valid-looking markers. Only explicit regeneration can return raw content to structured mode. Damaged boundaries suspend automatic removal; show recovery instructions. Persist mode, metadata, baseline, and modification state through drafts and save/reload.

## 8. ADDED requirements

Stable formula/topic identity and the last generated baseline survive save/reload. Custom content stays distinct from generated content. Unknown, duplicate, missing, or altered boundaries stop automatic source rewriting.

## 9. Existing modules

Catalog → rendering → document contract/models/serializers → storage adapter → formulas/LaTeX hooks → creator/App. See `../../IMPACT_LATEST.md` for callers and contracts.

## 10. Minimal design

Reuse catalog formula IDs. Add stable topic IDs only where required for persisted topic boundaries. Use a versioned application-owned section format and retain the exact generated baseline needed to detect edits. Do not compare against a newly changed catalog.

Keep custom bytes and their order. Treat text crossing a section boundary, damaged markers, and changed wrappers as unsafe for automatic removal. In such cases, preserve the document and offer raw editing or explicit regeneration.

## 11. Reason for depth

One small section utility can own format validation and conservative edits for every removal entry point. This prevents category, class, and single-formula paths from using different deletion rules. Do not add a general parser or patch engine.

## 12. Data and migration

Use an additive, versioned document change only after proving that existing fields cannot represent the required baseline and custom content. Validate size, IDs, shape, and source consistency at the API boundary. A legacy row stays readable. A new browser does not silently mark legacy source as safe structured content.

## 13. Security

Treat LaTeX and markers as untrusted data. Markers must not enable extra packages, bypass permissions, or alter quota admission. Keep source size limits. No new security findings may remain in affected paths.

## 14. Steps

1. Establish the isolated baseline and confirm installed prerequisites → verify: task 1 in `e01s01-tasks.yaml`.
2. Add a failing user-journey regression, then implement stable generated blocks and persisted baselines through save/reload → verify: task 2.
3. Route all removal actions through one atomic source/selection update with confirm/cancel/undo → verify: task 3.
4. Cover legacy, raw, malformed-boundary, catalog-change, and stale-confirmation cases → verify: task 4.
5. Run the full suite and real-stack journey; obtain an independent review → verify: task 5.

## 15. Test cases

- Untouched formula, category, and class removal; sibling and last-category invariants.
- Edited removed block: cancel, confirm, undo, save/reload.
- Unrelated edits before, within, and after generated sections remain unchanged.
- New edit while a confirmation is open; late generate/compile/save after removal or clear.
- Duplicate display names with different IDs; stable identity after display-name changes.
- Missing/duplicate/unknown markers; marker-like custom text; invalid ordering; changed wrappers.
- Complete raw document and legacy draft remain byte-for-byte unchanged until explicit action.
- Changed catalog after save does not misclassify the saved block's manual edits.

## 16. Verification environment

Use the existing Python and Node environments. Real-stack tests require separately approved installed assets and running services. Never replace missing integration evidence with mocks.

## 17. Acceptance criteria

Every removal entry point follows the product rules. Source and selection change together. Unrelated content is retained exactly. Metadata, source, layout, and selections survive persistence. A damaged structure cannot trigger automatic deletion. Current-revision tests and review pass.

## 18. Manual verification

Create a template sheet. Edit one topic and add unrelated text. Remove an untouched topic. Cancel removal of the edited topic. Confirm it, then undo it. Compile, save, clear local storage, and reload. Check source, selections, layout, and the PDF. Repeat in raw mode; selection changes must not rewrite source.

## 19. Dependencies

No new package is proposed. Existing Django, React, Vitest, pytest, and Playwright: [OK]. A missing installation requires approval before use.

## 20. Handoff

Record commands and results under `specs/verifications/`. Mark tasks passing only after their checks pass. Continue to e01s02; preserve all new invariants during state consolidation.
