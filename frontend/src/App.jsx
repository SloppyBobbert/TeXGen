import { useState, useEffect } from 'react'
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

function App() {
  const normalizeTheme = (value) => {
    return value === 'dark' || value === 'light' ? value : 'dark';
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
    return DEFAULT_SHEET;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return normalizeTheme(saved);
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
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
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="App">
      <header className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1rem' }}>
          <div>
            <h1>Cheat Sheet Generator</h1>
            <p>Write cheat sheets with LaTeX support</p>
          </div>
          <button onClick={toggleTheme} className="btn primary" style={{ margin: 0, height: 'fit-content' }}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>
      <main>
        <CreateCheatSheet 
          initialData={cheatSheet} 
          onSave={handleSave} 
          isSaving={isSaving}
          onCancel={() => {}} 
        />
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
