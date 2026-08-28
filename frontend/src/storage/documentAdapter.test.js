import { describe, expect, it } from 'vitest';
import { fromServerDocument, toCanonicalDocument } from './documentAdapter';

describe('documentAdapter', () => {
  it('creates a canonical create payload without a revision', () => {
    expect(toCanonicalDocument({
      title: 'Draft', content: 'x', contentSource: 'manual', columns: 2, fontSize: '10pt',
      spacing: 'normal', margins: '0.2in', orientation: 'landscape', formulaSelections: [], templateId: 'compact',
    })).toEqual({
      schema_version: 1, title: 'Draft', source_mode: 'raw', source_latex: 'x',
      layout: { columns: 2, font_size: '10pt', spacing: 'normal', margins: '0.2in', orientation: 'landscape' },
      formula_selections: [], template_id: 'compact',
    });
  });

  it('creates a patch payload using the exact positive revision and formula IDs', () => {
    expect(toCanonicalDocument({
      title: 'Draft', content: 'x', contentSource: 'generated', columns: 4, fontSize: '9pt',
      spacing: 'small', margins: '0.15in', orientation: 'portrait', revision: 7,
      selectedFormulas: [{ formula_id: 'first' }, { id: 'second' }],
    })).toMatchObject({ revision: 7, formula_selections: [{ formula_id: 'first' }, { formula_id: 'second' }] });
  });

  it('prefers canonical response fields and preserves selected_formulas compatibility', () => {
    expect(fromServerDocument({
      id: 3, schema_version: 1, revision: 4, source_mode: 'raw', source_latex: 'canonical',
      layout: { columns: 2, font_size: '10pt', spacing: 'normal', margins: '0.2in', orientation: 'landscape' },
      formula_selections: [], template_id: 'v1', latex_content: 'stale', content_source: 'manual', selected_formulas: [{ name: 'legacy' }],
    })).toMatchObject({
      id: 3, schemaVersion: 1, revision: 4, content: 'canonical', contentSource: 'manual',
      selectedFormulas: [], formulaSelections: [], templateId: 'v1', selected_formulas: [],
    });
  });
});
