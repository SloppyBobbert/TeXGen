# Document format, version 1

Status: Stage 3 model checks and Stage 4/5 editor and recovery checks passed.
This document does not approve PDF output, font readability, or printer margins.

## Authority

One document contains its stable ID, title, page allowance, layout, active content, and optional mode recovery.
Structured content owns an ordered block list.
Raw content owns one complete source string, including any incomplete manual edits.
No generated-source field or independent selection list is permitted.
Rendered TeX is derived output.

Rust represents plain text and LaTeX with distinct types.
JSON uses distinct field names and tags.
Plain text receives TeX escaping. LaTeX fields do not.
Raw-mode source remains byte-exact after format validation.
The renderer does not parse raw source or add a missing document wrapper.

## Example

The page allowance of 3 is an example of a user selection, not a default.
The font and margin values are examples, not approved printed limits.

```json
{
  "version": 1,
  "id": "example-document",
  "title": "",
  "pageAllowance": 3,
  "layout": {
    "paper": "A4",
    "columns": 2,
    "marginsMm": 5,
    "fontPt": 9,
    "spacingPt": 1,
    "columnGapMm": 3
  },
  "content": { "mode": "structured", "blocks": [] },
  "modeRecovery": null
}
```

## Active content

Structured content has `mode: "structured"` and `blocks`.
Each block has a unique stable `id`.
Labels are display text, not identifiers. Duplicate display labels are permitted.

The block forms are:

- Formula: `kind`, `id`, `catalogId`, `topicId`, `topicLabel`, `label`, and `body`.
- Plain text: `kind: "text"`, `id`, and `text`.
- Mathematics: `kind: "math"`, `id`, and `latex`.

A formula body contains `type: "math"` or `type: "fragment"`, plus `latex`.
Mathematics uses an AMS `gathered` environment. Manual `\\` equation breaks remain in the source.
A fragment contains complete block markup, such as the built-in unit-circle table.
The document retains a local formula copy and the catalog identity.
Local edits do not change the shared catalog.
Saved formula content does not depend on the current catalog contents.

The renderer preserves block order.
Formula and custom-math blocks use unbreakable minipages.
A topic can continue in another column only between complete formula blocks.
The renderer does not shrink, reorder, or remove content to reach a page target.
Unbreakable boxes do not prove that their contents fit. Compiler diagnostics and visual checks remain mandatory.

Raw content has `mode: "raw"` and `source`.
Structured block and layout operations reject raw-mode documents.
Raw source controls its own layout. The stored structured-layout fields do not rewrite it.
The application does not parse raw paper commands or convert arbitrary raw source into blocks.

## Recovery and portability

`modeRecovery` is null or an object with `layout` and `content`.
It contains no nested recovery history and no document identity.
Its block IDs can match active block IDs because it is a separate content copy.
Validation checks both active content and the recovery copy.
Rendering uses active content only.

JSON export preserves the mode recovery copy.
The separate Clear/Import replacement slot is not part of this format.
Unknown fields, including `replacedDocument`, are rejected.
The Stage 4 browser session implements the separate replacement slot.
The browser key `texgen.draft.v1` contains an atomic envelope with `version: 1`, `active`, and `replaced`.
Both document fields contain a validated canonical document or null.
This envelope is not a portable export and is not accepted as a canonical document.
Before Clear, Import, or Restore changes the active document, one storage write preserves both copies.
If that write fails, the active document and the replacement slot remain unchanged.
Ordinary save failures retain the current in-memory edits and display an export action.

One Web Lock for the browser key grants writer ownership across document replacements.
A missing or denied lock leaves the session read-only.
The session revision increases across replacements, including imports with the same document ID.
File reads and rendering requests also retain a separate operation identity.
The editor rejects results from an earlier document, revision, or operation.

## Mode transitions

Stage 5 adds a raw editor to the existing session.
Each accepted raw edit saves the complete source through the same validation and draft path.
Incomplete TeX remains valid document content. Structured controls cannot change raw source.

The first conversion requests source from the Rust renderer.
The session checks document identity, revision, and operation ownership before it asks for confirmation.
One atomic write saves the structured recovery copy and active raw source before memory changes.
A failed write stops the conversion and offers JSON export.

Return to structured mode requires confirmation and a structured recovery copy.
The action restores that copy and saves the complete active raw source as mode recovery.
Raw edits do not become structured blocks.
When no structured recovery copy exists, return remains disabled.
The user confirmed this behavior for raw imports before Stage 5 implementation.
Clear can create a separate structured document through the existing replacement-recovery path.

When structured content retains raw mode recovery, the raw action restores that source instead of generating replacement source.
Confirmation explains that structured edits do not merge into the saved raw source.
The current structured content becomes mode recovery, including its layout.
Each transition restores the matching layout and retains the current title, identity, and page allowance.
Only the latest alternate content copy remains. No nested history or arbitrary TeX parser exists.
Mode changes never change the separate Clear/Import recovery slot.
Both recovery directions remain portable through canonical document JSON.

## Format checks

- Only version 1 is supported.
- IDs contain 1 through 96 ASCII letters, digits, hyphens, underscores, periods, or colons.
- The page allowance is an integer from 1 through 65,535. New documents require an explicit selection.
- Structured paper is A4 only.
- Columns range from 1 through 10, within the multicol capability.
- Layout values are finite, nonnegative numbers with at most three decimal places.
- Font size is positive and at most 72 pt. Spacing does not exceed 72 pt.
- Spacing controls the leading adjustment, block gaps, and AMS equation-row gaps.
- Margins and gaps must leave positive column width on A4 paper.
- A stored column gap cannot exceed the A4 paper width, including in single-column mode.
- The numeric precision is not a minimum readable body size.
- Labels and titles permit at most 512 UTF-8 bytes and no control characters.
- Plain-text blocks permit at most 200,000 UTF-8 bytes, with tabs and line endings permitted.
- Formula and custom-math source permit at most 32,768 UTF-8 bytes per block.
- Raw document source permits at most 500,000 UTF-8 bytes.
- LaTeX fields cannot contain a null character.
- Each structured content copy permits at most 1,024 blocks.
- The canonical document, including mode recovery, permits at most 1,000,000 compact JSON bytes.
- For this count, integral layout values have no decimal suffix. Negative zero is `0`. Rust and browser serialization use the same rule.

These checks do not certify LaTeX syntax, overflow, overlap, page count, printer compatibility, or readability.
They do not establish approved density limits.

## Protected API

All API operations require the local protected session and app request header.
POST requests also require the exact origin and JSON content type.
Request body collection has a five-second deadline and a 1 MiB limit.
This deadline does not interrupt compiler execution or owned cleanup.

- `GET /api/catalog` returns the validated static catalog.
- `POST /api/documents/validate` validates a document without changing server state.
- `POST /api/render` returns the one canonical TeX rendering path.

Both POST operations accept `document` and the editor's `revision`.
Successful responses echo `documentId` and `revision`.
The rendering response also contains `source`.
The session revision is not a persisted document field.
The browser must reject stale responses before it changes editor or preview state.

No endpoint compiles TeX or invokes Docker in this stage.
The renderer works without a Docker engine or native TeX installation.

## Catalog provenance

`data/catalog.json` contains 14 subjects, 76 categories, and 385 formulas.
The unit-circle table remains a complete fragment.
The conversion used only saved literal formula data. It did not execute Python modules or copy application plumbing.
`data/catalog-provenance.json` records source hashes, counts, the frozen source commit, and the catalog digest.
The converted labels and formula strings matched the saved source exactly.

Assigned catalog IDs are permanent.
After a label, order, or content change, preserve the existing IDs.
New entries require new IDs. Do not regenerate existing IDs from labels or positions.
`node scripts/verify-catalog.mjs` checks the recorded digest, counts, and ID uniqueness.
