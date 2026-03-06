import React, { useState, useEffect } from 'react';

const CreateCheatSheet = ({ onSave, initialData }) => {
  const [title, setTitle] = useState(initialData ? initialData.title : '');
  const [content, setContent] = useState(initialData ? initialData.content : '');
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);

  // Class selection state
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch the list of available classes from the backend on mount
  useEffect(() => {
    fetch('/api/classes/')
      .then((res) => res.json())
      .then((data) => {
        setAvailableClasses(data.classes || []);
      })
      .catch((err) => console.error('Failed to fetch classes', err));
  }, []);

  useEffect(() => {
    if (initialData) {
      if (initialData.title) setTitle(initialData.title);
      if (initialData.content) setContent(initialData.content);
    }
  }, [initialData]);

  // Toggle a class in the selected list
  const toggleClass = (className) => {
    setSelectedClasses((prev) => {
      const alreadySelected = prev.indexOf(className) !== -1;
      if (alreadySelected) {
        return prev.filter((c) => c !== className);
      }
      return [...prev, className];
    });
  };

  // Ask the backend to build the LaTeX code for the selected classes
  const handleGenerateSheet = async () => {
    if (selectedClasses.length === 0) {
      alert('Please select at least one class first.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-sheet/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classes: selectedClasses }),
      });
      if (!response.ok) throw new Error('Failed to generate sheet');
      const data = await response.json();
      setContent(data.tex_code);
      // Clear any old preview since the code changed
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

  // Download the .tex source code directly
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
      setSelectedClasses([]);
      onSave({ title: '', content: '' }, false);
    }
  };

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

        {/* Step 1: Class Selection */}
        <div className="class-selection">
          <label style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
            Step 1: Select your class(es)
          </label>
          <div className="class-checkboxes">
            {availableClasses.map((cls) => {
              const isChecked = selectedClasses.indexOf(cls) !== -1;
              return (
                <label key={cls} className={`class-checkbox-label ${isChecked ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleClass(cls)}
                  />
                  {cls}
                </label>
              );
            })}
          </div>

          {/* Step 2: Generate button */}
          <button
            type="button"
            onClick={handleGenerateSheet}
            className="btn primary generate-btn"
            disabled={isGenerating || selectedClasses.length === 0}
          >
            {isGenerating ? 'Generating...' : 'Generate Cheat Sheet'}
          </button>

          {selectedClasses.length > 0 && (
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
              Selected: {selectedClasses.join(', ')}
            </p>
          )}
        </div>

        {/* Editor + Preview */}
        <div className="editor-container">
          {/* Left: LaTeX code output (editable so users can tweak) */}
          <div className="input-section">
            <label htmlFor="content">Generated LaTeX Code:</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder='Select your classes above and click "Generate Cheat Sheet" to see the LaTeX code here.'
              className="textarea-field"
              rows={15}
            />
          </div>

          {/* Right: PDF preview (only when user clicks button) */}
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
