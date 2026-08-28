export const DRAFT_SCHEMA_VERSION = 1;
export const DRAFT_STORAGE_PREFIX = 'cheatSheetDraft:v1';

const LEGACY_FORMULAS_PREFIX = 'cheatSheetData';
const LEGACY_LATEX_KEY = 'cheatSheetLatex';
const LEGACY_HISTORY_PREFIX = 'cheatSheetCompileHistory';
const LEGACY_SOURCE_PREFIX = 'cheatSheetContentSource';
const LEGACY_CURRENT_SHEET_KEY = 'currentCheatSheet';
const SOURCE_MODES = new Set(['empty', 'generated', 'raw']);
const LAYOUT_KEYS = ['columns', 'font_size', 'spacing', 'margins', 'orientation'];

function resultError(code, message, details = {}) {
  return { ok: false, error: { code, message, ...details } };
}

function validIdentity(identity) {
  return (typeof identity === 'string' && identity.length > 0)
    || (typeof identity === 'number' && Number.isSafeInteger(identity));
}

function validFormulaId(formulaId) {
  return typeof formulaId === 'string' && formulaId.length > 0;
}

function hasUnsafePersistenceValue(value) {
  if (Array.isArray(value)) return value.some(hasUnsafePersistenceValue);
  if (!value || typeof value !== 'object') return false;

  return Object.entries(value).some(([key, item]) => key === 'pdfBlob' || hasUnsafePersistenceValue(item));
}

function storageGet(storage, key) {
  try {
    return { ok: true, value: storage.getItem(key) };
  } catch (cause) {
    return resultError('storage_read_failed', 'Unable to read browser draft storage.', { cause });
  }
}

function storageSet(storage, key, value) {
  try {
    storage.setItem(key, value);
    return { ok: true };
  } catch (cause) {
    return resultError('storage_write_failed', 'Unable to write browser draft storage.', { cause });
  }
}

function storageRemove(storage, key) {
  try {
    storage.removeItem(key);
    return { ok: true };
  } catch (cause) {
    return resultError('storage_remove_failed', 'Unable to remove browser draft storage.', { cause });
  }
}

function parseStoredJson(storage, key, label) {
  const read = storageGet(storage, key);
  if (!read.ok || read.value === null) return read.ok ? { ok: true, value: null } : read;

  try {
    return { ok: true, value: JSON.parse(read.value) };
  } catch (cause) {
    return resultError('malformed_legacy_storage', `Stored ${label} is not valid JSON.`, { key, cause });
  }
}

function legacyKey(prefix, identity) {
  return `${prefix}:${identity}`;
}

export function getDraftStorageKey(identity) {
  if (!validIdentity(identity)) return null;
  return `${DRAFT_STORAGE_PREFIX}:${typeof identity}:${encodeURIComponent(String(identity))}`;
}

export function getLegacyStorageKeys(identity) {
  if (!validIdentity(identity)) return null;
  return {
    formulas: legacyKey(LEGACY_FORMULAS_PREFIX, identity),
    latex: legacyKey(LEGACY_LATEX_KEY, identity),
    history: legacyKey(LEGACY_HISTORY_PREFIX, identity),
    source: legacyKey(LEGACY_SOURCE_PREFIX, identity),
    currentSheet: LEGACY_CURRENT_SHEET_KEY,
  };
}

export function validateDraftEnvelope(draft, expectedIdentity = draft?.draft_identity) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return resultError('invalid_draft', 'Draft envelope must be an object.');
  }
  if (draft.schema_version !== DRAFT_SCHEMA_VERSION) {
    return resultError('unsupported_schema_version', 'Draft schema_version must be 1.');
  }
  if (!validIdentity(draft.draft_identity) || draft.draft_identity !== expectedIdentity) {
    return resultError('draft_identity_mismatch', 'Draft identity does not exactly match the requested identity.');
  }
  if (draft.base_revision !== null && !(typeof draft.base_revision === 'number' && Number.isSafeInteger(draft.base_revision) && draft.base_revision >= 1)) {
    return resultError('invalid_base_revision', 'base_revision must be a positive integer or null.');
  }
  if (!SOURCE_MODES.has(draft.source_mode) || typeof draft.source_latex !== 'string') {
    return resultError('invalid_source', 'Draft source_mode or source_latex is invalid.');
  }
  if (!Array.isArray(draft.formula_selections)
    || draft.formula_selections.some((selection) => !selection || Object.keys(selection).length !== 1 || !validFormulaId(selection.formula_id))) {
    return resultError('invalid_formula_selections', 'formula_selections must be an ordered array of { formula_id }.');
  }
  if (!draft.layout || typeof draft.layout !== 'object' || Array.isArray(draft.layout)
    || LAYOUT_KEYS.some((key) => !(key in draft.layout))) {
    return resultError('invalid_layout', 'layout must include columns, font_size, spacing, margins, and orientation.');
  }
  if (!Number.isSafeInteger(draft.layout.columns) || draft.layout.columns < 1
    || ['font_size', 'spacing', 'margins'].some((key) => typeof draft.layout[key] !== 'string' || draft.layout[key].length === 0)
    || !['portrait', 'landscape'].includes(draft.layout.orientation)) {
    return resultError('invalid_layout', 'layout values are invalid.');
  }
  if (typeof draft.title !== 'string' || !Array.isArray(draft.history)) {
    return resultError('invalid_durable_state', 'title and history must be durable draft values.');
  }
  if (hasUnsafePersistenceValue(draft)) {
    return resultError('unsafe_transient_value', 'Drafts cannot persist transient pdfBlob fields.');
  }
  return { ok: true, draft };
}

export function readDraft(storage, identity) {
  const key = getDraftStorageKey(identity);
  if (!key) return resultError('invalid_draft_identity', 'A non-empty draft identity is required.');
  const read = storageGet(storage, key);
  if (!read.ok) return read;
  if (read.value === null) return { ok: true, draft: null, refetch_needed: false };

  let draft;
  try {
    draft = JSON.parse(read.value);
  } catch (cause) {
    return resultError('malformed_draft', 'Stored v1 draft is not valid JSON.', { key, cause, recoverable: true });
  }
  const validation = validateDraftEnvelope(draft, identity);
  if (!validation.ok) return { ...validation, recoverable: true, key };
  return { ok: true, draft, refetch_needed: draft.base_revision === null };
}

export function writeDraft(storage, draft, { legacy } = {}) {
  const validation = validateDraftEnvelope(draft);
  if (!validation.ok) return validation;
  if (legacy !== undefined && (!legacy || typeof legacy !== 'object' || hasUnsafePersistenceValue(legacy))) {
    return resultError('unsafe_legacy_value', 'Legacy compatibility values cannot contain transient pdfBlob fields.');
  }
  const key = getDraftStorageKey(draft.draft_identity);
  const written = storageSet(storage, key, JSON.stringify(draft));
  if (!written.ok) return written;

  if (legacy) {
    const keys = getLegacyStorageKeys(draft.draft_identity);
    const values = {
      formulas: legacy.formulas,
      latex: legacy.latex,
      history: legacy.history,
      source: legacy.source,
      currentSheet: legacy.currentSheet,
    };
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) continue;
      const serialized = name === 'source' ? String(value) : JSON.stringify(value);
      const legacyWritten = storageSet(storage, keys[name], serialized);
      if (!legacyWritten.ok) return { ...legacyWritten, draft, recoverable: true };
    }
  }
  return { ok: true, draft, refetch_needed: draft.base_revision === null, legacy_written: Boolean(legacy) };
}

export function removeDraft(storage, identity) {
  const key = getDraftStorageKey(identity);
  if (!key) return resultError('invalid_draft_identity', 'A non-empty draft identity is required.');
  return storageRemove(storage, key);
}

function sourceMode(source, latex) {
  if (!latex.trim()) return 'empty';
  return source === 'generated' ? 'generated' : 'raw';
}

function flattenLegacyFormulas(formulas) {
  if (!formulas) return [];
  if (Array.isArray(formulas)) return formulas;
  if (!Array.isArray(formulas.groupedFormulas)) return null;
  return formulas.groupedFormulas.flatMap((group) => Array.isArray(group?.formulas) ? group.formulas : []);
}

function resolveFormulaSelection(formula, resolveFormulaId, identity) {
  const resolved = validFormulaId(formula?.formula_id)
    ? formula.formula_id
    : (validFormulaId(formula?.id)
        ? formula.id
        : (resolveFormulaId ? resolveFormulaId(formula, identity) : null));
  const formulaId = resolved && typeof resolved === 'object' ? resolved.formula_id : resolved;
  return validFormulaId(formulaId) ? { formula_id: formulaId } : null;
}

export function migrateLegacyDraft(storage, identity, { resolveFormulaId } = {}) {
  const existing = readDraft(storage, identity);
  if (!existing.ok || existing.draft) return { ...existing, migrated: false };

  const keys = getLegacyStorageKeys(identity);
  if (!keys) return resultError('invalid_draft_identity', 'A non-empty draft identity is required.');
  const [formulasResult, latexResult, historyResult, currentSheetResult] = [
    parseStoredJson(storage, keys.formulas, 'formula selection'),
    parseStoredJson(storage, keys.latex, 'LaTeX draft'),
    parseStoredJson(storage, keys.history, 'compile history'),
    parseStoredJson(storage, keys.currentSheet, 'current sheet'),
  ];
  const sourceResult = storageGet(storage, keys.source);
  const firstError = [formulasResult, latexResult, historyResult, currentSheetResult, sourceResult].find((result) => !result.ok);
  if (firstError) return { ...firstError, recoverable: true, migrated: false };

  const currentSheet = currentSheetResult.value;
  const matchingCurrentSheet = currentSheet && (currentSheet.id === identity || currentSheet.draftId === identity)
    ? currentSheet
    : null;
  if (!formulasResult.value && !latexResult.value && !historyResult.value && !matchingCurrentSheet && sourceResult.value === null) {
    return { ok: true, draft: null, migrated: false, refetch_needed: false };
  }

  const legacyFormulaSource = formulasResult.value !== null
    ? formulasResult.value
    : (Array.isArray(matchingCurrentSheet?.formula_selections)
        ? matchingCurrentSheet.formula_selections
        : (Array.isArray(matchingCurrentSheet?.selectedFormulas) ? matchingCurrentSheet.selectedFormulas : []));
  const legacyFormulas = flattenLegacyFormulas(legacyFormulaSource);
  if (legacyFormulas === null) {
    return resultError('malformed_legacy_formula_records', 'Legacy formula selections have an unsupported shape.', { recoverable: true, migrated: false });
  }
  const selections = legacyFormulas.map((formula) => resolveFormulaSelection(formula, resolveFormulaId, identity));
  if (selections.some((selection) => selection === null)) {
    return resultError('unresolved_legacy_formula', 'Legacy formula selections could not be resolved to stable formula IDs.', { recoverable: true, migrated: false });
  }

  const latex = latexResult.value || {};
  const sourceLatex = typeof latex.content === 'string' ? latex.content : (typeof matchingCurrentSheet?.content === 'string' ? matchingCurrentSheet.content : '');
  const legacySource = latex.contentSource ?? matchingCurrentSheet?.contentSource ?? sourceResult.value;
  const layoutSource = latexResult.value || matchingCurrentSheet || {};
  const history = historyResult.value ?? matchingCurrentSheet?.compileHistory ?? [];
  const draft = {
    schema_version: DRAFT_SCHEMA_VERSION,
    draft_identity: identity,
    base_revision: typeof matchingCurrentSheet?.base_revision === 'number' && Number.isSafeInteger(matchingCurrentSheet.base_revision) && matchingCurrentSheet.base_revision >= 1
      ? matchingCurrentSheet.base_revision : null,
    source_mode: sourceMode(legacySource, sourceLatex),
    source_latex: sourceLatex,
    formula_selections: selections,
    layout: {
      columns: layoutSource.columns ?? 4,
      font_size: layoutSource.fontSize ?? '9pt',
      spacing: layoutSource.spacing ?? 'small',
      margins: layoutSource.margins ?? '0.15in',
      orientation: layoutSource.orientation ?? 'portrait',
    },
    title: typeof latex.title === 'string' ? latex.title : (typeof matchingCurrentSheet?.title === 'string' ? matchingCurrentSheet.title : ''),
    history: Array.isArray(history) ? history : [],
  };
  const written = writeDraft(storage, draft);
  return written.ok ? { ...written, migrated: true } : { ...written, migrated: false, recoverable: true };
}
