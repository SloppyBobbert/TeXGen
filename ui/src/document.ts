export interface Layout {
  paper: "A4";
  columns: number;
  marginsMm: number;
  fontPt: number;
  spacingPt: number;
  columnGapMm: number;
}

export interface FormulaBody {
  type: "math" | "fragment";
  latex: string;
}

export interface FormulaBlock {
  kind: "formula";
  id: string;
  catalogId: string;
  topicId: string;
  topicLabel: string;
  label: string;
  body: FormulaBody;
}

export type Block =
  | FormulaBlock
  | { kind: "text"; id: string; text: string }
  | { kind: "math"; id: string; latex: string };

export type Content =
  { mode: "structured"; blocks: Block[] } | { mode: "raw"; source: string };

export interface ModeRecovery {
  layout: Layout;
  content: Content;
}

export interface Document {
  version: 1;
  id: string;
  title: string;
  pageAllowance: number;
  layout: Layout;
  content: Content;
  modeRecovery: ModeRecovery | null;
}

export const MAX_DOCUMENT_BYTES = 1_000_000;

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("A document object is required.");
  }
  return value as Record<string, unknown>;
}

function keys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
) {
  const allowed = new Set([...required, ...optional]);
  if (
    Object.keys(value).some((key) => !allowed.has(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new Error("The document has missing or unsupported fields.");
  }
}

function string(
  value: unknown,
  maxBytes: number,
  kind: "label" | "text" | "latex",
): string {
  if (
    typeof value !== "string" ||
    new TextEncoder().encode(value).length > maxBytes
  ) {
    throw new Error("A text field is invalid or exceeds its size limit.");
  }
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point >= 0xd800 && point <= 0xdfff) {
      throw new Error("Text must contain valid Unicode characters.");
    }
    const control = point < 32 || (point >= 127 && point <= 159);
    if (
      point === 0 ||
      (kind === "label" && control) ||
      (kind === "text" && control && ![9, 10, 13].includes(point))
    ) {
      throw new Error("Text contains unsupported control characters.");
    }
  }
  return value;
}

function identity(value: unknown): string {
  const id = string(value, 96, "label");
  if (!/^[a-zA-Z0-9_.:-]{1,96}$/.test(id)) throw new Error("An ID is invalid.");
  return id;
}

function integer(value: unknown, minimum: number, maximum: number): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error("An integer value is outside its supported range.");
  }
  return value;
}

function dimension(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    Number(value.toFixed(3)) !== value
  ) {
    throw new Error(
      "Layout values need at most three decimal places and must be finite and nonnegative.",
    );
  }
  return value;
}

export function decodeLayout(value: unknown): Layout {
  const raw = object(value);
  keys(raw, [
    "paper",
    "columns",
    "marginsMm",
    "fontPt",
    "spacingPt",
    "columnGapMm",
  ]);
  if (raw.paper !== "A4") throw new Error("Version 1 supports A4 only.");
  const layout: Layout = {
    paper: "A4",
    columns: integer(raw.columns, 1, 10),
    marginsMm: dimension(raw.marginsMm),
    fontPt: dimension(raw.fontPt),
    spacingPt: dimension(raw.spacingPt),
    columnGapMm: dimension(raw.columnGapMm),
  };
  if (layout.fontPt <= 0 || layout.fontPt > 72 || layout.spacingPt > 72) {
    throw new Error(
      "The font size must be positive and at most 72 pt. Spacing must not exceed 72 pt.",
    );
  }
  if (layout.columnGapMm > 210) {
    throw new Error("The column gap cannot exceed the A4 paper width.");
  }
  if (
    layout.marginsMm >= 105 ||
    210 - 2 * layout.marginsMm - (layout.columns - 1) * layout.columnGapMm <= 0
  ) {
    throw new Error("Margins and column gaps leave no usable A4 column width.");
  }
  return layout;
}

export function decodeBlock(value: unknown): Block {
  const raw = object(value);
  const id = identity(raw.id);
  if (raw.kind === "formula") {
    keys(raw, [
      "kind",
      "id",
      "catalogId",
      "topicId",
      "topicLabel",
      "label",
      "body",
    ]);
    const body = object(raw.body);
    keys(body, ["type", "latex"]);
    if (body.type !== "math" && body.type !== "fragment")
      throw new Error("The formula body type is invalid.");
    return {
      kind: "formula",
      id,
      catalogId: identity(raw.catalogId),
      topicId: identity(raw.topicId),
      topicLabel: string(raw.topicLabel, 512, "label"),
      label: string(raw.label, 512, "label"),
      body: { type: body.type, latex: string(body.latex, 32_768, "latex") },
    };
  }
  if (raw.kind === "text") {
    keys(raw, ["kind", "id", "text"]);
    return { kind: "text", id, text: string(raw.text, 200_000, "text") };
  }
  if (raw.kind === "math") {
    keys(raw, ["kind", "id", "latex"]);
    return { kind: "math", id, latex: string(raw.latex, 32_768, "latex") };
  }
  throw new Error("The block type is not supported.");
}

function content(value: unknown): Content {
  const raw = object(value);
  if (raw.mode === "raw") {
    keys(raw, ["mode", "source"]);
    return { mode: "raw", source: string(raw.source, 500_000, "latex") };
  }
  if (raw.mode !== "structured")
    throw new Error("The content mode is not supported.");
  keys(raw, ["mode", "blocks"]);
  if (!Array.isArray(raw.blocks) || raw.blocks.length > 1024)
    throw new Error("The block list is invalid or exceeds 1,024 blocks.");
  const blocks = raw.blocks.map(decodeBlock);
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length)
    throw new Error("Block IDs must be unique within their content copy.");
  return { mode: "structured", blocks };
}

export function decodeDocument(value: unknown): Document {
  const raw = object(value);
  keys(
    raw,
    ["version", "id", "title", "pageAllowance", "layout", "content"],
    ["modeRecovery"],
  );
  if (raw.version !== 1)
    throw new Error("This document version is not supported.");
  let recovery: ModeRecovery | null = null;
  if (raw.modeRecovery !== undefined && raw.modeRecovery !== null) {
    const saved = object(raw.modeRecovery);
    keys(saved, ["layout", "content"]);
    recovery = {
      layout: decodeLayout(saved.layout),
      content: content(saved.content),
    };
  }
  const document: Document = {
    version: 1,
    id: identity(raw.id),
    title: string(raw.title, 512, "label"),
    pageAllowance: integer(raw.pageAllowance, 1, 65535),
    layout: decodeLayout(raw.layout),
    content: content(raw.content),
    modeRecovery: recovery,
  };
  if (
    new TextEncoder().encode(JSON.stringify(document)).length >
    MAX_DOCUMENT_BYTES
  ) {
    throw new Error(
      "The document and its mode recovery exceed 1,000,000 JSON bytes.",
    );
  }
  return document;
}

export function encodeDocument(document: Document): string {
  return JSON.stringify(decodeDocument(document), null, 2);
}

export function createDocument(
  id: string,
  pageAllowance: number,
  layout: Layout,
): Document {
  return decodeDocument({
    version: 1,
    id,
    title: "",
    pageAllowance,
    layout,
    content: { mode: "structured", blocks: [] },
    modeRecovery: null,
  });
}
