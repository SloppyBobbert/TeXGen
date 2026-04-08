import { useState, useRef, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'cheatSheetLatex';

function loadLatexStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load latex storage', e);
  }
  return null;
}

function saveLatexStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save latex storage', e);
  }
}

export function useLatex(initialData) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [columns, setColumns] = useState(initialData?.columns ?? 2);
  const [fontSize, setFontSize] = useState(initialData?.fontSize ?? '10pt');
  const [spacing, setSpacing] = useState(initialData?.spacing ?? 'large');
  const [pdfBlob, setPdfBlob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [compileError, setCompileError] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const isCompilingRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const initialLoaded = useRef(false);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setContent(history[newIndex]?.content || '');
    }
  }, [historyIndex, history]);

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setContent(history[newIndex]?.content || '');
    }
  }, [historyIndex, history]);

  const saveToHistory = useCallback((newContent) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ content: newContent, timestamp: Date.now() });
      if (newHistory.length > 7) {
        newHistory.shift();
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 6));
  }, [historyIndex]);

  useEffect(() => {
    if (initialLoaded.current) return;
    
    const saved = loadLatexStorage();
    if (saved && !initialData?.content) {
      initialLoaded.current = true;
      setTitle(saved.title ?? '');
      setContent(saved.content ?? '');
      setColumns(saved.columns ?? 2);
      setFontSize(saved.fontSize ?? '10pt');
      setSpacing(saved.spacing ?? 'large');
    } else if (initialData) {
      initialLoaded.current = true;
      setTitle(initialData.title ?? '');
      setContent(initialData.content ?? '');
      setColumns(initialData.columns ?? 2);
      setFontSize(initialData.fontSize ?? '10pt');
      setSpacing(initialData.spacing ?? 'large');
    }
  }, [initialData]);

  useEffect(() => {
    saveLatexStorage({ title, content, columns, fontSize, spacing });
  }, [title, content, columns, fontSize, spacing]);

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
            spacing: regenerateOptions.spacing,
            margins: '0.25in'
          }),
        });
        if (response.ok) {
          const data = await response.json();
          contentToCompile = data.tex_code;
          setContent(data.tex_code);
          if (content) saveToHistory(data.tex_code);
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
          spacing: spacing,
          margins: '0.25in'
        }),
      });
      if (!response.ok) throw new Error('Failed to generate sheet');
        const data = await response.json();
        if (content) saveToHistory(data.tex_code);
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
    setSpacing('large');
    setPdfBlob(null);
    setCompileError(null);
    localStorage.removeItem(STORAGE_KEY);
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
    spacing,
    setSpacing,
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
    handlePreview,
    handleDownloadPDF,
    handleDownloadTex,
    clearLatex
  };
}
