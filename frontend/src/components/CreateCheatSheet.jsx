import React, { useState, useEffect, useRef } from 'react';
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

const LatexEditor = ({ content, setContent, handlePreview, isCompiling }) => (
  <>
    <div className="input-section">
      <label htmlFor="content">Generated LaTeX Code:</label>
      <textarea
        id="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder='Select classes and categories above, then click "Generate Cheat Sheet" to see the LaTeX code here.'
        className="textarea-field"
        rows={15}
        spellCheck="false"
      />
    </div>

    <button
      type="button"
      onClick={() => handlePreview()}
      className="btn compile-circle"
      disabled={isCompiling || !content}
      title={isCompiling ? 'Compiling...' : 'Compile & Preview'}
      aria-label={isCompiling ? 'Compiling preview' : 'Compile and preview'}
    >
      {isCompiling ? '...' : '↻'}
    </button>
  </>
);

const PdfPreview = ({ pdfBlob, compileError }) => {
  const [numPages, setNumPages] = useState(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    fetch('/api/compile/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: ' ' })
    }).catch(e => console.log('Pre-warm compilation failed, ignoring:', e));
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
            {Array.from(new Array(numPages), (el, index) => (
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

const ActionToolbar = ({ handleDownloadTex, handleDownloadPDF, isLoading, content, handleClear }) => (
  <div className="actions">
    <button type="submit" className="btn primary">Save Progress</button>
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

const CreateCheatSheet = ({ onSave, initialData }) => {
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
  } = useFormulas();

  const {
    title,
    setTitle,
    content,
    setContent,
    pdfBlob,
    isGenerating,
    isCompiling,
    isLoading,
    compileError,
    handleGenerateSheet,
    handlePreview,
    handleDownloadPDF,
    handleDownloadTex,
    clearLatex
  } = useLatex(initialData);

  const handleGenerate = () => {
    const formulasList = getSelectedFormulasList();
    handleGenerateSheet(formulasList);
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSave({ title, content });
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear everything? This cannot be undone.')) {
      clearLatex();
      clearSelections();
      onSave({ title: '', content: '' }, false);
    }
  };

  return (
    <div className="create-cheat-sheet">
      <form onSubmit={handleSave}>
        
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

        <div className="editor-container">
          <LatexEditor
            content={content}
            setContent={setContent}
            handlePreview={handlePreview}
            isCompiling={isCompiling}
          />
          <PdfPreview pdfBlob={pdfBlob} compileError={compileError} />
        </div>

        <ActionToolbar
          handleDownloadTex={handleDownloadTex}
          handleDownloadPDF={handleDownloadPDF}
          isLoading={isLoading}
          content={content}
          handleClear={handleClear}
        />
        
      </form>
    </div>
  );
};

export default CreateCheatSheet;