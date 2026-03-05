import React, { useState, useEffect } from 'react';

const mathFormulas = {
  Algebra: {
    "Linear Eq.": [
      { name: "Slope-Intercept", latex: "y = mx + b" },
      { name: "Point-Slope", latex: "y - y_1 = m(x - x_1)" },
      { name: "Standard Form", latex: "Ax + By = C" }
    ],
    "Quadratic Eq.": [
      { name: "Quadratic Formula", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
      { name: "Vertex Form", latex: "y = a(x-h)^2 + k" },
      { name: "Standard Form", latex: "y = ax^2 + bx + c" }
    ],
    "Exponents": [
      { name: "Product Rule", latex: "x^a \\cdot x^b = x^{a+b}" },
      { name: "Quotient Rule", latex: "\\frac{x^a}{x^b} = x^{a-b}" },
      { name: "Power Rule", latex: "(x^a)^b = x^{ab}" },
      { name: "Negative Exponent", latex: "x^{-a} = \\frac{1}{x^a}" }
    ],
    "Logarithms": [
      { name: "Product Rule", latex: "\\log_b(xy) = \\log_b(x) + \\log_b(y)" },
      { name: "Quotient Rule", latex: "\\log_b(\\frac{x}{y}) = \\log_b(x) - \\log_b(y)" },
      { name: "Power Rule", latex: "\\log_b(x^k) = k \\log_b(x)" },
      { name: "Change of Base", latex: "\\log_b(x) = \\frac{\\log_c(x)}{\\log_c(b)}" }
    ]
  },
  Geometry: {
    "Area": [
      { name: "Circle", latex: "A = \\pi r^2" },
      { name: "Triangle", latex: "A = \\frac{1}{2}bh" },
      { name: "Rectangle", latex: "A = lw" }
    ]
  }
};

const CreateCheatSheet = ({ onSave, initialData }) => {
  const [title, setTitle] = useState(initialData ? initialData.title : '');
  const [content, setContent] = useState(initialData ? initialData.content : '');
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // States for formula selector
  const [activeSubject, setActiveSubject] = useState('Algebra');
  const [activeCategory, setActiveCategory] = useState('Quadratic Eq.');


  useEffect(() => {
    if (initialData) {
      if (initialData.title) setTitle(initialData.title);
      if (initialData.content) setContent(initialData.content);
    }
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ title, content });
  };

  const handlePreview = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/compile/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!response.ok) {
        throw new Error('Failed to compile LaTeX');
      }
      const blob = await response.blob();
      setPdfBlob(URL.createObjectURL(blob));
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please check the backend service.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/compile/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!response.ok) {
        throw new Error('Failed to compile LaTeX');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'cheat-sheet'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Check console for details.');
    }
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the editor? This cannot be undone.')) {
      setTitle('');
      setContent('');
      setPdfBlob(null);
      onSave({ title: '', content: '' }, false);
    }
  };

  const insertFormula = (formulaLatex) => {
    setContent(prevContent => prevContent + (prevContent.endsWith('\n') ? '' : '\n') + `\\[ ${formulaLatex} \\]\n`);
  };

  return (
    <div className="create-cheat-sheet">
      <h2>Cheat Sheet Editor</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title:</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="input-field"
          />
        </div>

        <div className="subjects-container">
          <div className="subject-tabs">
            {Object.keys(mathFormulas).map(subject => (
              <button
                key={subject}
                type="button"
                className={`subject-tab ${activeSubject === subject ? 'active' : ''}`}
                onClick={() => {
                  setActiveSubject(subject);
                  setActiveCategory(Object.keys(mathFormulas[subject])[0]);
                }}
              >
                {subject}
              </button>
            ))}
          </div>

          {activeSubject && mathFormulas[activeSubject] && (
            <div className="category-tabs">
              {Object.keys(mathFormulas[activeSubject]).map(category => (
                <button
                  key={category}
                  type="button"
                  className={`category-tab ${activeCategory === category ? 'active' : ''}`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          )}

          {activeSubject && activeCategory && mathFormulas[activeSubject][activeCategory] && (
            <div className="formulas-container">
              {mathFormulas[activeSubject][activeCategory].map(formula => (
                <button
                  key={formula.name}
                  type="button"
                  className="formula-btn"
                  onClick={() => insertFormula(formula.latex)}
                  title={formula.latex}
                >
                  {formula.name}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="editor-container">
          <div className="input-section">
            <label htmlFor="content">Content (LaTeX Supported via Tectonic):</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your LaTeX content here. Use \begin{document} ... \end{document} or simple text."
              className="textarea-field"
              rows={15}
            />
          </div>
          
          <div className="preview-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Preview:</label>
                <button type="button" onClick={handlePreview} className="btn preview" disabled={isLoading}>
                {isLoading ? 'Compiling...' : 'Preview PDF'}
                </button>
            </div>
            <div className="preview-box">
              {pdfBlob ? (
                  <iframe src={pdfBlob} width="100%" height="400px" title="PDF Preview" style={{ border: 'none' }} />
              ) : (
                  <div className="latex-content" style={{ padding: '20px', color: '#666' }}>
                    Click Preview PDF to render the LaTeX document via Tectonic.
                  </div>
              )}
            </div>
          </div>
        </div>

        <div className="actions">
          <button type="submit" className="btn primary">Save Progress</button>
          <button type="button" onClick={handleDownloadPDF} className="btn download">Download PDF</button>
          <button type="button" onClick={handleClear} className="btn clear">Clear</button>
        </div>
      </form>
    </div>
  );
};

export default CreateCheatSheet;