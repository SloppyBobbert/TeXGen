import { useState, useEffect, useContext, useRef } from 'react'
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, LayoutDashboard, LogIn, LogOut, Palette } from 'lucide-react';
import AuthContext from './context/AuthContext';
import Login from './components/Login';
import SignUp from './components/SignUp';
import Dashboard from './components/Dashboard';
import './App.css'
import CreateCheatSheet from './components/CreateCheatSheet';
import { migrateLegacyDraft, readDraft, removeDraft, writeDraft } from './storage/draftStore';
import { fromServerDocument, toCanonicalDocument } from './storage/documentAdapter';

const CURRENT_SHEET_STORAGE_KEY = 'currentCheatSheet';
const UNTITLED_COUNTER_STORAGE_KEY = 'untitledSheetCounter';
const COMPILE_HISTORY_STORAGE_PREFIX = 'cheatSheetCompileHistory';
const CONTENT_SOURCE_STORAGE_PREFIX = 'cheatSheetContentSource';
const createDraftId = () => `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const withDraftIdentity = (sheet) => sheet?.id || sheet?.draftId ? sheet : { ...sheet, draftId: createDraftId() };
const stripTransientPdfBlobs = (value) => {
  if (Array.isArray(value)) return value.map(stripTransientPdfBlobs);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'pdfBlob')
    .map(([key, item]) => [key, stripTransientPdfBlobs(item)]));
};
const sanitizeSheet = (sheet) => stripTransientPdfBlobs(sheet) || {};
const storageFailure = (error) => ({ ok: false, error });
const safeStorageRemove = (key) => {
  try {
    localStorage.removeItem(key);
    return { ok: true };
  } catch (error) {
    return storageFailure(error);
  }
};
const getDraftIdentity = (sheet) => sheet?.draftId ?? sheet?.id;
const toDraftEnvelope = (sheet) => {
  const document = toCanonicalDocument(sheet);
  return {
    schema_version: 1,
    draft_identity: getDraftIdentity(sheet),
    base_revision: Number.isSafeInteger(sheet.revision) && sheet.revision > 0 ? sheet.revision : null,
    source_mode: document.source_mode,
    source_latex: document.source_latex,
    formula_selections: document.formula_selections,
    layout: document.layout,
    title: document.title,
    history: stripTransientPdfBlobs(sheet.compileHistory ?? []),
    template_id: document.template_id,
  };
};
const persistSheet = (sheet) => {
  try {
    const sanitized = sanitizeSheet(sheet);
    localStorage.setItem(CURRENT_SHEET_STORAGE_KEY, JSON.stringify(sanitized));
    const identity = getDraftIdentity(sanitized);
    if (identity === undefined || identity === null) return { ok: true, skipped: true };
    if (Array.isArray(sanitized.selectedFormulas)
      && sanitized.selectedFormulas.length > 0
      && !sanitized.selectedFormulas.some((formula) => typeof (formula?.formula_id ?? formula?.id) === 'string')) return { ok: true, skipped: true };
    const existing = readDraft(localStorage, identity);
    if (!existing.ok) return existing;
    return writeDraft(localStorage, toDraftEnvelope(sanitized), {
      legacy: {
        formulas: sanitized.selectedFormulas,
        latex: { title: sanitized.title, content: sanitized.content, contentSource: sanitized.contentSource, columns: sanitized.columns, fontSize: sanitized.fontSize, spacing: sanitized.spacing, margins: sanitized.margins, orientation: sanitized.orientation },
        history: sanitized.compileHistory,
        source: sanitized.contentSource,
        currentSheet: sanitized,
      },
    });
  } catch (error) {
    return storageFailure(error);
  }
};
const fromDraftEnvelope = (draft, fallback = {}) => sanitizeSheet({
  ...fallback,
  title: draft.title,
  content: draft.source_latex,
  contentSource: draft.source_mode === 'raw' ? 'manual' : draft.source_mode,
  columns: draft.layout.columns,
  fontSize: draft.layout.font_size,
  spacing: draft.layout.spacing,
  margins: draft.layout.margins,
  orientation: draft.layout.orientation,
  formulaSelections: draft.formula_selections,
  selectedFormulas: draft.formula_selections,
  templateId: draft.template_id,
  revision: draft.base_revision,
  schemaVersion: draft.schema_version,
  compileHistory: draft.history,
});

const getNextUntitledTitle = () => {
  let currentValue = 0;
  try {
    currentValue = Number(localStorage.getItem(UNTITLED_COUNTER_STORAGE_KEY) || '0');
  } catch (error) {
    console.error('Failed to read untitled sheet counter', error);
  }
  const nextValue = Number.isFinite(currentValue) ? currentValue + 1 : 1;
  try {
    localStorage.setItem(UNTITLED_COUNTER_STORAGE_KEY, String(nextValue));
  } catch (error) {
    console.error('Failed to save untitled sheet counter', error);
  }
  return `Untitled Sheet (${nextValue})`;
};

const createDefaultSheet = () => ({
  title: getNextUntitledTitle(),
  content: '',
  contentSource: 'empty',
  columns: 4,
  fontSize: '9pt',
  spacing: 'small',
  margins: '0.15in',
  orientation: 'portrait',
  selectedFormulas: [],
  compileHistory: [],
});

const inferContentSource = ({ content = '' } = {}) => {
  if (!content?.trim()) return 'empty';
  return 'manual';
};

const sameFormulas = (left, right) => (
  Array.isArray(left)
  && Array.isArray(right)
  && left.length === right.length
  && left.every((formula, index) => (
    (typeof (formula?.formula_id ?? formula?.id) === 'string'
      || typeof (right[index]?.formula_id ?? right[index]?.id) === 'string')
      ? (formula?.formula_id ?? formula?.id) === (right[index]?.formula_id ?? right[index]?.id)
      : (formula?.class === right[index]?.class
        && formula?.category === right[index]?.category
        && formula?.name === right[index]?.name)
  ))
);

const sameSnapshot = (left, right) => {
  if (!left || !right) return false;

  return (
    left.title === right.title
    && left.content === right.content
    && left.contentSource === right.contentSource
    && left.columns === right.columns
    && left.fontSize === right.fontSize
    && left.spacing === right.spacing
    && left.margins === right.margins
    && left.orientation === right.orientation
    && sameFormulas(left.selectedFormulas, right.selectedFormulas)
  );
};

const buildRestoredSheet = (baseSheet, snapshot) => sanitizeSheet({
  ...baseSheet,
  title: snapshot.title ?? baseSheet.title,
  content: snapshot.content ?? '',
  contentSource: snapshot.contentSource ?? baseSheet.contentSource ?? 'generated',
  columns: snapshot.columns ?? baseSheet.columns,
  fontSize: snapshot.fontSize ?? baseSheet.fontSize,
  spacing: snapshot.spacing ?? baseSheet.spacing,
  margins: snapshot.margins ?? baseSheet.margins,
  orientation: snapshot.orientation ?? baseSheet.orientation,
  selectedFormulas: snapshot.selectedFormulas ?? [],
  compileHistory: Array.isArray(baseSheet.compileHistory) ? stripTransientPdfBlobs(baseSheet.compileHistory) : [],
});

const loadStoredSheet = () => {
  try {
    const saved = localStorage.getItem(CURRENT_SHEET_STORAGE_KEY);
    if (!saved) return null;
    return withDraftIdentity(sanitizeSheet(JSON.parse(saved)));
  } catch (e) {
    console.error('Failed to parse sheet', e);
    return null;
  }
};

const getCompileHistoryStorageKey = (sheetId) => `${COMPILE_HISTORY_STORAGE_PREFIX}:${sheetId}`;
const getContentSourceStorageKey = (sheetId) => `${CONTENT_SOURCE_STORAGE_PREFIX}:${sheetId}`;

const getStoredCompileHistory = (sheetId) => {
  if (!sheetId) return [];

  let savedHistory;
  try {
    savedHistory = localStorage.getItem(getCompileHistoryStorageKey(sheetId));
  } catch (error) {
    console.error('Failed to read compile history', error);
    return [];
  }
  if (savedHistory) {
    try {
      const parsedHistory = JSON.parse(savedHistory);
      if (Array.isArray(parsedHistory)) return stripTransientPdfBlobs(parsedHistory);
    } catch (e) {
      console.error('Failed to parse compile history', e);
    }
  }

  const storedSheet = loadStoredSheet();
  if (storedSheet?.id !== sheetId) {
    return [];
  }

  return Array.isArray(storedSheet.compileHistory) ? stripTransientPdfBlobs(storedSheet.compileHistory) : [];
};

const saveStoredCompileHistory = (sheetId, compileHistory = []) => {
  if (!sheetId) return { ok: true, skipped: true };
  try {
    localStorage.setItem(getCompileHistoryStorageKey(sheetId), JSON.stringify(stripTransientPdfBlobs(compileHistory)));
    return { ok: true };
  } catch (error) {
    return storageFailure(error);
  }
};

const getStoredContentSource = (sheetId) => {
  if (!sheetId) return null;
  let savedSource;
  try {
    savedSource = localStorage.getItem(getContentSourceStorageKey(sheetId));
  } catch (error) {
    console.error('Failed to read content source', error);
    return null;
  }
  return ['generated', 'manual', 'empty'].includes(savedSource) ? savedSource : null;
};

const saveStoredContentSource = (sheetId, contentSource) => {
  if (!sheetId || !['generated', 'manual', 'empty'].includes(contentSource)) return { ok: true, skipped: true };
  try {
    localStorage.setItem(getContentSourceStorageKey(sheetId), contentSource);
    return { ok: true };
  } catch (error) {
    return storageFailure(error);
  }
};
const persistSaveBoundary = (sheet, history, contentSource) => {
  const results = [
    persistSheet(sheet),
    saveStoredCompileHistory(sheet.id, history),
    saveStoredContentSource(sheet.id, contentSource),
  ];
  return results.find((result) => !result.ok) ?? { ok: true };
};

const isTestEnv = Boolean(
  import.meta.env?.VITEST
  ||
  (typeof globalThis !== 'undefined' && globalThis.process?.env?.VITEST === 'true')
  || (typeof globalThis !== 'undefined' && globalThis.process?.env?.NODE_ENV === 'test')
  || import.meta.env?.MODE === 'test'
);
const MotionLink = isTestEnv ? Link : motion(Link);
const MotionButton = isTestEnv ? 'button' : motion.button;
const subtleMotion = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.985 },
};
const motionInteractionProps = isTestEnv ? {} : subtleMotion;

const PrivateRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  return user ? children : <Navigate to="/login" replace />;
};

const THEMES = [
  { id: 'light',  label: '☀️ Light 💡'      },
  { id: 'dark',    label: '🌑 Dark ☾'       },
  { id: 'miami',  label: '🌴 Miami 🐬'      },
  { id: 'forest',    label: '🌲 Forest'     },
  { id: 'coolGrey',    label: '❄️ Cool Grey'}, 
  { id: 'neon',         label:     '🩵 neon'},
  { id: 'galaxy',     label: '🌌 Galaxy'    },
  {id: 'crimson', label: '❤️ Red'           },
  {id: 'blossom',        label: '🌸 Blossom'},
];

function App() {
  const normalizeTheme = (value) => {
    return THEMES.find(t => t.id === value ) ? value : 'light';
  };

  const [cheatSheet, setCheatSheet] = useState(() => {
    try {
      const saved = localStorage.getItem(CURRENT_SHEET_STORAGE_KEY);
      if (saved) {
        const sheet = withDraftIdentity(sanitizeSheet(JSON.parse(saved)));
        const identity = getDraftIdentity(sheet);
        const storedDraft = identity === undefined ? null : readDraft(localStorage, identity);
        if (storedDraft?.ok && storedDraft.draft) return fromDraftEnvelope(storedDraft.draft, sheet);
        if (storedDraft?.ok && !storedDraft.draft) {
          const migrated = migrateLegacyDraft(localStorage, identity);
          if (migrated.ok && migrated.draft) return fromDraftEnvelope(migrated.draft, sheet);
        }
        persistSheet(sheet);
        return sheet;
      }
    } catch (e) {
      console.error("Failed to load sheet", e);
    }
    const sheet = withDraftIdentity(createDefaultSheet());
    persistSheet(sheet);
    return sheet;
  });

  const [editorSessionKey, setEditorSessionKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const cheatSheetRef = useRef(cheatSheet);
  const pendingCreatePromiseRef = useRef(null);
  const saveEpochRef = useRef(0);
  const saveControllerRef = useRef(null);
  const [theme, setTheme] = useState(() => {
    try {
      return normalizeTheme(localStorage.getItem('theme'));
    } catch (error) {
      console.error('Failed to load theme', error);
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (error) {
      console.error('Failed to save theme', error);
    }
  }, [theme]);

  useEffect(() => {
    cheatSheetRef.current = cheatSheet;
  }, [cheatSheet]);

  useEffect(() => () => {
    saveEpochRef.current += 1;
    saveControllerRef.current?.abort();
    saveControllerRef.current = null;
    pendingCreatePromiseRef.current = null;
  }, []);

  
  const { user, authTokens, logoutUser } = useContext(AuthContext);

  const handleReset = () => {
    saveEpochRef.current += 1;
    saveControllerRef.current?.abort();
    pendingCreatePromiseRef.current = null;
    setIsSaving(false);
    const nextSheet = withDraftIdentity(createDefaultSheet());
    setCheatSheet(nextSheet);
    setEditorSessionKey((prev) => prev + 1);
    persistSheet(nextSheet);
    safeStorageRemove('cheatSheetData');
    safeStorageRemove('cheatSheetLatex');
    try { removeDraft(localStorage, getDraftIdentity(cheatSheetRef.current)); } catch (error) { console.error('Failed to remove draft', error); }
  };

  useEffect(() => {
    const savedSheet = loadStoredSheet();
    if (savedSheet) {
      const storedDraft = readDraft(localStorage, getDraftIdentity(savedSheet));
      setCheatSheet(storedDraft.ok && storedDraft.draft ? fromDraftEnvelope(storedDraft.draft, savedSheet) : savedSheet);
    }
  }, []);

  const handleSave = async (data, showFeedback = true) => {
    const saveEpoch = showFeedback ? ++saveEpochRef.current : saveEpochRef.current;
    const sanitizedData = sanitizeSheet(data);
    const currentSheet = sanitizeSheet(cheatSheetRef.current);
    const nextContentSource = sanitizedData.contentSource ?? currentSheet.contentSource ?? inferContentSource(sanitizedData);
    const previousHistory = Array.isArray(currentSheet.compileHistory) ? stripTransientPdfBlobs(currentSheet.compileHistory) : [];
    const latestSnapshot = previousHistory[previousHistory.length - 1];
    const nextSnapshot = sanitizedData.compileSnapshot;
    const nextHistory = nextSnapshot
      ? (sameSnapshot(latestSnapshot, nextSnapshot)
          ? previousHistory
          : [...previousHistory, nextSnapshot])
      : previousHistory;
    const nextSheet = {
      ...currentSheet,
      ...sanitizedData,
      contentSource: nextContentSource,
      selectedFormulas: sanitizedData.selectedFormulas ?? currentSheet.selectedFormulas ?? [],
      formulaSelections: sanitizedData.formulaSelections ?? (sanitizedData.selectedFormulas ? undefined : currentSheet.formulaSelections),
      compileHistory: nextHistory,
    };
    delete nextSheet.compileSnapshot;
    const submittedSelectedFormulas = stripTransientPdfBlobs(nextSheet.selectedFormulas ?? []);

    cheatSheetRef.current = nextSheet;
    setCheatSheet(nextSheet);
    const localPersistence = persistSaveBoundary(nextSheet, nextHistory, nextSheet.contentSource);

    if (!localPersistence.ok) {
      console.error('Failed to persist canonical draft', localPersistence.error);
      if (showFeedback) alert('Failed to save progress: Unable to save this browser draft.');
      return nextSheet;
    }

    if (!showFeedback) {
      return nextSheet;
    }

    const shouldPersistRemotely = Boolean(authTokens?.access);

    if (!shouldPersistRemotely) {
      alert('Saved to this browser. Sign in if you want this sheet synced to your account.');
      return nextSheet;
    }

    setIsSaving(true);
    const controller = new globalThis.AbortController();
    saveControllerRef.current?.abort();
    saveControllerRef.current = controller;

    try {
      let sheetId = nextSheet.id;

      if (!sheetId && pendingCreatePromiseRef.current) {
        const pendingSheet = await pendingCreatePromiseRef.current.promise.catch(() => null);
        if (pendingSheet?.id) {
          sheetId = pendingSheet.id;
        }
      }

      const canonicalPayload = toCanonicalDocument({ ...nextSheet, selectedFormulas: submittedSelectedFormulas });
      delete canonicalPayload.revision;
      const requestPromise = fetch(sheetId ? `/api/cheatsheets/${sheetId}/` : '/api/cheatsheets/', {
        method: sheetId ? 'PATCH' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authTokens?.access ? { 'Authorization': `Bearer ${authTokens.access}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          ...canonicalPayload,
          ...(sheetId && Number.isSafeInteger(nextSheet.revision) && nextSheet.revision > 0 ? { revision: nextSheet.revision } : {}),
        }),
      });

      if (!sheetId) {
        pendingCreatePromiseRef.current = { epoch: saveEpoch, promise: requestPromise
          .then(async (response) => {
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.detail || errorData.error || 'Failed to save cheat sheet');
            }
            return response.clone().json();
          })
          .then((savedSheet) => ({
            ...nextSheet,
            id: savedSheet.id,
            ...fromServerDocument(savedSheet),
          })) };
      }
      const response = await requestPromise;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 409 && errorData.code === 'revision_conflict') {
          const conflictError = new Error('This sheet changed elsewhere. Your local changes are still saved in this browser.');
          conflictError.conflict = errorData.current ?? errorData.document;
          throw conflictError;
        }
        throw new Error(errorData.detail || errorData.error || 'Failed to save cheat sheet');
      }

      const savedSheet = sanitizeSheet(await response.json());
      if (saveEpoch !== saveEpochRef.current) return nextSheet;
      const sanitizedCurrentSheet = sanitizeSheet(cheatSheetRef.current);
      if (sanitizedCurrentSheet.draftId !== nextSheet.draftId) return nextSheet;
      const serverFields = fromServerDocument(savedSheet);
      let persistedSheet = { ...sanitizedCurrentSheet, id: serverFields.id ?? sanitizedCurrentSheet.id };
      Object.entries(serverFields).forEach(([field, value]) => {
        if (value !== undefined && sanitizedCurrentSheet[field] === nextSheet[field]) persistedSheet[field] = value;
      });
      if (Array.isArray(serverFields.selectedFormulas)
        && sameFormulas(sanitizedCurrentSheet.selectedFormulas, submittedSelectedFormulas)) {
        persistedSheet.selectedFormulas = stripTransientPdfBlobs(serverFields.selectedFormulas);
      }
      if (Number.isSafeInteger(serverFields.revision) && serverFields.revision > 0) {
        persistedSheet.revision = serverFields.revision;
        persistedSheet.baseRevision = serverFields.revision;
        persistedSheet.schemaVersion = serverFields.schemaVersion ?? 1;
      }
      persistedSheet = sanitizeSheet(persistedSheet);
      cheatSheetRef.current = persistedSheet;
      setCheatSheet(persistedSheet);
      const reconciliationPersistence = persistSheet(persistedSheet);
      const reconciliationSidecars = [
        saveStoredCompileHistory(persistedSheet.id, persistedSheet.compileHistory),
        saveStoredContentSource(persistedSheet.id, persistedSheet.contentSource),
      ];
      if (!reconciliationPersistence.ok || reconciliationSidecars.some((result) => !result.ok)) {
        alert('Saved to server, but failed to update this browser draft.');
        return persistedSheet;
      }
      alert('Progress saved!');
      return persistedSheet;
    } catch (error) {
      if (saveEpoch !== saveEpochRef.current) return nextSheet;
      console.error('Failed to save cheat sheet', error);
      alert(`Failed to save progress: ${error.message}`);
      throw error;
    } finally {
      if (pendingCreatePromiseRef.current?.epoch === saveEpoch) {
        pendingCreatePromiseRef.current = null;
      }
      if (saveEpoch === saveEpochRef.current) setIsSaving(false);
      if (saveControllerRef.current === controller) saveControllerRef.current = null;
    }
  };

  const handleEditSheet = (sheet) => {
    saveEpochRef.current += 1;
    saveControllerRef.current?.abort();
    pendingCreatePromiseRef.current = null;
    setIsSaving(false);
    const mappedSheet = fromServerDocument(sheet);
    const selectedFormulas = stripTransientPdfBlobs(mappedSheet.selectedFormulas || []);
    const editSheet = sanitizeSheet({
      id: sheet.id,
      ...mappedSheet,
      title: mappedSheet.title,
      content: mappedSheet.content,
      contentSource: mappedSheet.contentSource ?? getStoredContentSource(sheet.id) ?? inferContentSource({
        content: mappedSheet.content,
        selectedFormulas,
      }),
      columns: mappedSheet.columns,
      margins: mappedSheet.margins,
      fontSize: mappedSheet.fontSize,
      spacing: mappedSheet.spacing,
      orientation: mappedSheet.orientation,
      selectedFormulas,
      compileHistory: getStoredCompileHistory(sheet.id),
      draftId: `sheet-${sheet.id}`,
    });
    setCheatSheet(editSheet);
    setEditorSessionKey((prev) => prev + 1);
    persistSheet(editSheet);
    safeStorageRemove('cheatSheetData');
    safeStorageRemove('cheatSheetLatex');
  };

  const handleRestoreSnapshot = (snapshot) => {
    const restoredSheet = buildRestoredSheet(cheatSheet, snapshot);
    setCheatSheet(restoredSheet);
    setEditorSessionKey((prev) => prev + 1);
    persistSheet(restoredSheet);
    safeStorageRemove('cheatSheetData');
    safeStorageRemove('cheatSheetLatex');
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-header-nav">
            <MotionLink to="/" className="app-header-link" {...motionInteractionProps} aria-label="Home">
              <Home size={14} strokeWidth={1.8} aria-hidden="true" />
              <span>Home</span>
            </MotionLink>
            {user && (
              <MotionLink to="/dashboard" className="app-header-link" {...motionInteractionProps} aria-label="Dashboard">
                <LayoutDashboard size={14} strokeWidth={1.8} aria-hidden="true" />
                <span>Dashboard</span>
              </MotionLink>
            )}
            {user && (
              <MotionButton
                type="button"
                onClick={logoutUser}
                className="app-header-link app-header-logout"
                {...motionInteractionProps}
                aria-label={`Logout ${user.username}`}
              >
                <LogOut size={14} strokeWidth={1.8} aria-hidden="true" />
                <span>Logout</span>
              </MotionButton>
            )}
            {!user && (
              <MotionLink to="/login" className="app-header-link" {...motionInteractionProps} aria-label="Login">
                <LogIn size={14} strokeWidth={1.8} aria-hidden="true" />
                <span>Login</span>
              </MotionLink>
            )}
          </div>

          <div className="app-header-brand">
            <motion.img
              src="/math_webicon.png"
              alt=""
              aria-hidden="true"
              className="app-logo"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
            <div className="app-header-brand-copy">
              <h1>Cheat Sheet Generator</h1>
              <p>Write cheat sheets with integrated LaTeX support.</p>
            </div>
          </div>
          <div className="app-header-actions">
            <div className="app-theme-control">
              <Palette size={14} strokeWidth={1.8} aria-hidden="true" />
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="layout-select app-theme-select"
                aria-label="Select theme"
              >
                {THEMES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={
            <CreateCheatSheet 
              key={`${cheatSheet.draftId ?? `sheet-${cheatSheet.id ?? 'new'}`}-${editorSessionKey}`}
              initialData={cheatSheet} 
              draftIdentity={cheatSheet.draftId ?? cheatSheet.id}
              onSave={handleSave} 
              onReset={handleReset}
              onRestoreSnapshot={handleRestoreSnapshot}
              isSaving={isSaving}
              onCancel={() => {}} 
            />
          } />
          <Route path="/dashboard" element={
            <PrivateRoute>
              <Dashboard onEditSheet={handleEditSheet} onCreateNewSheet={handleReset} />
            </PrivateRoute>
          } />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <a href="https://github.com/ChicoState/cheat-sheet" target="_blank" rel="noopener noreferrer" title="View on GitHub">
          <svg height="24" viewBox="0 0 16 16" width="24" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </a>
      </footer>
    </div>
  );
}

export default App
