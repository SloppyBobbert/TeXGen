import React, { useState, useEffect, useRef } from 'react';
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const CreateCheatSheet = ({ onSave, onCancel, initialData }) => {
  const [title, setTitle] = useState(initialData ? initialData.title : '');
  const [content, setContent] = useState(initialData ? initialData.content : '');
  const previewRef = useRef(null);

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

  const handleDownloadPDF = async () => {
    if (!previewRef.current) return;

    try {
      // Create canvas from the preview element
      // Temporarily remove styles that might mess up the PDF
      const originalStyle = previewRef.current.style.cssText;
      // Force clean background and no border for capture
      previewRef.current.style.border = 'none';
      previewRef.current.style.boxShadow = 'none';
      previewRef.current.style.background = '#ffffff';

      const canvas = await html2canvas(previewRef.current, {
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        logging: false,
        x: 0,
        y: 0,
        width: previewRef.current.offsetWidth, 
        height: previewRef.current.offsetHeight
      });

      // Restore original styles
      previewRef.current.style.cssText = originalStyle;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // Add image to PDF - if height is greater than page, it will cut off. 
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${title || 'cheat-sheet'}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Check console for details.');
    }
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the editor? This cannot be undone.')) {
      setTitle('');
      setContent('');
      onSave({ title: '', content: '' }, false); // Auto-save the cleared state, without popup
    }
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
        
        <div className="editor-container">
          <div className="input-section">
            <label htmlFor="content">Content (Markdown + LaTeX supported):</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your content here. Use **bold**, # Header, and $E=mc^2$ for math."
              className="textarea-field"
            />
          </div>
          
          <div className="preview-section">
            <label>Preview:</label>
            <div className="preview-box" ref={previewRef}>
              <div className="latex-content">
                <ReactMarkdown 
                  remarkPlugins={[remarkMath]} 
                  rehypePlugins={[rehypeKatex]}
                >
                  {content}
                </ReactMarkdown>
              </div>
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