import { useState, useRef, useEffect, useCallback, useContext } from 'react';
import AuthContext from '../context/AuthContext';

const STORAGE_KEY = 'cheatSheetLatex';
const SAVE_DEBOUNCE_MS = 500;
const AUTO_COMPILE_DEBOUNCE_MS = 450;
const MAX_HISTORY_ENTRIES = 7;
const DEFAULT_LAYOUT = {
  columns: 4,
  fontSize: '9pt',
  spacing: 'small',
  margins: '0.15in',
  orientation: 'portrait',
};

function getInitialContentSource(data) {
  if (['generated', 'manual', 'empty'].includes(data?.contentSource)) {
    return data.contentSource;
  }

  if (!data?.content?.trim()) return 'empty';
  return 'manual';
}

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
  const rawMessage = typeof errorData === 'string'
    ? errorData
    : (errorData.details || errorData.error || 'Failed to compile LaTeX');

  return rawMessage
    .replace(/See the LaTeX manual or LaTeX Companion for explanation\.?/ig, '')
    .replace(/Type\s+H <return>\s+for immediate help\.?/ig, '')
    .replace(/error:\s*halted on potentially-recoverable error as specified\.?/ig, '')
    .replace(/\n\s*\n/g, '\n')
    .trim() || 'Failed to compile LaTeX';
}

async function readErrorResponse(response) {
  if (typeof response.text !== 'function') {
    const fallbackJson = typeof response.json === 'function'
      ? await response.json().catch(() => ({}))
      : {};
    return fallbackJson;
  }

  const rawText = await response.text().catch(() => '');
  if (!rawText) {
    return { error: 'Failed to compile LaTeX' };
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return { details: rawText };
  }
}

export function useLatex(initialData) {
  const { authTokens } = useContext(AuthContext);
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [contentModified, setContentModified] = useState(false);
  const [contentSource, setContentSource] = useState(() => getInitialContentSource(initialData));
  const [columns, setColumns] = useState(initialData?.columns ?? DEFAULT_LAYOUT.columns);
  const [fontSize, setFontSize] = useState(initialData?.fontSize ?? DEFAULT_LAYOUT.fontSize);
  const [spacing, setSpacing] = useState(initialData?.spacing ?? DEFAULT_LAYOUT.spacing);
  const [margins, setMargins] = useState(initialData?.margins ?? DEFAULT_LAYOUT.margins);
  const [orientation, setOrientation] = useState(initialData?.orientation ?? DEFAULT_LAYOUT.orientation);
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
  const autoCompileTimerRef = useRef(null);
  const hasRestoredPreviewRef = useRef(false);
  const lastCompiledLayoutRef = useRef({
    columns: initialData?.columns ?? DEFAULT_LAYOUT.columns,
    fontSize: initialData?.fontSize ?? DEFAULT_LAYOUT.fontSize,
    spacing: initialData?.spacing ?? DEFAULT_LAYOUT.spacing,
    margins: initialData?.margins ?? DEFAULT_LAYOUT.margins,
    orientation: initialData?.orientation ?? DEFAULT_LAYOUT.orientation,
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

  const clearAutoCompileTimer = useCallback(() => {
    if (autoCompileTimerRef.current) {
      clearTimeout(autoCompileTimerRef.current);
      autoCompileTimerRef.current = null;
    }
  }, []);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setContent(history[newIndex]?.content || '');
      setContentSource('manual');
      setCompileError(null);
      setContentModified(true);
    }
  }, [historyIndex, history]);

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setContent(history[newIndex]?.content || '');
      setContentSource('manual');
      setCompileError(null);
      setContentModified(true);
    }
  }, [historyIndex, history]);

  const saveToHistory = useCallback((newContent) => {
    setHistory((previousHistory) => {
      const baseHistory = previousHistory.slice(0, historyIndex + 1);
      const nextHistory = [
        ...baseHistory,
        { content: newContent, timestamp: Date.now() },
      ].slice(-MAX_HISTORY_ENTRIES);

      setHistoryIndex(nextHistory.length - 1);
      return nextHistory;
    });
  }, [historyIndex]);

  useEffect(() => {
    if (initialLoaded.current) return;

    const saved = loadLatexStorage();
    if (saved && initialData?.content == null) {
      initialLoaded.current = true;
      setTitle(saved.title ?? '');
      setContent(saved.content ?? '');
      setContentSource(getInitialContentSource(saved));
      setColumns(saved.columns ?? DEFAULT_LAYOUT.columns);
      setFontSize(saved.fontSize ?? DEFAULT_LAYOUT.fontSize);
      setSpacing(saved.spacing ?? DEFAULT_LAYOUT.spacing);
      setMargins(saved.margins ?? DEFAULT_LAYOUT.margins);
      setOrientation(saved.orientation ?? DEFAULT_LAYOUT.orientation);
      lastCompiledLayoutRef.current = {
        columns: saved.columns ?? DEFAULT_LAYOUT.columns,
        fontSize: saved.fontSize ?? DEFAULT_LAYOUT.fontSize,
        spacing: saved.spacing ?? DEFAULT_LAYOUT.spacing,
        margins: saved.margins ?? DEFAULT_LAYOUT.margins,
        orientation: saved.orientation ?? DEFAULT_LAYOUT.orientation,
      };
    } else if (initialData) {
      initialLoaded.current = true;
      setTitle(initialData.title ?? '');
      setContent(initialData.content ?? '');
      setContentSource(getInitialContentSource(initialData));
      setColumns(initialData.columns ?? DEFAULT_LAYOUT.columns);
      setFontSize(initialData.fontSize ?? DEFAULT_LAYOUT.fontSize);
      setSpacing(initialData.spacing ?? DEFAULT_LAYOUT.spacing);
      setMargins(initialData.margins ?? DEFAULT_LAYOUT.margins);
      setOrientation(initialData.orientation ?? DEFAULT_LAYOUT.orientation);
      lastCompiledLayoutRef.current = {
        columns: initialData.columns ?? DEFAULT_LAYOUT.columns,
        fontSize: initialData.fontSize ?? DEFAULT_LAYOUT.fontSize,
        spacing: initialData.spacing ?? DEFAULT_LAYOUT.spacing,
        margins: initialData.margins ?? DEFAULT_LAYOUT.margins,
        orientation: initialData.orientation ?? DEFAULT_LAYOUT.orientation,
      };
    }
  }, [initialData]);

  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);
    setContentSource(newContent.trim() ? 'manual' : 'empty');
    setCompileError(null);
    setContentModified(true);
  }, []);

  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveLatexStorage({ title, content, contentSource, columns, fontSize, spacing, margins, orientation });
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, content, contentSource, columns, fontSize, spacing, margins, orientation]);

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
      const errorData = await readErrorResponse(response);
      throw new Error(formatCompileError(errorData));
    }

    const blob = await response.blob();
    if (pdfBlobUrlRef.current) {
      URL.revokeObjectURL(pdfBlobUrlRef.current);
    }
    pdfBlobUrlRef.current = URL.createObjectURL(blob);
    setPdfBlob(pdfBlobUrlRef.current);
  }, [authTokens]);

  const generateLatexContent = useCallback(async (selectedList) => {
    const response = await fetch('/api/generate-sheet/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formulas: selectedList,
        columns,
        font_size: fontSize,
        spacing,
        margins,
        orientation,
      }),
    });

    if (!response.ok) {
      const errorData = await readErrorResponse(response);
      throw new Error(formatCompileError(errorData));
    }

    const data = await response.json();
    return data.tex_code;
  }, [columns, fontSize, spacing, margins, orientation]);

  const normalizeLatexContent = useCallback(async (latexContent) => {
    const response = await fetch('/api/compile/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authTokens ? { 'Authorization': `Bearer ${authTokens.access}` } : {}),
      },
      body: JSON.stringify({
        content: latexContent,
        columns,
        font_size: fontSize,
        spacing,
        margins,
        orientation,
        normalize_only: true,
      }),
    });

    if (!response.ok) {
      const errorData = await readErrorResponse(response);
      throw new Error(formatCompileError(errorData));
    }

    const data = await response.json();
    return data.tex_code || latexContent;
  }, [authTokens, columns, fontSize, margins, spacing, orientation]);

  const hasLayoutChanges =
    lastCompiledLayoutRef.current.columns !== columns ||
    lastCompiledLayoutRef.current.fontSize !== fontSize ||
    lastCompiledLayoutRef.current.spacing !== spacing ||
    lastCompiledLayoutRef.current.margins !== margins ||
    lastCompiledLayoutRef.current.orientation !== orientation;
    
  const canRegenerateFromSelections = !content.trim() || contentSource === 'generated';

  const handleCompileOnly = useCallback(async (selectedList = []) => {
    clearAutoCompileTimer();
    if (isCompilingRef.current) return;

    const hasContent = content.trim().length > 0;
    if (!hasContent && selectedList.length === 0) {
      alert('Select formulas first or generate a sheet before compiling.');
      return;
    }
    
    isCompilingRef.current = true;
    setIsCompiling(true);
    setCompileError(null);

    try {
      let contentToCompile = content;

      if (!hasContent) {
        const generatedContent = await generateLatexContent(selectedList);
        if (content) saveToHistory(generatedContent);
        contentToCompile = generatedContent;
        setContent(generatedContent);
        setContentSource('generated');
      }

      if (hasContent && hasLayoutChanges) {
        contentToCompile = await normalizeLatexContent(contentToCompile);
        setContent(contentToCompile);
      }

      await compileLatexContent(contentToCompile, {
        columns,
        font_size: fontSize,
        spacing,
        margins,
        orientation,
      });
      lastCompiledLayoutRef.current = { columns, fontSize, spacing, margins, orientation };
      setContentModified(false);
    } catch (error) {
      setCompileError(error.message);
    } finally {
      setIsCompiling(false);
      isCompilingRef.current = false;
    }
  }, [clearAutoCompileTimer, columns, compileLatexContent, content, fontSize, generateLatexContent, hasLayoutChanges, margins, normalizeLatexContent, saveToHistory, spacing, orientation]);

  useEffect(() => {
    if (!initialLoaded.current) return;
    if (!content?.trim()) return;
    if (!hasLayoutChanges) return;
    if (isCompilingRef.current || isGeneratingRef.current) return;

    clearAutoCompileTimer();

    autoCompileTimerRef.current = setTimeout(() => {
      handleCompileOnly();
    }, AUTO_COMPILE_DEBOUNCE_MS);

    return () => {
      clearAutoCompileTimer();
    };
  }, [clearAutoCompileTimer, content, hasLayoutChanges, handleCompileOnly]);

  const handlePreview = useCallback(async (latexContent = null, regenerateOptions = null) => {
    clearAutoCompileTimer();
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
            margins: margins,
            orientation: orientation
          }),
        });
        if (response.ok) {
          const data = await response.json();
          contentToCompile = data.tex_code;
          setContent(data.tex_code);
          setContentSource('generated');
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
      if ((latexContent || content) && hasLayoutChanges) {
        contentToCompile = await normalizeLatexContent(contentToCompile);
        setContent(contentToCompile);
      }

      await compileLatexContent(contentToCompile, {
        columns,
        font_size: fontSize,
        spacing,
        margins,
        orientation,
      });
      lastCompiledLayoutRef.current = { columns, fontSize, spacing, margins, orientation };
      setContentModified(false);
    } catch (error) {
      setCompileError(error.message);
    } finally {
      setIsCompiling(false);
      isCompilingRef.current = false;
    }
  }, [clearAutoCompileTimer, columns, compileLatexContent, content, fontSize, hasLayoutChanges, margins, normalizeLatexContent, saveToHistory, spacing, orientation]);

  useEffect(() => {
    if (!initialLoaded.current || hasRestoredPreviewRef.current) return;
    if (!initialData?.compileHistory?.length) return;
    if (!content?.trim()) return;

    hasRestoredPreviewRef.current = true;
    handlePreview(content);
  }, [content, handlePreview, initialData?.compileHistory?.length]);

  const handleGenerateSheet = async (selectedList) => {
    clearAutoCompileTimer();
    if (isGeneratingRef.current) return;
    if (selectedList.length === 0) {
      alert('Please select at least one category first.');
      return;
    }

    isGeneratingRef.current = true;
    setIsGenerating(true);
    try {
      const generatedContent = await generateLatexContent(selectedList);
      if (content) saveToHistory(generatedContent);
      setContent(generatedContent);
      setContentSource('generated');
      setContentModified(false);
      setPdfBlob(null);
      handlePreview(generatedContent, null);
    } catch (error) {
      console.error('Error generating sheet:', error);
      alert('Failed to generate LaTeX. Is the backend running?');
    } finally {
      setIsGenerating(false);
      isGeneratingRef.current = false;
    }
  };

  const handleDownloadPDF = async () => {
    clearAutoCompileTimer();
    setIsLoading(true);
    try {
      const normalizedContent = hasLayoutChanges
        ? await normalizeLatexContent(content)
        : content;

      if (hasLayoutChanges) {
        setContent(normalizedContent);
      }

      const response = await fetch('/api/compile/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authTokens ? { 'Authorization': `Bearer ${authTokens.access}` } : {})
        },
        body: JSON.stringify({
          content: normalizedContent,
          columns,
          font_size: fontSize,
          spacing,
          margins,
          orientation,
        }),
      });
      if (!response.ok) {
        const errorData = await readErrorResponse(response);
        throw new Error(formatCompileError(errorData));
      }
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

  const handleDownloadTex = async () => {
    if (!content) {
      alert('No LaTeX code to download. Generate a sheet first.');
      return;
    }

    try {
      const normalizedContent = hasLayoutChanges
        ? await normalizeLatexContent(content)
        : content;

      if (hasLayoutChanges) {
        setContent(normalizedContent);
      }
      const blob = new Blob([normalizedContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'cheat-sheet'}.tex`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating TeX:', error);
      alert('Failed to prepare TeX download. Check console for details.');
    }
  };

  const handlePrintPDF = () => {
    if (!pdfBlob) {
      alert('Compile the PDF before printing.');
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = pdfBlob;

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => {
        iframe.remove();
      }, 1000);
    };

    document.body.appendChild(iframe);
  };

  const clearLatex = () => {
    clearAutoCompileTimer();
    setTitle(initialData?.title ?? '');
    setContent('');
    setContentSource('empty');
    setContentModified(false);
    setColumns(initialData?.columns ?? DEFAULT_LAYOUT.columns);
    setFontSize(initialData?.fontSize ?? DEFAULT_LAYOUT.fontSize);
    setSpacing(initialData?.spacing ?? DEFAULT_LAYOUT.spacing);
    setMargins(initialData?.margins ?? DEFAULT_LAYOUT.margins);
    setOrientation(initialData?.orientation ?? DEFAULT_LAYOUT.orientation);
    setHistory([]);
    setHistoryIndex(-1);
    lastCompiledLayoutRef.current = {
      columns: initialData?.columns ?? DEFAULT_LAYOUT.columns,
      fontSize: initialData?.fontSize ?? DEFAULT_LAYOUT.fontSize,
      spacing: initialData?.spacing ?? DEFAULT_LAYOUT.spacing,
      margins: initialData?.margins ?? DEFAULT_LAYOUT.margins,
      orientation: initialData?.orientation ?? DEFAULT_LAYOUT.orientation,
    };
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
    contentSource,
    canRegenerateFromSelections,
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
    orientation,
    setOrientation,
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
    handlePrintPDF,
    clearLatex
  };
}