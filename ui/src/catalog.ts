import { decodeBlock, type FormulaBody } from "./document";

export interface Formula {
  id: string;
  label: string;
  body: FormulaBody;
}
export interface Category {
  id: string;
  label: string;
  formulas: Formula[];
}
export interface Subject {
  id: string;
  label: string;
  categories: Category[];
}
export interface Catalog {
  version: 1;
  subjects: Subject[];
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("The catalog response is invalid.");
  return value as Record<string, unknown>;
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error("A catalog list is invalid.");
  return value;
}

export function decodeCatalog(value: unknown): Catalog {
  const raw = object(value);
  if (raw.version !== 1)
    throw new Error("The catalog version is not supported.");
  const ids = new Set<string>();
  function entry(value: unknown) {
    const entry = object(value);
    // Reuse the canonical ID and label validation for every catalog level.
    const checked = decodeBlock({
      kind: "formula",
      id: entry.id,
      catalogId: entry.id,
      topicId: entry.id,
      topicLabel: entry.label,
      label: entry.label,
      body: { type: "math", latex: "" },
    });
    if (checked.kind !== "formula" || !checked.label || ids.has(checked.id))
      throw new Error(
        "Catalog IDs must be unique and labels must not be empty.",
      );
    ids.add(checked.id);
    return { raw: entry, id: checked.id, label: checked.label };
  }
  return {
    version: 1,
    subjects: list(raw.subjects).map((value) => {
      const subject = entry(value);
      return {
        id: subject.id,
        label: subject.label,
        categories: list(subject.raw.categories).map((value) => {
          const category = entry(value);
          return {
            id: category.id,
            label: category.label,
            formulas: list(category.raw.formulas).map((value) => {
              const formula = entry(value);
              const block = decodeBlock({
                kind: "formula",
                id: formula.id,
                catalogId: formula.id,
                topicId: category.id,
                topicLabel: category.label,
                label: formula.label,
                body: formula.raw.body,
              });
              if (block.kind !== "formula" || !block.body.latex)
                throw new Error("The catalog formula is invalid.");
              return { id: formula.id, label: formula.label, body: block.body };
            }),
          };
        }),
      };
    }),
  };
}
