import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import '../styles/Dashboard.css';

const Dashboard = ({ onEditSheet, onCreateNewSheet }) => {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { authTokens } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSheets = async () => {
      try {
        const response = await fetch('/api/cheatsheets/', {
          headers: {
            'Authorization': `Bearer ${authTokens?.access}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load cheat sheets');
        }

        const data = await response.json();
        setSheets(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSheets();
  }, [authTokens]);

  const handleEdit = (sheet) => {
    onEditSheet(sheet);
    navigate('/');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this cheat sheet?')) return;

    try {
      const response = await fetch(`/api/cheatsheets/${id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authTokens?.access}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete cheat sheet');
      }

      setSheets(sheets.filter((sheet) => sheet.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDownload = async (sheet) => {
    try {
      const response = await fetch('/api/compile/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authTokens?.access}`,
        },
        body: JSON.stringify({ cheat_sheet_id: sheet.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sheet.title || 'cheat_sheet'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="dashboard-loading">Loading your sheets...</div>;
  if (error) return <div className="dashboard-error">Error: {error}</div>;

  return (
    <div className="dashboard-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>My Cheat Sheets</h2>
        <button className="btn primary" onClick={() => { onCreateNewSheet(); navigate('/'); }}>Create New Sheet</button>
      </div>
      {sheets.length === 0 ? (
        <div className="empty-state">
          <p>You haven't saved any cheat sheets yet.</p>
          <button className="btn primary" onClick={() => { onCreateNewSheet(); navigate('/'); }}>Create Your First Sheet</button>
        </div>
      ) : (
        <div className="sheets-grid">
          {sheets.map((sheet) => (
            <div key={sheet.id} className="sheet-card">
              <h3>{sheet.title || 'Untitled Sheet'}</h3>
              <p className="sheet-meta">
                Created: {new Date(sheet.created_at).toLocaleDateString()}<br/>
                Last modified: {new Date(sheet.updated_at).toLocaleDateString()}
              </p>
              <div className="sheet-actions">
                <button className="btn small" onClick={() => handleEdit(sheet)}>Edit</button>
                <button className="btn small primary" onClick={() => handleDownload(sheet)}>Download PDF</button>
                <button className="btn small danger" onClick={() => handleDelete(sheet.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
