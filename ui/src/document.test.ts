import { expect, test } from "vitest";
import fixture from "../../tests/fixtures/document.json";
import byteLimitFixture from "../../tests/fixtures/byte-limit-document.json";
import catalog from "../../data/catalog.json";
import {
  changeLayout,
  insertBlock,
  moveBlock,
  removeBlock,
  replaceBlock,
} from "./blocks";
import {
  createDocument,
  decodeDocument,
  encodeDocument,
  type FormulaBlock,
} from "./document";

function document() {
  return decodeDocument(structuredClone(fixture));
}

test("JSON round trips preserve layout, page allowance, raw source, and mode recovery", () => {
  const original = document();
  expect(decodeDocument(JSON.parse(encodeDocument(original)))).toEqual(
    original,
  );
  expect(original.layout.paper).toBe("A4");
  expect(original.pageAllowance).toBe(2);
  expect(original.modeRecovery?.content).toEqual(fixture.modeRecovery.content);
  const raw = decodeDocument({
    ...original,
    content: { mode: "raw", source: "\r\n% manual\n\\end{document}\n" },
  });
  expect(decodeDocument(JSON.parse(encodeDocument(raw))).content).toEqual(
    raw.content,
  );
});

test.each([999_990, 1_000_000, 1_000_001])(
  "browser and Rust share the compact JSON byte boundary: %i",
  (bytes) => {
    const input = structuredClone(byteLimitFixture);
    const padding =
      bytes - new TextEncoder().encode(JSON.stringify(input)).length;
    input.content.source = "x".repeat(Math.floor(padding / 2));
    input.modeRecovery.content.source = "x".repeat(Math.ceil(padding / 2));
    expect(new TextEncoder().encode(JSON.stringify(input)).length).toBe(bytes);
    if (bytes <= 1_000_000) expect(decodeDocument(input)).toEqual(input);
    else expect(() => decodeDocument(input)).toThrow("1,000,000 JSON bytes");
  },
);

test("new documents require an explicit positive page allowance", () => {
  expect(() => createDocument("new-document", 0, document().layout)).toThrow();
  expect(
    createDocument("new-document", 3, document().layout).pageAllowance,
  ).toBe(3);
});

test("formula removal uses the block ID and preserves unrelated manual content", () => {
  const original = document();
  const changed = removeBlock(original, "first-formula");
  expect(changed.content.mode).toBe("structured");
  if (
    changed.content.mode !== "structured" ||
    original.content.mode !== "structured"
  )
    throw new Error("Fixture mode");
  expect(changed.content.blocks.map((block) => block.id)).toEqual([
    "manual-notes",
    "second-formula",
    "manual-math",
  ]);
  expect(changed.content.blocks).toEqual(original.content.blocks.slice(1));
  expect(original).toEqual(document());
});

test("ordering follows complete blocks, not labels or catalog order", () => {
  const changed = moveBlock(document(), "second-formula", -1);
  if (changed.content.mode !== "structured") throw new Error("Fixture mode");
  expect(changed.content.blocks.map((block) => block.id)).toEqual([
    "first-formula",
    "second-formula",
    "manual-notes",
    "manual-math",
  ]);
  const original = document();
  expect(moveBlock(original, "first-formula", -1)).toBe(original);
});

test("local formula edits and line breaks do not change the catalog", () => {
  const originalCatalog = structuredClone(catalog);
  const subject = catalog.subjects[0];
  const category = subject.categories[0];
  const formula = category.formulas[0];
  const block: FormulaBlock = {
    kind: "formula",
    id: "new-block",
    catalogId: formula.id,
    topicId: category.id,
    topicLabel: `${subject.label}: ${category.label}`,
    label: formula.label,
    body: { type: "math", latex: formula.body.latex },
  };
  let changed = insertBlock(document(), block);
  const local = { ...block, body: { ...block.body, latex: "a=b\\\\\nc=d" } };
  changed = replaceBlock(changed, local);
  if (changed.content.mode !== "structured") throw new Error("Fixture mode");
  expect(changed.content.blocks.at(-1)).toEqual(local);
  expect(catalog).toEqual(originalCatalog);
  expect(block.body.latex).toBe(formula.body.latex);
});

test("layout changes preserve content and recovery", () => {
  const original = document();
  const changed = changeLayout(original, {
    ...original.layout,
    columns: 3,
    spacingPt: 0.5,
  });
  expect(changed.content).toEqual(original.content);
  expect(changed.modeRecovery).toEqual(original.modeRecovery);
});

test("structured controls cannot replace manual raw source", () => {
  const raw = decodeDocument({
    ...fixture,
    content: { mode: "raw", source: "manual source" },
  });
  expect(() => removeBlock(raw, "first-formula")).toThrow("raw source");
  expect(() => moveBlock(raw, "first-formula", 1)).toThrow("raw source");
  expect(() => changeLayout(raw, raw.layout)).toThrow("raw source");
  expect(raw.content).toEqual({ mode: "raw", source: "manual source" });
});

test("duplicate IDs, unsupported fields and papers, and invalid recovery are rejected", () => {
  const original = document();
  if (original.content.mode !== "structured") throw new Error("Fixture mode");
  const blocks = original.content.blocks;
  expect(() =>
    decodeDocument({
      ...original,
      content: { mode: "structured", blocks: [...blocks, blocks[0]] },
    }),
  ).toThrow("unique");
  expect(() =>
    decodeDocument({ ...original, generatedSource: "second owner" }),
  ).toThrow("unsupported fields");
  expect(() =>
    decodeDocument({ ...original, replacedDocument: original }),
  ).toThrow("unsupported fields");
  expect(() =>
    decodeDocument({
      ...original,
      layout: { ...original.layout, paper: "Letter" },
    }),
  ).toThrow("A4");
  expect(() =>
    decodeDocument({ ...original, modeRecovery: original }),
  ).toThrow();
  expect(() =>
    decodeDocument({
      ...original,
      modeRecovery: {
        layout: { ...original.layout, columns: 0 },
        content: original.content,
      },
    }),
  ).toThrow();
  expect(original).toEqual(document());
});

test("single-column gaps still have a bounded TeX dimension", () => {
  const original = document();
  expect(() =>
    decodeDocument({
      ...original,
      layout: { ...original.layout, columns: 1, columnGapMm: 211 },
    }),
  ).toThrow("gap");
});

test("numeric and Unicode boundaries fail safely without imposing a printed minimum", () => {
  const original = document();
  for (const fontPt of [0, Number.NaN, Number.POSITIVE_INFINITY, 9.0001, 73]) {
    expect(() =>
      decodeDocument({ ...original, layout: { ...original.layout, fontPt } }),
    ).toThrow();
  }
  expect(
    decodeDocument({
      ...original,
      layout: { ...original.layout, fontPt: 0.001 },
    }).layout.fontPt,
  ).toBe(0.001);
  expect(() => decodeDocument({ ...original, title: "\ud800" })).toThrow(
    "Unicode",
  );
});
