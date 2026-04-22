import { useState, useRef, useEffect, useCallback, useContext } from 'react';
import AuthContext from '../context/AuthContext';

const STORAGE_KEY = 'cheatSheetLatex';
const SAVE_DEBOUNCE_MS = 500;

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

function formatCompileError(errorData = {}) {
  return (errorData.details || errorData.error || 'Failed to compile LaTeX')
    .replace(/See the LaTeX manual or LaTeX Companion for explanation\.?/ig, '')
    .replace(/Type\s+H <return>\s+for immediate help\.?/ig, '')
    .replace(/error:\s*halted on potentially-recoverable error as specified\.?/ig, '')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

export function useLatex(initialData) {
  const { authTokens } = useContext(AuthContext);
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [contentModified, setContentModified] = useState(false);
  const [columns, setColumns] = useState(initialData?.columns ?? 2);
  const [fontSize, setFontSize] = useState(initialData?.fontSize ?? '10pt');
  const [spacing, setSpacing] = useState(initialData?.spacing ?? 'large');
  const [margins, setMargins] = useState(initialData?.margins ?? '0.25in');
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
  const pdfBlobUrlRef = useRef(null);
  const lastCompiledLayoutRef = useRef({
    columns: initialData?.columns ?? 2,
    fontSize: initialData?.fontSize ?? '10pt',
    spacing: initialData?.spacing ?? 'large',
    margins: initialData?.margins ?? '0.25in',
  });

  // Revoke the object URL when the component unmounts to prevent memory leaks
  useEffect(() => {
    return () => {
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
      }
    };
  }, []);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setContent(history[newIndex]?.content || '');
      setCompileError(null);
      setContentModified(true);
    }
  }, [historyIndex, history]);

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setContent(history[newIndex]?.content || '');
      setCompileError(null);
      setContentModified(true);
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
    if (saved && initialData?.content == null) {
      initialLoaded.current = true;
      setTitle(saved.title ?? '');
      setContent(saved.content ?? '');
      setColumns(saved.columns ?? 2);
      setFontSize(saved.fontSize ?? '10pt');
      setSpacing(saved.spacing ?? 'large');
      setMargins(saved.margins ?? '0.25in');
    } else if (initialData) {
      initialLoaded.current = true;
      setTitle(initialData.title ?? '');
      setContent(initialData.content ?? '');
      setColumns(initialData.columns ?? 2);
      setFontSize(initialData.fontSize ?? '10pt');
      setSpacing(initialData.spacing ?? 'large');
      setMargins(initialData.margins ?? '0.25in');
    }
  }, [initialData]);

  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);
    setCompileError(null);
    setContentModified(true);
  }, []);

  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveLatexStorage({ title, content, columns, fontSize, spacing, margins });
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, content, columns, fontSize, spacing, margins]);

  const compileLatexContent = useCallback(async (latexContent, layoutOptions = {}) => {
    const response = await fetch('/api/compile/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authTokens ? { 'Authorization': `Bearer ${authTokens.access}` } : {})
      },
      body: JSON.stringify({ content: latexContent, ...layoutOptions }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(formatCompileError(errorData));
    }

    const blob = await response.blob();
    if (pdfBlobUrlRef.current) {
      URL.revokeObjectURL(pdfBlobUrlRef.current);
    }
    pdfBlobUrlRef.current = URL.createObjectURL(blob);
    setPdfBlob(pdfBlobUrlRef.current);
  }, [authTokens]);

  const hasLayoutChanges =
    lastCompiledLayoutRef.current.columns !== columns ||
    lastCompiledLayoutRef.current.fontSize !== fontSize ||
    lastCompiledLayoutRef.current.spacing !== spacing ||
    lastCompiledLayoutRef.current.margins !== margins;

  const handleCompileOnly = useCallback(async () => {
    if (isCompilingRef.current) return;
    
    isCompilingRef.current = true;
    setIsCompiling(true);
    setCompileError(null);

    try {
      await compileLatexContent(content, {
        columns,
        font_size: fontSize,
        spacing,
        margins,
      });
      lastCompiledLayoutRef.current = { columns, fontSize, spacing, margins };
      setContentModified(false);
    } catch (error) {
      setCompileError(error.message);
    } finally {
      setIsCompiling(false);
      isCompilingRef.current = false;
    }
  }, [columns, compileLatexContent, content, fontSize, margins, spacing]);

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
            margins: margins
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
    
    isCompilingRef.current = true;
    setIsCompiling(true);
    setCompileError(null);
    try {
      await compileLatexContent(contentToCompile, {
        columns,
        font_size: fontSize,
        spacing,
        margins,
      });
      lastCompiledLayoutRef.current = { columns, fontSize, spacing, margins };
      setContentModified(false);
    } catch (error) {
      setCompileError(error.message);
    } finally {
      setIsCompiling(false);
      isCompilingRef.current = false;
    }
  }, [columns, compileLatexContent, content, fontSize, margins, saveToHistory, spacing]);

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
          margins: margins
        }),
      });
      if (!response.ok) throw new Error('Failed to generate sheet');
        const data = await response.json();
        if (content) saveToHistory(data.tex_code);
        setContent(data.tex_code);
        setContentModified(false);
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
        headers: {
          'Content-Type': 'application/json',
          ...(authTokens ? { 'Authorization': `Bearer ${authTokens.access}` } : {})
        },
        body: JSON.stringify({
          content,
          columns,
          font_size: fontSize,
          spacing,
          margins,
        }),
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
    setContentModified(false);
    setColumns(2);
    setFontSize('10pt');
    setSpacing('large');
    setMargins('0.25in');
    setHistory([]);
    setHistoryIndex(-1);
    if (pdfBlobUrlRef.current) {
      URL.revokeObjectURL(pdfBlobUrlRef.current);
      pdfBlobUrlRef.current = null;
    }
    setPdfBlob(null);
    setCompileError(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    title,
    setTitle,
    content,
    setContent,
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
    handlePreview,
    handleCompileOnly,
    handleDownloadPDF,
    handleDownloadTex,
    clearLatex
  };
}
