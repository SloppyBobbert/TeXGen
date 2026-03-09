import React, { useState, useEffect } from 'react';

const CreateCheatSheet = ({ onSave, initialData }) => {
  const [title, setTitle] = useState(initialData ? initialData.title : '');
  const [content, setContent] = useState(initialData ? initialData.content : '');
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);

  // Formula selection state
  const [classesData, setClassesData] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState({}); // { "ClassName": true }
  const [selectedCategories, setSelectedCategories] = useState({}); // { "ClassName:CategoryName": true }
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch the full class/category/formula structure from backend
  useEffect(() => {
    fetch('/api/classes/')
      .then((res) => res.json())
      .then((data) => {
        setClassesData(data.classes || []);
      })
      .catch((err) => console.error('Failed to fetch classes', err));
  }, []);

  useEffect(() => {
    if (initialData) {
      if (initialData.title) setTitle(initialData.title);
      if (initialData.content) setContent(initialData.content);
    }
  }, [initialData]);

  // Toggle class selection
  const toggleClass = (className) => {
    setSelectedClasses((prev) => {
      const newSelected = { ...prev };
      if (newSelected[className]) {
        delete newSelected[className];
        // Clear categories for this class
        Object.keys(selectedCategories).forEach((key) => {
          if (key.startsWith(className + ':')) {
            delete newSelected[key];
          }
        });
      } else {
        newSelected[className] = true;
      }
      return newSelected;
    });
  };

  // Toggle category selection
  const toggleCategory = (className, categoryName) => {
    const key = `${className}:${categoryName}`;
    setSelectedCategories((prev) => {
      const newSelected = { ...prev };
      if (newSelected[key]) {
        delete newSelected[key];
      } else {
        newSelected[key] = true;
      }
      return newSelected;
    });
  };

  // Get selected formulas for API
  const getSelectedFormulasList = () => {
    const formulas = [];
    
    // For each selected class and category, get all formulas
    classesData.forEach((cls) => {
      if (!selectedClasses[cls.name]) return;
      
      cls.categories.forEach((cat) => {
        const key = `${cls.name}:${cat.name}`;
        if (selectedCategories[key]) {
          cat.formulas.forEach((f) => {
            formulas.push({
              class: cls.name,
              category: cat.name,
              name: f.name
            });
          });
        }
      });
    });
    
    return formulas;
  };

  // Generate LaTeX from selected formulas
  const handleGenerateSheet = async () => {
    const selectedList = getSelectedFormulasList();
    if (selectedList.length === 0) {
      alert('Please select at least one category first.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-sheet/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formulas: selectedList }),
      });
      if (!response.ok) throw new Error('Failed to generate sheet');
      const data = await response.json();
      setContent(data.tex_code);
      setPdfBlob(null);
    } catch (error) {
      console.error('Error generating sheet:', error);
      alert('Failed to generate LaTeX. Is the backend running?');
    } finally {
      setIsGenerating(false);
    }
  };

  // Send the current LaTeX code to Tectonic for PDF preview
  const handlePreview = async () => {
    setIsCompiling(true);
    try {
      const response = await fetch('/api/compile/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error('Failed to compile LaTeX');
      const blob = await response.blob();
      setPdfBlob(URL.createObjectURL(blob));
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please check the backend service.');
    } finally {
      setIsCompiling(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/compile/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error('Failed to compile LaTeX');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'cheat-sheet'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTex = () => {
    if (!content) {
      alert('No LaTeX code to download. Generate a sheet first.');
      return;
    }
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'cheat-sheet'}.tex`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSave({ title, content });
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear everything? This cannot be undone.')) {
      setTitle('');
      setContent('');
      setPdfBlob(null);
      setSelectedClasses({});
      setSelectedCategories({});
      onSave({ title: '', content: '' }, false);
    }
  };

  const selectedCount = getSelectedFormulasList().length;
  const hasSelectedClasses = Object.keys(selectedClasses).length > 0;

  return (
    <div className="create-cheat-sheet">
      <h2>Cheat Sheet Generator</h2>
      <form onSubmit={handleSave}>

        {/* Title */}
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

        {/* Class Selection with Dropdowns */}
        <div className="formula-selection">
          <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
            Step 1: Select your class(es)
          </label>
          
          {/* Class Checkboxes */}
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

          {/* Category Dropdowns for selected classes */}
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
                    <select
                      multiple
                      className="category-select"
                      value={Object.keys(selectedCategories).filter(k => k.startsWith(cls.name + ':')).map(k => k.replace(cls.name + ':', ''))}
                      onChange={(e) => {
                        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                        // Clear old categories for this class
                        setSelectedCategories((prev) => {
                          const newSelected = { ...prev };
                          Object.keys(newSelected).forEach((key) => {
                            if (key.startsWith(cls.name + ':')) {
                              delete newSelected[key];
                            }
                          });
                          // Add new selections
                          selectedOptions.forEach((catName) => {
                            newSelected[`${cls.name}:${catName}`] = true;
                          });
                          return newSelected;
                        });
                      }}
                    >
                      {cls.categories.map((cat) => (
                        <option key={cat.name} value={cat.name}>
                          {cat.name} ({cat.formulas.length} formulas)
                        </option>
                      ))}
                    </select>
                    <p className="category-hint">Hold Ctrl/Cmd to select multiple categories</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerateSheet}
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

        {/* Editor + Preview */}
        <div className="editor-container">
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

          <div className="preview-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>PDF Preview:</label>
              <button
                type="button"
                onClick={handlePreview}
                className="btn preview"
                disabled={isCompiling || !content}
              >
                {isCompiling ? 'Compiling...' : 'Compile & Preview'}
              </button>
            </div>
            <div className="preview-box">
              {pdfBlob ? (
                <iframe
                  src={pdfBlob}
                  width="100%"
                  height="400px"
                  title="PDF Preview"
                  style={{ border: 'none' }}
                />
              ) : (
                <div className="latex-content" style={{ padding: '20px', color: '#666' }}>
                  Generate a sheet, then click "Compile &amp; Preview" to see the PDF.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
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
      </form>
    </div>
  );
};

export default CreateCheatSheet;
