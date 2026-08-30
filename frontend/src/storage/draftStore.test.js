import {
  DRAFT_SCHEMA_VERSION,
  getDraftStorageKey,
  migrateLegacyDraft,
  readDraft,
  removeDraft,
  writeDraft,
} from './draftStore';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function draft(identity = 'draft-a') {
  return {
    schema_version: DRAFT_SCHEMA_VERSION,
    draft_identity: identity,
    base_revision: null,
    source_mode: 'raw',
    source_latex: '\\alpha',
    formula_selections: [],
    layout: { columns: 4, font_size: '9pt', spacing: 'small', margins: '0.15in', orientation: 'portrait' },
    title: 'Untitled',
    history: [],
  };
}

describe('draftStore', () => {
  it('writes and reads the versioned envelope with explicit refetch state', () => {
    const storage = createStorage();
    expect(writeDraft(storage, draft())).toMatchObject({ ok: true, refetch_needed: true });
    expect(readDraft(storage, 'draft-a')).toMatchObject({ ok: true, draft: draft(), refetch_needed: true });
  });

  it('keeps identities exact and removes only the v1 envelope', () => {
    const storage = createStorage();
    writeDraft(storage, draft('1'));
    writeDraft(storage, draft(1));
    storage.setItem('cheatSheetLatex:1', JSON.stringify({ content: 'legacy' }));

    expect(readDraft(storage, '1').draft.draft_identity).toBe('1');
    expect(readDraft(storage, 1).draft.draft_identity).toBe(1);
    expect(removeDraft(storage, 1)).toMatchObject({ ok: true });
    expect(readDraft(storage, 1).draft).toBeNull();
    expect(storage.getItem('cheatSheetLatex:1')).not.toBeNull();
  });

  it('supports dual-writing caller-supplied legacy values', () => {
    const storage = createStorage();
    const result = writeDraft(storage, draft(), {
      legacy: { latex: { content: '\\alpha' }, source: 'manual' },
    });

    expect(result).toMatchObject({ ok: true, legacy_written: true });
    expect(JSON.parse(storage.getItem('cheatSheetLatex:draft-a'))).toEqual({ content: '\\alpha' });
    expect(storage.getItem('cheatSheetContentSource:draft-a')).toBe('manual');
  });

  it('does not overwrite malformed v1 data during migration', () => {
    const storage = createStorage();
    const key = getDraftStorageKey('draft-a');
    storage.setItem(key, '{not json');
    storage.setItem('cheatSheetLatex:draft-a', JSON.stringify({ content: 'legacy' }));

    expect(migrateLegacyDraft(storage, 'draft-a')).toMatchObject({ ok: false, error: { code: 'malformed_draft' } });
    expect(storage.getItem(key)).toBe('{not json');
  });

  it('migrates exact legacy records without deleting them or changing selection order', () => {
    const storage = createStorage();
    storage.setItem('cheatSheetData:draft-a', JSON.stringify({
      groupedFormulas: [{ formulas: [{ name: 'second' }, { name: 'first' }] }],
    }));
    storage.setItem('cheatSheetLatex:draft-a', JSON.stringify({ title: 'Legacy', content: 'x', contentSource: 'generated' }));
    storage.setItem('cheatSheetCompileHistory:draft-a', JSON.stringify([{ content: 'x' }]));
    storage.setItem('cheatSheetLatex:other', JSON.stringify({ content: 'wrong' }));

    const migrated = migrateLegacyDraft(storage, 'draft-a', { resolveFormulaId: (formula) => `${formula.name}-id` });
    expect(migrated).toMatchObject({ ok: true, migrated: true });
    expect(migrated.draft.formula_selections).toEqual([{ formula_id: 'second-id' }, { formula_id: 'first-id' }]);
    expect(migrated.draft.history).toEqual([{ content: 'x' }]);
    expect(storage.getItem('cheatSheetData:draft-a')).not.toBeNull();
    expect(migrateLegacyDraft(storage, 'draft-a')).toMatchObject({ ok: true, migrated: false });
  });

  it('leaves unresolved legacy formula records intact', () => {
    const storage = createStorage();
    const legacy = JSON.stringify({ groupedFormulas: [{ formulas: [{ name: 'missing' }] }] });
    storage.setItem('cheatSheetData:draft-a', legacy);

    expect(migrateLegacyDraft(storage, 'draft-a')).toMatchObject({ ok: false, error: { code: 'unresolved_legacy_formula' } });
    expect(storage.getItem('cheatSheetData:draft-a')).toBe(legacy);
    expect(storage.getItem(getDraftStorageKey('draft-a'))).toBeNull();
  });

  it('rejects transient PDF values instead of persisting them', () => {
    const storage = createStorage();
    const unsafe = { ...draft(), history: [{ pdfBlob: 'blob:unsafe' }] };
    expect(writeDraft(storage, unsafe)).toMatchObject({ ok: false, error: { code: 'unsafe_transient_value' } });
    expect(storage.getItem(getDraftStorageKey('draft-a'))).toBeNull();
  });

  it('round-trips durable blob-prefixed title and source text', () => {
    const storage = createStorage();
    const durable = {
      ...draft(),
      title: 'blob: durable title',
      source_latex: 'blob: durable source',
      history: [{ note: 'blob: durable history' }],
    };

    expect(writeDraft(storage, durable)).toMatchObject({ ok: true });
    expect(readDraft(storage, 'draft-a')).toMatchObject({ ok: true, draft: durable });
  });

  it('rejects nested transient pdfBlob state without rejecting durable blob text', () => {
    const storage = createStorage();
    const unsafe = { ...draft(), history: [{ note: 'blob: durable', nested: { pdfBlob: 'blob:pdf-preview' } }] };

    expect(writeDraft(storage, unsafe)).toMatchObject({ ok: false, error: { code: 'unsafe_transient_value' } });
    expect(storage.getItem(getDraftStorageKey('draft-a'))).toBeNull();
  });

  it('requires string formula IDs and positive integer revisions', () => {
    const storage = createStorage();
    expect(writeDraft(storage, { ...draft(), formula_selections: [{ formula_id: 7 }] }))
      .toMatchObject({ ok: false, error: { code: 'invalid_formula_selections' } });
    expect(writeDraft(storage, { ...draft(), base_revision: 0 }))
      .toMatchObject({ ok: false, error: { code: 'invalid_base_revision' } });
    expect(writeDraft(storage, { ...draft(), base_revision: 2, formula_selections: [{ formula_id: 'formula-7' }] }))
      .toMatchObject({ ok: true, refetch_needed: false });
    expect(writeDraft(storage, draft(Number.MAX_SAFE_INTEGER + 1))).toMatchObject({ ok: false });
  });

  it('rejects obviously invalid layout values', () => {
    const storage = createStorage();
    expect(writeDraft(storage, { ...draft(), layout: { ...draft().layout, columns: 0 } }))
      .toMatchObject({ ok: false, error: { code: 'invalid_layout' } });
    expect(writeDraft(storage, { ...draft(), layout: { ...draft().layout, orientation: 'sideways' } }))
      .toMatchObject({ ok: false, error: { code: 'invalid_layout' } });
  });

  it('uses exact current-sheet selections when no formula storage exists', () => {
    const storage = createStorage();
    storage.setItem('currentCheatSheet', JSON.stringify({
      draftId: 'draft-a',
      selectedFormulas: [{ name: 'second' }, { name: 'first' }],
    }));

    const migrated = migrateLegacyDraft(storage, 'draft-a', { resolveFormulaId: (formula) => `${formula.name}-id` });
    expect(migrated.draft.formula_selections).toEqual([{ formula_id: 'second-id' }, { formula_id: 'first-id' }]);
  });

  it('preserves an explicit empty current-sheet canonical selection array', () => {
    const storage = createStorage();
    storage.setItem('currentCheatSheet', JSON.stringify({ draftId: 'draft-a', formula_selections: [] }));

    const migrated = migrateLegacyDraft(storage, 'draft-a', { resolveFormulaId: () => { throw new Error('should not resolve'); } });
    expect(migrated).toMatchObject({ ok: true, migrated: true });
    expect(migrated.draft.formula_selections).toEqual([]);
  });

  it('does not use selections from an unrelated current sheet', () => {
    const storage = createStorage();
    storage.setItem('cheatSheetLatex:draft-a', JSON.stringify({ content: 'matching legacy draft' }));
    storage.setItem('currentCheatSheet', JSON.stringify({
      draftId: 'another-draft',
      selectedFormulas: [{ name: 'wrong' }],
    }));

    const migrated = migrateLegacyDraft(storage, 'draft-a', { resolveFormulaId: (formula) => `${formula.name}-id` });
    expect(migrated).toMatchObject({ ok: true, migrated: true });
    expect(migrated.draft.formula_selections).toEqual([]);
  });

  it('resolves each missing LaTeX layout field from the exact current sheet', () => {
    const storage = createStorage();
    storage.setItem('cheatSheetLatex:draft-a', JSON.stringify({ columns: 2, spacing: 'compact' }));
    storage.setItem('currentCheatSheet', JSON.stringify({
      draftId: 'draft-a',
      fontSize: '8pt',
      margins: '0.2in',
      orientation: 'landscape',
    }));

    const migrated = migrateLegacyDraft(storage, 'draft-a');
    expect(migrated.draft.layout).toEqual({
      columns: 2,
      font_size: '8pt',
      spacing: 'compact',
      margins: '0.2in',
      orientation: 'landscape',
    });
  });

  it('supports snake_case legacy layout fields', () => {
    const storage = createStorage();
    storage.setItem('cheatSheetLatex:draft-a', JSON.stringify({
      columns: 3,
      font_size: '10pt',
      spacing: 'tight',
      margins: '0.1in',
      orientation: 'landscape',
    }));

    expect(migrateLegacyDraft(storage, 'draft-a').draft.layout).toEqual({
      columns: 3,
      font_size: '10pt',
      spacing: 'tight',
      margins: '0.1in',
      orientation: 'landscape',
    });
  });

  it('does not use layout values from an unrelated current sheet', () => {
    const storage = createStorage();
    storage.setItem('cheatSheetLatex:draft-a', JSON.stringify({ columns: 2 }));
    storage.setItem('currentCheatSheet', JSON.stringify({
      draftId: 'another-draft',
      fontSize: '7pt',
      spacing: 'tight',
      margins: '1in',
      orientation: 'landscape',
    }));

    expect(migrateLegacyDraft(storage, 'draft-a').draft.layout).toEqual({
      columns: 2,
      font_size: '9pt',
      spacing: 'small',
      margins: '0.15in',
      orientation: 'portrait',
    });
  });

  it('uses all LaTeX layout values over matching current-sheet values and writes idempotently', () => {
    const storage = createStorage();
    storage.setItem('cheatSheetLatex:draft-a', JSON.stringify({
      columns: 2,
      fontSize: '8pt',
      spacing: 'compact',
      margins: '0.2in',
      orientation: 'landscape',
    }));
    storage.setItem('currentCheatSheet', JSON.stringify({
      draftId: 'draft-a',
      columns: 6,
      font_size: '12pt',
      spacing: 'wide',
      margins: '1in',
      orientation: 'portrait',
    }));

    const migrated = migrateLegacyDraft(storage, 'draft-a');
    expect(migrated).toMatchObject({ ok: true, migrated: true });
    expect(migrated.draft.layout).toEqual({
      columns: 2,
      font_size: '8pt',
      spacing: 'compact',
      margins: '0.2in',
      orientation: 'landscape',
    });
    expect(readDraft(storage, 'draft-a').draft).toEqual(migrated.draft);
    expect(migrateLegacyDraft(storage, 'draft-a')).toMatchObject({ ok: true, migrated: false, draft: migrated.draft });
  });

  it('uses layout defaults when neither matching legacy record provides a field', () => {
    const storage = createStorage();
    storage.setItem('cheatSheetLatex:draft-a', JSON.stringify({ content: 'legacy' }));

    expect(migrateLegacyDraft(storage, 'draft-a').draft.layout).toEqual({
      columns: 4,
      font_size: '9pt',
      spacing: 'small',
      margins: '0.15in',
      orientation: 'portrait',
    });
  });
});
