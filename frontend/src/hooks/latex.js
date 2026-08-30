import { useState, useRef, useEffect, useCallback, useContext } from 'react';
import AuthContext from '../context/AuthContext';

const STORAGE_KEY = 'cheatSheetLatex';
const SAVE_DEBOUNCE_MS = 500;
const AUTO_COMPILE_DEBOUNCE_MS = 450;
const MAX_HISTORY_ENTRIES = 7;
const AUTHENTICATION_ERROR = 'Sign in to compile or download PDFs.';
const SELECTION_RESOLUTION_ERROR = 'Unable to resolve selected formulas for generation.';
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

function storageKeyFor(initialData, draftIdentity) {
  const identity = draftIdentity ?? initialData?.id ?? initialData?.draftId;
  return identity == null ? STORAGE_KEY : `${STORAGE_KEY}:${identity}`;
}

function loadLatexStorage(storageKey) {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load latex storage', e);
  }
  return null;
}

function saveLatexStorage(storageKey, data) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
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

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeLegacyFormula(formula) {
  if (!formula || typeof formula !== 'object') return null;

  const classKey = isNonEmptyString(formula.class)
    ? 'class'
    : isNonEmptyString(formula.class_name)
      ? 'class_name'
      : null;
  if (!classKey || !isNonEmptyString(formula.name)) return null;
  if (Object.hasOwn(formula, 'category') && typeof formula.category !== 'string') return null;

  return {
    [classKey]: formula[classKey],
    ...(Object.hasOwn(formula, 'category') ? { category: formula.category } : {}),
    name: formula.name,
  };
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

export function useLatex(initialData, draftIdentity, currentSelectedFormulas = []) {
  const storageKey = storageKeyFor(initialData, draftIdentity);
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
  const [authenticationRequired, setAuthenticationRequired] = useState(false);
  const [lastCompileSnapshot, setLastCompileSnapshot] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const isCompilingRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const initialLoaded = useRef(false);
  const pdfBlobUrlRef = useRef(null);
  const autoCompileTimerRef = useRef(null);
  const operationEpochRef = useRef(0);
  const controllersRef = useRef(new Set());
  const contentRevisionRef = useRef(0);
  const currentSelectedFormulasRef = useRef(currentSelectedFormulas);
  currentSelectedFormulasRef.current = currentSelectedFormulas;
  const lastCompiledLayoutRef = useRef({
    columns: initialData?.columns ?? DEFAULT_LAYOUT.columns,
    fontSize: initialData?.fontSize ?? DEFAULT_LAYOUT.fontSize,
    spacing: initialData?.spacing ?? DEFAULT_LAYOUT.spacing,
    margins: initialData?.margins ?? DEFAULT_LAYOUT.margins,
    orientation: initialData?.orientation ?? DEFAULT_LAYOUT.orientation,
  });

  // Revoke the object URL when the component unmounts to prevent memory leaks
  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      operationEpochRef.current += 1;
      controllers.forEach((controller) => controller.abort());
      clearTimeout(autoCompileTimerRef.current);
      clearTimeout(saveTimerRef.current);
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

  const beginOperation = useCallback(() => {
    operationEpochRef.current += 1;
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    isCompilingRef.current = false;
    isGeneratingRef.current = false;
    setIsCompiling(false);
    setIsGenerating(false);
    setIsLoading(false);
    return operationEpochRef.current;
  }, []);

  const requireAuthentication = useCallback(() => {
    setAuthenticationRequired(true);
    setCompileError(AUTHENTICATION_ERROR);
  }, []);

  const clearAuthenticationRequired = useCallback(() => {
    setAuthenticationRequired(false);
  }, []);

  const updateLayout = useCallback((setter, value) => {
    clearAutoCompileTimer();
    beginOperation();
    setter(value);
  }, [beginOperation, clearAutoCompileTimer]);

  const handleSetColumns = useCallback((value) => updateLayout(setColumns, value), [updateLayout]);
  const handleSetFontSize = useCallback((value) => updateLayout(setFontSize, value), [updateLayout]);
  const handleSetSpacing = useCallback((value) => updateLayout(setSpacing, value), [updateLayout]);
  const handleSetMargins = useCallback((value) => updateLayout(setMargins, value), [updateLayout]);
  const handleSetOrientation = useCallback((value) => updateLayout(setOrientation, value), [updateLayout]);

  const request = useCallback(async (url, options, epoch) => {
    const controller = new globalThis.AbortController();
    controllersRef.current.add(controller);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return epoch === operationEpochRef.current ? response : null;
    } finally {
      controllersRef.current.delete(controller);
    }
  }, []);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      clearAutoCompileTimer();
      beginOperation();
      contentRevisionRef.current += 1;
      setHistoryIndex(newIndex);
      setContent(history[newIndex]?.content || '');
      setContentSource('manual');
      setCompileError(null);
      clearAuthenticationRequired();
      setContentModified(true);
    }
  }, [beginOperation, clearAuthenticationRequired, clearAutoCompileTimer, historyIndex, history]);

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      clearAutoCompileTimer();
      beginOperation();
      contentRevisionRef.current += 1;
      setHistoryIndex(newIndex);
      setContent(history[newIndex]?.content || '');
      setContentSource('manual');
      setCompileError(null);
      clearAuthenticationRequired();
      setContentModified(true);
    }
  }, [beginOperation, clearAuthenticationRequired, clearAutoCompileTimer, historyIndex, history]);

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

    const saved = storageKey !== STORAGE_KEY || initialData === undefined ? loadLatexStorage(storageKey) : null;
    if (saved) {
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
  }, [initialData, storageKey]);

  const handleContentChange = useCallback((newContent) => {
    clearAutoCompileTimer();
    beginOperation();
    contentRevisionRef.current += 1;
    setContent(newContent);
    setContentSource(newContent.trim() ? 'manual' : 'empty');
    setCompileError(null);
    clearAuthenticationRequired();
    setContentModified(true);
  }, [beginOperation, clearAuthenticationRequired, clearAutoCompileTimer]);

  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveLatexStorage(storageKey, { title, content, contentSource, columns, fontSize, spacing, margins, orientation });
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, content, contentSource, columns, fontSize, spacing, margins, orientation, storageKey]);

  const compileLatexContent = useCallback(async (latexContent, layoutOptions = {}, epoch) => {
    if (!authTokens?.access) throw new Error(AUTHENTICATION_ERROR);
    const response = await request('/api/compile/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authTokens ? { 'Authorization': `Bearer ${authTokens.access}` } : {})
      },
      body: JSON.stringify({ content: latexContent, ...layoutOptions }),
    }, epoch);
    if (!response) return null;

    if (!response.ok) {
      if (response.status === 401) throw new Error(AUTHENTICATION_ERROR);
      const errorData = await readErrorResponse(response);
      throw new Error(formatCompileError(errorData));
    }

    const blob = await response.blob();
    if (epoch !== operationEpochRef.current) return null;
    if (pdfBlobUrlRef.current) {
      URL.revokeObjectURL(pdfBlobUrlRef.current);
    }
    pdfBlobUrlRef.current = URL.createObjectURL(blob);
    setPdfBlob(pdfBlobUrlRef.current);
    return { pdfBlob: pdfBlobUrlRef.current };
  }, [authTokens, request]);

  const publishCompileSnapshot = useCallback((compiled, snapshot) => {
    if (!compiled) return;
    setLastCompileSnapshot({
      ...snapshot,
      compiledAt: Date.now(),
      pdfBlob: compiled.pdfBlob,
    });
  }, []);

  const generateLatexContent = useCallback(async (selectedList, epoch) => {
    const hasCanonicalSelections = selectedList.every((formula) => (
      isNonEmptyString(formula?.formula_id) || isNonEmptyString(formula?.id)
    ));
    const legacyFormulas = hasCanonicalSelections
      ? null
      : selectedList.map(normalizeLegacyFormula);
    const formulaPayload = hasCanonicalSelections
      ? {
        formula_selections: selectedList.map((formula) => ({
          formula_id: isNonEmptyString(formula.formula_id) ? formula.formula_id : formula.id,
        })),
      }
      : legacyFormulas.every(Boolean)
        ? { formulas: legacyFormulas }
        : null;
    if (!formulaPayload) throw new Error(SELECTION_RESOLUTION_ERROR);
    const response = await request('/api/generate-sheet/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formulaPayload,
        columns,
        font_size: fontSize,
        spacing,
        margins,
        orientation,
      }),
    }, epoch);
    if (!response) return null;

    if (!response.ok) {
      const errorData = await readErrorResponse(response);
      throw new Error(formatCompileError(errorData));
    }

    const data = await response.json();
    if (epoch !== operationEpochRef.current) return null;
    return data.tex_code;
  }, [columns, fontSize, spacing, margins, orientation, request]);

  const normalizeLatexContent = useCallback(async (latexContent, epoch) => {
    if (!authTokens?.access) throw new Error(AUTHENTICATION_ERROR);
    const response = await request('/api/compile/', {
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
    }, epoch);
    if (!response) return null;

    if (!response.ok) {
      if (response.status === 401) throw new Error(AUTHENTICATION_ERROR);
      const errorData = await readErrorResponse(response);
      throw new Error(formatCompileError(errorData));
    }

    const data = await response.json();
    if (epoch !== operationEpochRef.current) return null;
    return data.tex_code || latexContent;
  }, [authTokens, columns, fontSize, margins, spacing, orientation, request]);

  const hasLayoutChanges =
    lastCompiledLayoutRef.current.columns !== columns ||
    lastCompiledLayoutRef.current.fontSize !== fontSize ||
    lastCompiledLayoutRef.current.spacing !== spacing ||
    lastCompiledLayoutRef.current.margins !== margins ||
    lastCompiledLayoutRef.current.orientation !== orientation;
    
  const canRegenerateFromSelections = !content.trim() || contentSource === 'generated';

  const handleCompileOnly = useCallback(async (selectedList) => {
    clearAutoCompileTimer();
    const epoch = beginOperation();
    const revision = contentRevisionRef.current;
    const hasContent = content.trim().length > 0;
    const operationSelectedFormulas = selectedList === undefined
      ? currentSelectedFormulasRef.current
      : selectedList;
    const operationSnapshot = {
      title,
      columns,
      fontSize,
      spacing,
      margins,
      orientation,
      selectedFormulas: operationSelectedFormulas,
      contentSource: hasContent ? contentSource : 'generated',
    };

    if (!hasContent && operationSelectedFormulas.length === 0) {
      alert('Select formulas first or generate a sheet before compiling.');
      return;
    }
    if (!authTokens?.access) {
      requireAuthentication();
      return;
    }
    
    isCompilingRef.current = true;
    setIsCompiling(true);
    setCompileError(null);

    try {
      let contentToCompile = content;

      if (!hasContent) {
        const generatedContent = await generateLatexContent(operationSelectedFormulas, epoch);
        if (!generatedContent || epoch !== operationEpochRef.current) return;
        if (content) saveToHistory(generatedContent);
        contentToCompile = generatedContent;
        setContent(generatedContent);
        setContentSource('generated');
      }

      if (hasContent && hasLayoutChanges) {
        contentToCompile = await normalizeLatexContent(contentToCompile, epoch);
        if (!contentToCompile || epoch !== operationEpochRef.current) return;
      }

      const compiled = await compileLatexContent(contentToCompile, {
        columns,
        font_size: fontSize,
        spacing,
        margins,
        orientation,
      }, epoch);
      if (!compiled || epoch !== operationEpochRef.current) return;
      lastCompiledLayoutRef.current = { columns, fontSize, spacing, margins, orientation };
      publishCompileSnapshot(compiled, { ...operationSnapshot, content: contentToCompile });
      clearAuthenticationRequired();
      if (revision === contentRevisionRef.current) setContentModified(false);
    } catch (error) {
      if (epoch === operationEpochRef.current && error.name !== 'AbortError') {
        if (error.message === AUTHENTICATION_ERROR) requireAuthentication();
        else setCompileError(error.message);
      }
    } finally {
      if (epoch === operationEpochRef.current) {
        setIsCompiling(false);
        isCompilingRef.current = false;
      }
    }
  }, [authTokens, beginOperation, clearAuthenticationRequired, clearAutoCompileTimer, columns, compileLatexContent, content, contentSource, fontSize, generateLatexContent, hasLayoutChanges, margins, normalizeLatexContent, publishCompileSnapshot, requireAuthentication, saveToHistory, spacing, orientation, title]);

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
    const epoch = beginOperation();
    if (!authTokens?.access) {
      requireAuthentication();
      return;
    }
    const revision = contentRevisionRef.current;
    const operationSnapshot = {
      title,
      columns,
      fontSize,
      spacing,
      margins,
      orientation,
      selectedFormulas: regenerateOptions?.formulas || currentSelectedFormulasRef.current,
      contentSource: regenerateOptions ? 'generated' : contentSource,
    };
    
    let contentToCompile = latexContent || content;
    
    if (regenerateOptions) {
      try {
        const data = await generateLatexContent(regenerateOptions.formulas, epoch);
        if (data && epoch === operationEpochRef.current) {
          contentToCompile = data;
          setContent(data);
          setContentSource('generated');
          if (content) saveToHistory(data);
        }
      } catch (e) {
        if (epoch === operationEpochRef.current && e.name !== 'AbortError') setCompileError(e.message);
        return;
      }
      if (epoch !== operationEpochRef.current) return;
    }
    
    isCompilingRef.current = true;
    setIsCompiling(true);
    setCompileError(null);
    try {
      if ((latexContent || content) && hasLayoutChanges) {
        contentToCompile = await normalizeLatexContent(contentToCompile, epoch);
        if (!contentToCompile || epoch !== operationEpochRef.current) return;
      }

      const compiled = await compileLatexContent(contentToCompile, {
        columns,
        font_size: fontSize,
        spacing,
        margins,
        orientation,
      }, epoch);
      if (!compiled || epoch !== operationEpochRef.current) return;
      lastCompiledLayoutRef.current = { columns, fontSize, spacing, margins, orientation };
      publishCompileSnapshot(compiled, { ...operationSnapshot, content: contentToCompile });
      clearAuthenticationRequired();
      if (revision === contentRevisionRef.current) setContentModified(false);
    } catch (error) {
      if (epoch === operationEpochRef.current && error.name !== 'AbortError') {
        if (error.message === AUTHENTICATION_ERROR) requireAuthentication();
        else setCompileError(error.message);
      }
    } finally {
      if (epoch === operationEpochRef.current) {
        setIsCompiling(false);
        isCompilingRef.current = false;
      }
    }
  }, [authTokens, beginOperation, clearAuthenticationRequired, clearAutoCompileTimer, columns, compileLatexContent, content, contentSource, fontSize, generateLatexContent, hasLayoutChanges, margins, normalizeLatexContent, publishCompileSnapshot, requireAuthentication, saveToHistory, spacing, orientation, title]);

  const handleGenerateSheet = async (selectedList) => {
    clearAutoCompileTimer();
    if (selectedList.length === 0) {
      alert('Please select at least one category first.');
      return;
    }

    const epoch = beginOperation();
    const operationSnapshot = {
      title,
      columns,
      fontSize,
      spacing,
      margins,
      orientation,
      selectedFormulas: selectedList,
      contentSource: 'generated',
    };
    let generated = false;
    isGeneratingRef.current = true;
    setIsGenerating(true);
    try {
      const generatedContent = await generateLatexContent(selectedList, epoch);
      if (!generatedContent || epoch !== operationEpochRef.current) return;
      if (content) saveToHistory(generatedContent);
      setContent(generatedContent);
      setContentSource('generated');
      setContentModified(false);
      generated = true;
      isGeneratingRef.current = false;
      setIsGenerating(false);
      isCompilingRef.current = true;
      setIsCompiling(true);
      setCompileError(null);
      if (!authTokens?.access) {
        requireAuthentication();
        return;
      }
      const compiled = await compileLatexContent(generatedContent, {
        columns, font_size: fontSize, spacing, margins, orientation,
      }, epoch);
      if (compiled && epoch === operationEpochRef.current) {
        lastCompiledLayoutRef.current = { columns, fontSize, spacing, margins, orientation };
        publishCompileSnapshot(compiled, { ...operationSnapshot, content: generatedContent });
        clearAuthenticationRequired();
      }
    } catch (error) {
      if (epoch === operationEpochRef.current && error.name !== 'AbortError') {
        if (generated && error.message === AUTHENTICATION_ERROR) requireAuthentication();
        else if (generated) setCompileError(error.message);
        else {
          console.error('Error generating sheet:', error);
          alert('Failed to generate LaTeX. Is the backend running?');
        }
      }
    } finally {
      if (epoch === operationEpochRef.current) {
        setIsGenerating(false);
        setIsCompiling(false);
        isGeneratingRef.current = false;
        isCompilingRef.current = false;
      }
    }
  };

  const handleDownloadPDF = async () => {
    clearAutoCompileTimer();
    const epoch = beginOperation();
    if (!authTokens?.access) {
      requireAuthentication();
      return;
    }
    setIsLoading(true);
    try {
      const normalizedContent = hasLayoutChanges
        ? await normalizeLatexContent(content, epoch)
        : content;
      if (!normalizedContent || epoch !== operationEpochRef.current) return;

      const response = await request('/api/compile/', {
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
      }, epoch);
      if (!response || epoch !== operationEpochRef.current) return;
      if (!response.ok) {
        if (response.status === 401) throw new Error(AUTHENTICATION_ERROR);
        const errorData = await readErrorResponse(response);
        throw new Error(formatCompileError(errorData));
      }
      const blob = await response.blob();
      if (epoch !== operationEpochRef.current) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'cheat-sheet'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      clearAuthenticationRequired();
    } catch (error) {
      if (epoch === operationEpochRef.current && error.name !== 'AbortError') {
        if (error.message === AUTHENTICATION_ERROR) requireAuthentication();
        else {
          console.error('Error generating PDF:', error);
          alert('Failed to generate PDF. Check console for details.');
        }
      }
    } finally {
      if (epoch === operationEpochRef.current) setIsLoading(false);
    }
  };

  const handleDownloadTex = async () => {
    if (!content) {
      alert('No LaTeX code to download. Generate a sheet first.');
      return;
    }

    const epoch = beginOperation();
    try {
      if (hasLayoutChanges && !authTokens?.access) {
        requireAuthentication();
        return;
      }
      const normalizedContent = hasLayoutChanges
        ? await normalizeLatexContent(content, epoch)
        : content;
      if (!normalizedContent || epoch !== operationEpochRef.current) return;

      const blob = new Blob([normalizedContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'cheat-sheet'}.tex`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      clearAuthenticationRequired();
    } catch (error) {
      if (epoch === operationEpochRef.current && error.name !== 'AbortError') {
        if (error.message === AUTHENTICATION_ERROR) requireAuthentication();
        else {
          console.error('Error generating TeX:', error);
          alert('Failed to prepare TeX download. Check console for details.');
        }
      }
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
    beginOperation();
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
    setLastCompileSnapshot(null);
    setCompileError(null);
    clearAuthenticationRequired();
    localStorage.removeItem(storageKey);
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
    setColumns: handleSetColumns,
    fontSize,
    setFontSize: handleSetFontSize,
    spacing,
    setSpacing: handleSetSpacing,
    margins,
    setMargins: handleSetMargins,
    orientation,
    setOrientation: handleSetOrientation,
    pdfBlob,
    isGenerating,
    isCompiling,
    isLoading,
    compileError,
    authenticationRequired,
    clearAuthenticationRequired,
    lastCompileSnapshot,
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
