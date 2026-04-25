import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFormulas } from '../hooks/formulas';
import { useLatex } from '../hooks/latex';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function SortableFormulaItem({ id, formula, onRemove, className }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ 
    id,
    data: { type: 'formula', class: formula.class }
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    position: 'relative',
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
  };

  return (
    <div ref={setNodeRef} style={style} className={`sortable-formula-item ${className || ''}`}>
      <span className="drag-handle" {...attributes} {...listeners}>⋮⋮</span>
      <span className="formula-name" style={{ fontStyle: 'italic' }}>{formula.name}</span>
      <span className="formula-class" style={{ fontStyle: 'italic' }}>{formula.class}</span>
      <button 
        type="button" 
        className="remove-formula" 
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        ×
      </button>
    </div>
  );
}

function SortableClassGroup({ group, isCollapsed, onToggleCollapse, onRemoveClass, onRemoveFormula }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ 
    id: `class-${group.class}`,
    data: { type: 'class' }
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    position: 'relative',
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
  };

  return (
    <div ref={setNodeRef} style={style} className={`formula-class-group ${isCollapsed ? 'collapsed' : ''}`}>
      <div 
        className="class-group-header" 
        onClick={onToggleCollapse}
        {...attributes} 
        {...listeners}
      >
        <div className="class-group-main">
          <span className="drag-handle">⋮⋮</span>
          <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
          <span 
            className="class-group-title" 
            style={{ fontWeight: 'bold', marginLeft: '0.5rem' }}
          >
            {group.class} ({group.formulas.length})
          </span>
        </div>
        <div className="class-group-actions">
          <button 
            type="button" 
            className="class-group-btn remove" 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemoveClass(group.class);
            }} 
            title="Remove all"
          >
            ×
          </button>
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="class-group-formulas">
          <SortableContext items={group.formulas.map(f => `formula-${group.class}-${f.category}-${f.name}`)} strategy={verticalListSortingStrategy}>
            {group.formulas.map(f => (
              <SortableFormulaItem 
                key={`${f.category}-${f.name}`}
                id={`formula-${group.class}-${f.category}-${f.name}`}
                formula={f}
                className="nested"
                onRemove={() => onRemoveFormula(f.category, f.name)}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

function FormulaReorderPanel({ groupedFormulas, onReorderClass, onReorderFormula, onRemoveClass, onRemoveFormula }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [expandedGroups, setExpandedGroups] = React.useState({});

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;
    
    if (activeType === 'class' && overType === 'class') {
      const oldIndex = groupedFormulas.findIndex(g => `class-${g.class}` === active.id);
      const newIndex = groupedFormulas.findIndex(g => `class-${g.class}` === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderClass(oldIndex, newIndex);
      }
    } else if (activeType === 'formula' && overType === 'formula') {
      const activeClass = active.data.current?.class;
      const overClass = over.data.current?.class;
      
      if (activeClass === overClass) {
        const group = groupedFormulas.find(g => g.class === activeClass);
        if (group) {
          const oldIndex = group.formulas.findIndex(f => `formula-${activeClass}-${f.category}-${f.name}` === active.id);
          const newIndex = group.formulas.findIndex(f => `formula-${overClass}-${f.category}-${f.name}` === over.id);
          if (oldIndex !== -1 && newIndex !== -1) {
            onReorderFormula(activeClass, oldIndex, newIndex);
          }
        }
      }
    }
  };

  const toggleGroup = (className) => {
    setExpandedGroups(prev => ({ ...prev, [className]: !prev[className] }));
  };

  if (groupedFormulas.length === 0) return null;

  return (
    <div className="formula-reorder-panel">
      <label style={{ fontWeight: 'bold', marginTop: '1rem', marginBottom: '0.5rem', display: 'block' }}>
        Drag to reorder formulas (top appears first in PDF)
      </label>
      <div className="reorder-instructions">
        <span>Click the bar to collapse. Click and hold to move.</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={groupedFormulas.map(g => `class-${g.class}`)} strategy={verticalListSortingStrategy}>
          {groupedFormulas.map(group => (
            <SortableClassGroup 
              key={group.class}
              group={group}
              isCollapsed={!expandedGroups[group.class]}
              onToggleCollapse={() => toggleGroup(group.class)}
              onRemoveClass={onRemoveClass}
              onRemoveFormula={(categoryName, formulaName) => onRemoveFormula(group.class, categoryName, formulaName)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

const FormulaSelection = ({ 
  classesData, 
  selectedClasses, 
  selectedCategories, 
  groupedFormulas,
  toggleClass, 
  toggleCategory, 
  onGenerate, 
  isGenerating, 
  selectedCount, 
  hasSelectedClasses,
  onReorderClass,
  onReorderFormula,
  onRemoveClass,
  onRemoveFormula
}) => (
  <div className="formula-selection">
    <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
      Select classes
    </label>
    
    <div className="class-checkboxes">
      {classesData.map((cls) => {
        const isChecked = !!selectedClasses[cls.name];
        return (
          <label key={cls.name} className={`class-checkbox-label ${isChecked ? 'checked' : ''}`} onClick={(e) => {
            e.preventDefault();
            toggleClass(cls.name);
          }}>
            <input
              type="checkbox"
              checked={isChecked}
              readOnly
            />
            {cls.name}
          </label>
        );
      })}
    </div>

    {hasSelectedClasses && (
      <div className="category-dropdowns">
        <label style={{ fontWeight: 'bold', marginTop: '1rem', marginBottom: '0.5rem', display: 'block' }}>
          Select sections
        </label>
        
        {classesData.map((cls) => {
          if (!selectedClasses[cls.name]) return null;
          
          const isSpecialClass = cls.is_special || (cls.categories.length === 1 && cls.categories[0].name === cls.name);
          
          if (isSpecialClass) {
            return (
              <div key={cls.name} className="class-category-section">
                <p style={{ fontSize: '0.9rem', color: '#666', marginLeft: '0.5rem' }}>
                  ✓ {cls.name} selected - all formulas included
                </p>
              </div>
            );
          }
          
          return (
            <div key={cls.name} className="class-category-section">
              <label className="class-category-label">{cls.name}:</label>
              <label className="select-all-label">
                <input
                  type="checkbox"
                  checked={cls.categories.every(cat => selectedCategories[`${cls.name}:${cat.name}`])}
                  onChange={() => {
                    const allSelected = cls.categories.every(cat => selectedCategories[`${cls.name}:${cat.name}`]);
                    cls.categories.forEach(cat => {
                      if (allSelected) {
                        toggleCategory(cls.name, cat.name);
                      } else if (!selectedCategories[`${cls.name}:${cat.name}`]) {
                        toggleCategory(cls.name, cat.name);
                      }
                    });
                  }}
                />
                Include all sections
              </label>
              <div className="category-checkboxes">
                {cls.categories.map((cat) => {
                  const key = `${cls.name}:${cat.name}`;
                  const isChecked = !!selectedCategories[key];
                  return (
                    <label key={cat.name} className={`category-checkbox-label ${isChecked ? 'checked' : ''}`} onClick={(e) => {
                      e.preventDefault();
                      toggleCategory(cls.name, cat.name);
                    }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                      />
                      {cat.name} ({cat.formulas.length} formulas)
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    )}

    <FormulaReorderPanel 
      groupedFormulas={groupedFormulas} 
      onReorderClass={onReorderClass}
      onReorderFormula={onReorderFormula}
      onRemoveClass={onRemoveClass}
      onRemoveFormula={onRemoveFormula}
    />

    <button
      type="button"
      onClick={onGenerate}
      className="btn primary generate-btn"
      disabled={isGenerating || selectedCount === 0}
    >
      {isGenerating ? 'Generating...' : 'Generate Cheat Sheet'}
    </button>

    {selectedCount > 0 && (
      <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
        {selectedCount} formula(s) will be included
      </p>
    )}
  </div>
);

const COMPILE_ERROR_LINE_REGEX = /document\.tex:(\d+):/g;
const APP_LAYOUT_COMMENT_PREFIX = '% @cheatsheet-layout';

const escapeHtml = (value = '') => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const highlightLatexLine = (line = '') => {
  if (line.trimStart().startsWith(APP_LAYOUT_COMMENT_PREFIX)) {
    return `<span class="latex-token app-comment">${escapeHtml(line)}</span>`;
  }

  const placeholders = [];
  const stashToken = (html) => {
    const placeholder = `LATEXTOKEN${placeholders.length}PLACEHOLDER`;
    placeholders.push(html);
    return placeholder;
  };

  let html = escapeHtml(line);

  html = html.replace(/%.*$/g, (match) => stashToken(`<span class="latex-token comment">${match}</span>`));
  html = html.replace(/\\[a-zA-Z@]+|\\./g, (match) => stashToken(`<span class="latex-token command">${match}</span>`));
  html = html.replace(/[{}[\]]/g, (match) => `<span class="latex-token brace">${match}</span>`);
  html = html.replace(/[$&#_^]/g, (match) => `<span class="latex-token symbol">${match}</span>`);

  html = html.replace(/LATEXTOKEN(\d+)PLACEHOLDER/g, (_, index) => placeholders[Number(index)] ?? '');

  return html || '&nbsp;';
};

const extractCompileErrorLines = (compileError = '') => {
  const normalizedError = compileError || '';
  const lineNumbers = new Set();

  for (const match of normalizedError.matchAll(COMPILE_ERROR_LINE_REGEX)) {
    lineNumbers.add(Number(match[1]));
  }

  return lineNumbers;
};

const getCompileErrorSummary = (compileError = '') => {
  const normalizedError = compileError || '';

  if (!normalizedError) {
    return '';
  }

  const lineMatch = normalizedError.match(/document\.tex:(\d+):\s*([^\n]+)/);
  if (lineMatch) {
    return `Line ${lineMatch[1]}: ${lineMatch[2].replace(/^error:\s*/i, '').trim()}`;
  }

  return (normalizedError.split('\n').find((line) => line.trim()) || '').replace(/^error:\s*/i, '').trim();
};

const LatexEditor = ({ content, onChange, isModified, compileError }) => {
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const highlightLayerRef = useRef(null);

  const errorLines = useMemo(() => extractCompileErrorLines(compileError), [compileError]);
  const compileErrorSummary = useMemo(() => getCompileErrorSummary(compileError), [compileError]);
  const highlightedLines = useMemo(() => {
    const lines = content ? content.split('\n') : [''];

    return lines.map((line, index) => ({
      lineNumber: index + 1,
      highlightedHtml: highlightLatexLine(line),
      hasError: errorLines.has(index + 1),
    }));
  }, [content, errorLines]);

  const lineCount = highlightedLines.length;

  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }

    if (highlightLayerRef.current && textareaRef.current) {
      highlightLayerRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightLayerRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  return (
    <div className="input-section">
      <label htmlFor="content">Generated LaTeX Code:</label>
      {compileErrorSummary ? (
        <div className="editor-status error">{compileErrorSummary}</div>
      ) : isModified ? (
        <div className="editor-status modified">Manual edits ready to recompile</div>
      ) : null}
      <div className={`editor-wrapper ${compileErrorSummary ? 'has-error' : ''}`}>
        <div className="line-numbers" ref={lineNumbersRef}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} className={`line-number ${errorLines.has(i + 1) ? 'error' : ''}`}>{i + 1}</div>
          ))}
        </div>
        <div className="editor-surface">
          <div className={`editor-highlight-layer ${isModified ? 'modified' : ''}`} ref={highlightLayerRef} aria-hidden="true">
            {highlightedLines.map(({ lineNumber, highlightedHtml, hasError }) => (
              <div
                key={lineNumber}
                className={`editor-highlight-line ${hasError ? 'error' : ''}`}
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            ))}
          </div>
          <textarea
            ref={textareaRef}
            id="content"
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            placeholder='Select classes and categories above, then click "Generate Cheat Sheet" to see the LaTeX code here.'
            className={`textarea-field ${isModified ? 'modified' : ''}`}
            rows={15}
            spellCheck="false"
            wrap="off"
          />
        </div>
      </div>
    </div>
  );
};

const PdfPreview = ({ pdfBlob, compileError }) => {
  const [numPages, setNumPages] = useState(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new window.ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="preview-section">
      <label>PDF Preview:</label>
      <div 
        className="preview-box pdf-viewer-box" 
        ref={containerRef}
      >
        {compileError ? (
          <div style={{ padding: '20px', color: '#ff4444', backgroundColor: '#331111', borderRadius: '4px', border: '1px solid #ff4444', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
            <strong>Compilation Error:</strong><br /><br />
            {compileError}
          </div>
        ) : pdfBlob ? (
          <Document 
            file={pdfBlob} 
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<div style={{ padding: '2rem', color: '#666', textAlign: 'center' }}>Loading PDF...</div>}
            error={<div style={{ padding: '2rem', color: '#ff4444', textAlign: 'center' }}>Failed to load PDF.</div>}
          >
            {Array.from(new Array(numPages), (_, index) => (
              <Page 
                key={`page_${index + 1}`} 
                pageNumber={index + 1} 
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="pdf-page"
                width={containerWidth ? containerWidth : undefined}
              />
            ))}
          </Document>
        ) : (
          <div className="latex-content" style={{ padding: '20px', color: '#666', textAlign: 'center' }}>
            Generate a sheet to see the PDF.
          </div>
        )}
      </div>
    </div>
  );
};

const ActionToolbar = ({ handleDownloadTex, handleDownloadPDF, isLoading, isSaving, content, handleClear }) => (
  <div className="actions">
    <button type="submit" className="btn primary" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Progress'}</button>
    <button type="button" onClick={handleDownloadTex} className="btn download">Download .tex</button>
    <button
      type="button"
      onClick={handleDownloadPDF}
      className="btn download"
      disabled={isLoading || !content}
    >
      {isLoading ? 'Compiling...' : 'Download PDF'}
    </button>
    <button type="button" onClick={handleClear} className="btn clear">Clear</button>
  </div>
);

const FONT_SIZE_PRESETS = ['8pt', '9pt', '10pt', '11pt', '12pt'];
const SPACING_PRESETS = ['tiny', 'small', 'medium', 'large'];

const LayoutOptions = ({ columns, setColumns, fontSize, setFontSize, spacing, setSpacing, margins, setMargins }) => {
  const fontSizeMode = FONT_SIZE_PRESETS.includes(fontSize) ? fontSize : 'custom';
  const spacingMode = SPACING_PRESETS.includes(spacing) ? spacing : 'custom';

  return (
  <div className="layout-options">
    <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
      Layout Options
    </label>
    <div className="layout-controls">
      <div className="layout-control">
        <label htmlFor="columns">Columns:</label>
        <select 
          id="columns" 
          value={columns} 
          onChange={(e) => setColumns(Number(e.target.value))}
          className="layout-select"
        >
          <option value={1}>1 Column</option>
          <option value={2}>2 Columns</option>
          <option value={3}>3 Columns</option>
          <option value={4}>4 Columns</option>
          <option value={5}>5 Columns</option>
        </select>
      </div>
      <div className="layout-control">
        <label htmlFor="fontSize">Text Size:</label>
        <select 
          id="fontSize" 
          value={fontSizeMode} 
          onChange={(e) => setFontSize(e.target.value === 'custom' ? '10.5pt' : e.target.value)}
          className="layout-select"
        >
          <option value="8pt">Compact (8pt)</option>
          <option value="9pt">Small (9pt)</option>
          <option value="10pt">Normal (10pt)</option>
          <option value="11pt">Medium (11pt)</option>
          <option value="12pt">Large (12pt)</option>
          <option value="custom">Custom</option>
        </select>
        {fontSizeMode === 'custom' && (
          <input
            type="text"
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="layout-select"
            placeholder="e.g. 10.5pt"
          />
        )}
      </div>
      <div className="layout-control">
        <label htmlFor="spacing">Spacing:</label>
        <select 
          id="spacing" 
          value={spacingMode} 
          onChange={(e) => setSpacing(e.target.value === 'custom' ? '0.8pt' : e.target.value)}
          className="layout-select"
        >
          <option value="tiny">Tiny</option>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
          <option value="custom">Custom</option>
        </select>
        {spacingMode === 'custom' && (
          <input
            type="text"
            value={spacing}
            onChange={(e) => setSpacing(e.target.value)}
            className="layout-select"
            placeholder="e.g. 0.8pt"
          />
        )}
      </div>
      <div className="layout-control">
        <label htmlFor="margins">Margins:</label>
        <select 
          id="margins" 
          value={margins} 
          onChange={(e) => setMargins(e.target.value)}
          className="layout-select"
        >
          <option value="0.15in">Narrow (0.15in)</option>
          <option value="0.25in">Normal (0.25in)</option>
          <option value="0.5in">Wide (0.5in)</option>
          <option value="0.75in">Extra Wide (0.75in)</option>
        </select>
      </div>
    </div>
  </div>
  );
};

const CreateCheatSheet = ({ onSave, onReset, initialData, isSaving = false }) => {
  const {
    classesData,
    selectedClasses,
    selectedCategories,
    groupedFormulas,
    toggleClass,
    toggleCategory,
    getSelectedFormulasList,
    clearSelections,
    reorderClass,
    reorderFormula,
    removeClassFromOrder,
    removeSingleFormula,
    selectedCount,
    hasSelectedClasses
  } = useFormulas(initialData);

  const {
    title,
    setTitle,
    content,
    contentModified,
    hasLayoutChanges,
    handleContentChange,
    columns,
    setColumns,
    fontSize,
    setFontSize,
    spacing,
    setSpacing,
    margins,
    setMargins,
    pdfBlob,
    isGenerating,
    isCompiling,
    isLoading,
    compileError,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    handleGenerateSheet,
    handleCompileOnly,
    handleDownloadPDF,
    handleDownloadTex,
    clearLatex
  } = useLatex(initialData);

  const handleCompileClick = () => {
    handleCompileOnly();
  };

  const handleGenerate = () => {
    const formulasList = getSelectedFormulasList();
    handleGenerateSheet(formulasList);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await onSave({
      title,
      content,
      columns,
      fontSize,
      spacing,
      margins,
      selectedFormulas: getSelectedFormulasList(),
    });
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear everything? This cannot be undone.')) {
      clearLatex();
      clearSelections();
      onReset?.();
    }
  };

  return (
    <form onSubmit={handleSave}>
      {/* Box 1: Selection controls */}
      <div className="create-cheat-sheet panel-box selection-panel">
        <div className="form-group">
          <label htmlFor="title">Title:</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Math Cheat Sheet"
            required
            className="input-field"
          />
        </div>

        <FormulaSelection
          classesData={classesData}
          selectedClasses={selectedClasses}
          selectedCategories={selectedCategories}
          groupedFormulas={groupedFormulas}
          toggleClass={toggleClass}
          toggleCategory={toggleCategory}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          selectedCount={selectedCount}
          hasSelectedClasses={hasSelectedClasses}
          onReorderClass={reorderClass}
          onReorderFormula={reorderFormula}
          onRemoveClass={removeClassFromOrder}
          onRemoveFormula={removeSingleFormula}
        />
      </div>

      {/* Box 2: Editor and preview */}
      <div className="create-cheat-sheet panel-box">
        <LayoutOptions 
          columns={columns}
          setColumns={setColumns}
          fontSize={fontSize}
          setFontSize={setFontSize}
          spacing={spacing}
          setSpacing={setSpacing}
          margins={margins}
          setMargins={setMargins}
        />
        
        <div className="editor-container">
          <LatexEditor
            content={content}
            onChange={handleContentChange}
            isModified={contentModified || hasLayoutChanges}
            compileError={compileError}
          />
          <div className="compile-button-column">
            <div className="history-buttons">
              <button
                type="button"
                onClick={goBack}
                disabled={!canGoBack}
                className="btn history-btn"
                title="Go back to previous version"
                aria-label="Go back"
              >
                ←
              </button>
              <button
                type="button"
                onClick={goForward}
                disabled={!canGoForward}
                className="btn history-btn"
                title="Go forward to next version"
                aria-label="Go forward"
              >
                →
              </button>
            </div>
            <button
              type="button"
              onClick={handleCompileClick}
              className="btn compile-circle"
              disabled={isCompiling}
              title={isCompiling ? 'Compiling...' : 'Compile & Preview'}
              aria-label={isCompiling ? 'Compiling preview' : 'Compile and preview'}
            >
              {isCompiling ? '...' : '↻'}
            </button>
          </div>
          <PdfPreview pdfBlob={pdfBlob} compileError={compileError} />
        </div>

        <ActionToolbar
          handleDownloadTex={handleDownloadTex}
          handleDownloadPDF={handleDownloadPDF}
          isLoading={isLoading}
          isSaving={isSaving}
          content={content}
          handleClear={handleClear}
        />
      </div>
    </form>
  );
};

export default CreateCheatSheet;
