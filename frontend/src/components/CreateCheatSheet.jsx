import React from 'react';
import { useFormulas } from '../hooks/formulas';
import { useLatex } from '../hooks/latex';

//  Subcomponents 

const FormulaSelection = ({ 
  classesData, 
  selectedClasses, 
  selectedCategories, 
  toggleClass, 
  toggleCategory, 
  onGenerate, 
  isGenerating, 
  selectedCount, 
  hasSelectedClasses 
}) => (
  <div className="formula-selection">
    <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
      Step 1: Select your class(es)
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
          Step 2: Select category(ies)
        </label>
        
        {classesData.map((cls) => {
          if (!selectedClasses[cls.name]) return null;
          
          return (
            <div key={cls.name} className="class-category-section">
              <label className="class-category-label">{cls.name}:</label>
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

//  Main Component

const CreateCheatSheet = ({ onSave, initialData }) => {
  const {
    classesData,
    selectedClasses,
    selectedCategories,
    toggleClass,
    toggleCategory,
    getSelectedFormulasList,
    clearSelections,
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
        
        {/* Title Input */}
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
