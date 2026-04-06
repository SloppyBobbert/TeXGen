import React from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFormulas } from '../hooks/formulas';
import { useLatex } from '../hooks/latex';

function SortableFormulaItem({ id, formula, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    position: 'relative',
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="sortable-formula-item">
      <span className="drag-handle">⋮⋮</span>
      <span className="formula-name">{formula.name}</span>
      <span className="formula-class">{formula.class}</span>
      <button type="button" className="remove-formula" onClick={() => onRemove(id)}>×</button>
    </div>
  );
}

function FormulaReorderPanel({ formulaOrder, onReorder, onRemove }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(active.id, over.id);
    }
  };

  const formulasByClass = formulaOrder.reduce((acc, formula) => {
    if (!acc[formula.class]) acc[formula.class] = [];
    acc[formula.class].push(formula);
    return acc;
  }, {});

  const getIndicesForClass = (className) => {
    return formulaOrder
      .map((f, i) => f.class === className ? i : -1)
      .filter(i => i !== -1);
  };

  const moveClassUp = (className) => {
    const indices = getIndicesForClass(className);
    if (indices.length === 0 || indices[0] === 0) return;
    const firstIdx = indices[0];
    onReorder(firstIdx, firstIdx - 1);
  };

  const moveClassDown = (className) => {
    const indices = getIndicesForClass(className);
    if (indices.length === 0 || indices[indices.length - 1] === formulaOrder.length - 1) return;
    const lastIdx = indices[indices.length - 1];
    onReorder(lastIdx, lastIdx + 1);
  };

  const removeClass = (className) => {
    const indices = getIndicesForClass(className);
    [...indices].reverse().forEach(idx => onRemove(idx));
  };

  const groupByClass = () => {
    const groups = [];
    let currentClass = null;
    let startIndex = 0;
    
    formulaOrder.forEach((formula, index) => {
      if (formula.class !== currentClass) {
        if (currentClass !== null) {
          groups.push({
            className: currentClass,
            startIndex,
            endIndex: index - 1,
            count: index - startIndex
          });
        }
        currentClass = formula.class;
        startIndex = index;
      }
    });
    
    if (currentClass !== null) {
      groups.push({
        className: currentClass,
        startIndex,
        endIndex: formulaOrder.length - 1,
        count: formulaOrder.length - startIndex
      });
    }
    
    return groups;
  };

  const classGroups = groupByClass();

  if (formulaOrder.length === 0) return null;

  return (
    <div className="formula-reorder-panel">
      <label style={{ fontWeight: 'bold', marginTop: '1rem', marginBottom: '0.5rem', display: 'block' }}>
        Drag to reorder formulas (top appears first in PDF)
      </label>
      <div className="reorder-instructions">
        <span>Drag individual formulas or drag class headers to move all</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={formulaOrder.map((_, i) => i)} strategy={verticalListSortingStrategy}>
          {classGroups.map((group) => (
            <div key={group.className} className="formula-class-group">
              <div className="class-group-header">
                <span className="class-group-title">{group.className} ({group.count})</span>
                <div className="class-group-actions">
                  <button type="button" className="class-group-btn" onClick={() => moveClassUp(group.className)} title="Move up">↑</button>
                  <button type="button" className="class-group-btn" onClick={() => moveClassDown(group.className)} title="Move down">↓</button>
                  <button type="button" className="class-group-btn remove" onClick={() => removeClass(group.className)} title="Remove all">×</button>
                </div>
              </div>
              {formulaOrder.slice(group.startIndex, group.endIndex + 1).map((formula, idx) => (
                <SortableFormulaItem 
                  key={group.startIndex + idx} 
                  id={group.startIndex + idx} 
                  formula={formula} 
                  onRemove={onRemove}
                />
              ))}
            </div>
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
  toggleClass, 
  toggleCategory, 
  onGenerate, 
  isGenerating, 
  selectedCount, 
  hasSelectedClasses,
  formulaOrder,
  onReorderFormula,
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
          <label key={cls.name} className={`class-checkbox-label ${isChecked ? 'checked' : ''}`}>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleClass(cls.name)}
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
                    <label key={cat.name} className={`category-checkbox-label ${isChecked ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCategory(cls.name, cat.name)}
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
      formulaOrder={formulaOrder} 
      onReorder={onReorderFormula}
      onRemove={onRemoveFormula}
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

const PdfPreview = ({ pdfBlob }) => (
  <div className="preview-section">
    <label>PDF Preview:</label>
    <div className="preview-box">
      {pdfBlob ? (
        <iframe
          src={pdfBlob}
          width="100%"
          height="100%"
          title="PDF Preview"
          style={{ border: 'none' }}
        />
      ) : (
        <div className="latex-content" style={{ padding: '20px', color: '#666' }}>
          Generate a sheet to see the PDF.
        </div>
      )}
    </div>
  </div>
);

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
    formulaOrder,
    setFormulaOrder,
    toggleClass,
    toggleCategory,
    getSelectedFormulasList,
    clearSelections,
    reorderFormula,
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
    handleGenerateSheet,
    handlePreview,
    handleDownloadPDF,
    handleDownloadTex,
    clearLatex
  } = useLatex(initialData);

  const handleRemoveFormula = (index) => {
    const newOrder = formulaOrder.filter((_, i) => i !== index);
    setFormulaOrder(newOrder);
  };

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
          toggleClass={toggleClass}
          toggleCategory={toggleCategory}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          selectedCount={selectedCount}
          hasSelectedClasses={hasSelectedClasses}
          formulaOrder={formulaOrder}
          onReorderFormula={reorderFormula}
          onRemoveFormula={handleRemoveFormula}
        />

        <div className="editor-container">
          <LatexEditor
            content={content}
            setContent={setContent}
            handlePreview={handlePreview}
            isCompiling={isCompiling}
          />
          <PdfPreview pdfBlob={pdfBlob} />
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