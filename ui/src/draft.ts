import { decodeDocument, type Document } from "./document";

export const DRAFT_KEY = "texgen.draft.v1";

export interface Draft {
  version: 1;
  active: Document | null;
  replaced: Document | null;
}

export function decodeDraft(source: string | null): Draft {
  if (source === null) return { version: 1, active: null, replaced: null };
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error(
      "The draft JSON is invalid. Its stored contents remain unchanged.",
    );
  }
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== "active,replaced,version" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("active" in value) ||
    !("replaced" in value)
  )
    throw new Error(
      "The draft record is invalid. Its stored contents remain unchanged.",
    );
  return {
    version: 1,
    active: value.active === null ? null : decodeDocument(value.active),
    replaced: value.replaced === null ? null : decodeDocument(value.replaced),
  };
}

export function encodeDraft(draft: Draft): string {
  return JSON.stringify({
    version: 1,
    active: draft.active === null ? null : decodeDocument(draft.active),
    replaced: draft.replaced === null ? null : decodeDocument(draft.replaced),
  });
}
