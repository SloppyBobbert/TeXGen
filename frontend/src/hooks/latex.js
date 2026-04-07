import { useState, useRef, useEffect, useCallback } from 'react';

export function useLatex(initialData) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [columns, setColumns] = useState(initialData?.columns ?? 2);
  const [fontSize, setFontSize] = useState(initialData?.fontSize ?? '10pt');
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [compileError, setCompileError] = useState(null);
  
  const isCompilingRef = useRef(false);
  const isGeneratingRef = useRef(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title ?? '');
      setContent(initialData.content ?? '');
      setColumns(initialData.columns ?? 2);
      setFontSize(initialData.fontSize ?? '10pt');
    }
  }, [initialData]);

  const handlePreview = useCallback(async (latexContent = null, regenerateOptions = null) => {
    if (isCompilingRef.current) return;
    
    let contentToCompile = latexContent || content;
    
    if (regenerateOptions) {
      try {
        const response = await fetch('/api/generate-sheet/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formulas: regenerateOptions.formulas,
            columns: regenerateOptions.columns,
            font_size: regenerateOptions.fontSize,
            margins: '0.25in'
          }),
        });
        if (response.ok) {
          const data = await response.json();
          contentToCompile = data.tex_code;
          setContent(data.tex_code);
        }
      } catch (e) {
        console.error('Failed to regenerate:', e);
      }
    }
    
    if (!contentToCompile) return;
    
    isCompilingRef.current = true;
    setIsCompiling(true);
    setCompileError(null);
    try {
      const response = await fetch('/api/compile/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentToCompile }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMsg = errorData.details || errorData.error || 'Failed to compile LaTeX';
        
        errorMsg = errorMsg
          .replace(/See the LaTeX manual or LaTeX Companion for explanation\.?/ig, '')
          .replace(/Type\s+H <return>\s+for immediate help\.?/ig, '')
          .replace(/error:\s*halted on potentially-recoverable error as specified\.?/ig, '')
          .replace(/\n\s*\n/g, '\n')
          .trim();

        throw new Error(errorMsg);
      }
      const blob = await response.blob();
      setPdfBlob(URL.createObjectURL(blob));
    } catch (error) {
      console.error('Error generating PDF:', error);
      setCompileError(error.message);
    } finally {
      setIsCompiling(false);
      isCompilingRef.current = false;
    }
  }, [content]);

  const handleGenerateSheet = async (selectedList) => {
    if (isGeneratingRef.current) return;
    if (selectedList.length === 0) {
      alert('Please select at least one category first.');
      return;
    }

    isGeneratingRef.current = true;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-sheet/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          formulas: selectedList,
          columns: columns,
          font_size: fontSize,
          margins: '0.25in'
        }),
      });
      if (!response.ok) throw new Error('Failed to generate sheet');
        const data = await response.json();
        setContent(data.tex_code);
        setPdfBlob(null);
        handlePreview(data.tex_code, null);
    } catch (error) {
      console.error('Error generating sheet:', error);
      alert('Failed to generate LaTeX. Is the backend running?');
    } finally {
      setIsGenerating(false);
      isGeneratingRef.current = false;
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

  const clearLatex = () => {
    setTitle('');
    setContent('');
    setColumns(2);
    setFontSize('10pt');
    setPdfBlob(null);
    setCompileError(null);
  };

  return {
    title,
    setTitle,
    content,
    setContent,
    columns,
    setColumns,
    fontSize,
    setFontSize,
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
  };
}
