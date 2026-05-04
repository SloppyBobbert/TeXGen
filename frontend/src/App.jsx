import { useState, useEffect, useContext } from 'react'
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import AuthContext from './context/AuthContext';
import Login from './components/Login';
import SignUp from './components/SignUp';
import Dashboard from './components/Dashboard';
import './App.css'
import CreateCheatSheet from './components/CreateCheatSheet';

const DEFAULT_SHEET = {
  title: '',
  content: '',
  columns: 2,
  fontSize: '10pt',
  spacing: 'large',
  margins: '0.25in',
  selectedFormulas: [],
};

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
  { id: 'neon',         label:     '🩵 neon'}
];

function App() {
  const normalizeTheme = (value) => {
    return THEMES.find(t => t.id === value ) ? value : 'light';
  };

  const [cheatSheet, setCheatSheet] = useState(() => {
    const saved = localStorage.getItem('currentCheatSheet');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse sheet", e);
      }
    }
    return { title: '', content: '', columns: 2, fontSize: '10pt', spacing: 'large' };
  });

  const [editorSessionKey, setEditorSessionKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return normalizeTheme(saved);
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  
  const { user, authTokens, logoutUser } = useContext(AuthContext);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleReset = () => {
    setCheatSheet(DEFAULT_SHEET);
    setEditorSessionKey((prev) => prev + 1);
    localStorage.setItem('currentCheatSheet', JSON.stringify(DEFAULT_SHEET));
    localStorage.removeItem('cheatSheetData');
    localStorage.removeItem('cheatSheetLatex');
  };

  useEffect(() => {
    const savedSheet = localStorage.getItem('currentCheatSheet');
    if (savedSheet) {
      try {
        setCheatSheet(JSON.parse(savedSheet));
      } catch (e) {
        console.error("Failed to parse sheet", e);
      }
    }
  }, []);

  const handleSave = async (data, showFeedback = true) => {
    const nextSheet = {
      ...cheatSheet,
      ...data,
      selectedFormulas: data.selectedFormulas ?? cheatSheet.selectedFormulas ?? [],
    };

    setCheatSheet(nextSheet);
    localStorage.setItem('currentCheatSheet', JSON.stringify(nextSheet));

    if (!showFeedback) {
      return nextSheet;
    }

    setIsSaving(true);

    try {
      const sheetId = nextSheet.id;
      const response = await fetch(sheetId ? `/api/cheatsheets/${sheetId}/` : '/api/cheatsheets/', {
        method: sheetId ? 'PATCH' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authTokens?.access ? { 'Authorization': `Bearer ${authTokens.access}` } : {}),
        },
        body: JSON.stringify({
          title: nextSheet.title,
          latex_content: nextSheet.content,
          columns: nextSheet.columns,
          margins: nextSheet.margins,
          font_size: nextSheet.fontSize,
          selected_formulas: nextSheet.selectedFormulas,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || 'Failed to save cheat sheet');
      }

      const savedSheet = await response.json();
      const persistedSheet = {
        ...nextSheet,
        id: savedSheet.id,
        content: savedSheet.latex_content ?? nextSheet.content,
        fontSize: savedSheet.font_size ?? nextSheet.fontSize,
        selectedFormulas: savedSheet.selected_formulas ?? nextSheet.selectedFormulas,
      };

      setCheatSheet(persistedSheet);
      localStorage.setItem('currentCheatSheet', JSON.stringify(persistedSheet));
      alert('Progress saved!');
      return persistedSheet;
    } catch (error) {
      console.error('Failed to save cheat sheet', error);
      alert(`Failed to save progress: ${error.message}`);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSheet = (sheet) => {
    const editSheet = {
      id: sheet.id,
      title: sheet.title,
      content: sheet.latex_content,
      columns: sheet.columns,
      margins: sheet.margins,
      fontSize: sheet.font_size,
      selectedFormulas: sheet.selected_formulas || [],
    };
    setCheatSheet(editSheet);
    setEditorSessionKey((prev) => prev + 1);
    localStorage.setItem('currentCheatSheet', JSON.stringify(editSheet));
    localStorage.removeItem('cheatSheetData');
    localStorage.removeItem('cheatSheetLatex');
  };

  return (
    <div className="App">
      <header className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1rem', width: '100%' }}>
          <div style={{ flex: 1, display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link to="/" style={{ textDecoration: 'none', color: 'var(--text)' }}>Home</Link>
            {user && <Link to="/dashboard" style={{ textDecoration: 'none', color: 'var(--text)' }}>Dashboard</Link>}
            {user && <button onClick={logoutUser} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 0, font: 'inherit' }}>Logout ({user.username})</button>}
            {!user && <Link to="/login" style={{ textDecoration: 'none', color: 'var(--text)' }}>Login</Link>}
          </div>

          <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: 0 }}>Cheat Sheet Generator</h1>
            <p style={{ margin: 0, fontSize: '0.8543m', color: 'var(--text-muted)'}}>
              Write Cheat Sheets With Integrated LaTeX Support!
            </p>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="layout-select"
          style={{ fontSize: '0.85rem', cursor: 'pointer' }}
          >
        {THEMES.map(t => (
        <option key={t.id} value={t.id}>{t.label}</option>
      ))}
    </select>
  </div>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={
            <CreateCheatSheet 
              key={`${cheatSheet.id ?? 'new'}-${editorSessionKey}`}
              initialData={cheatSheet} 
              onSave={handleSave} 
              onReset={handleReset}
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