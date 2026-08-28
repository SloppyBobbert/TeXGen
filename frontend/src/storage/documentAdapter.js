const has = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const positiveRevision = (value) => Number.isSafeInteger(value) && value > 0;

export const toCanonicalDocument = (sheet) => {
  const formulaSelections = Array.isArray(sheet.formulaSelections)
    ? sheet.formulaSelections
    : (Array.isArray(sheet.selectedFormulas)
        ? sheet.selectedFormulas
          .map((formula) => formula?.formula_id ?? formula?.id)
          .filter((formulaId) => typeof formulaId === 'string' && formulaId.length > 0)
          .map((formula_id) => ({ formula_id }))
        : []);
  const document = {
    schema_version: 1,
    title: sheet.title ?? '',
    source_mode: sheet.contentSource === 'manual' ? 'raw' : (sheet.contentSource ?? 'empty'),
    source_latex: sheet.content ?? '',
    layout: {
      columns: sheet.columns ?? 4,
      font_size: sheet.fontSize ?? '9pt',
      spacing: sheet.spacing ?? 'small',
      margins: sheet.margins ?? '0.15in',
      orientation: sheet.orientation ?? 'portrait',
    },
    formula_selections: formulaSelections,
    template_id: sheet.templateId ?? null,
  };
  return positiveRevision(sheet.revision) ? { ...document, revision: sheet.revision } : document;
};

export const fromServerDocument = (document = {}) => {
  const canonical = has(document, 'schema_version') || has(document, 'source_latex') || has(document, 'layout');
  const layout = canonical && document.layout && typeof document.layout === 'object' ? document.layout : {};
  const formulaSelections = canonical && has(document, 'formula_selections')
    ? document.formula_selections
    : document.selected_formulas;
  const selectedFormulas = Array.isArray(formulaSelections) ? formulaSelections : undefined;
  return {
    id: document.id,
    schemaVersion: canonical ? document.schema_version : undefined,
    revision: canonical ? document.revision : undefined,
    baseRevision: canonical ? document.revision : undefined,
    title: document.title,
    content: canonical && has(document, 'source_latex') ? document.source_latex : document.latex_content,
    contentSource: canonical && has(document, 'source_mode')
      ? (document.source_mode === 'raw' ? 'manual' : document.source_mode)
      : document.content_source,
    columns: canonical && has(layout, 'columns') ? layout.columns : document.columns,
    fontSize: canonical && has(layout, 'font_size') ? layout.font_size : document.font_size,
    spacing: canonical && has(layout, 'spacing') ? layout.spacing : document.spacing,
    margins: canonical && has(layout, 'margins') ? layout.margins : document.margins,
    orientation: canonical && has(layout, 'orientation') ? layout.orientation : document.orientation,
    formulaSelections: canonical && has(document, 'formula_selections') ? document.formula_selections : undefined,
    selectedFormulas,
    selected_formulas: selectedFormulas,
    templateId: canonical && has(document, 'template_id') ? document.template_id : undefined,
  };
};
