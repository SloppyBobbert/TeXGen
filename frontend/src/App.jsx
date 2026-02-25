import { useState, useEffect } from 'react'
import './App.css'
import CreateCheatSheet from './components/CreateCheatSheet';

function App() {
  const [cheatSheet, setCheatSheet] = useState({ title: '', content: '' });

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

  const handleSave = (data, showFeedback = true) => {
    setCheatSheet(data);
    localStorage.setItem('currentCheatSheet', JSON.stringify(data));
    if (showFeedback) {
      alert('Progress saved!');
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>Cheat Sheet Manager</h1>
        <p>Write cheat sheets with LaTeX support</p>
      </header>
      <main>
        <CreateCheatSheet 
          initialData={cheatSheet} 
          onSave={handleSave} 
          onCancel={() => {}} 
        />
      </main>
    </div>
  );
}

export default App