import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { useApiRequest } from '../hooks/useApiRequest';
import '../styles/Dashboard.css';

const Dashboard = ({ onEditSheet, onCreateNewSheet }) => {
  const [listing, setListing] = useState({ session: null, sheets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { authTokens, authSessionVersion } = useContext(AuthContext);
  const session = authSessionVersion ?? authTokens?.access ?? null;
  const hasAuth = Boolean(authTokens?.access);
  const sheets = hasAuth && listing.session === session ? listing.sheets : [];
  const controllersRef = useRef(new Set());
  const apiRequest = useApiRequest();
  const navigate = useNavigate();

  useEffect(() => {
    const controllers = controllersRef.current;
    const cancel = () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
    setListing({ session, sheets: [] });
    setError('');
    setLoading(hasAuth);
    if (!hasAuth) return cancel;
    const controller = new globalThis.AbortController();
    controllers.add(controller);
    const fetchSheets = async () => {
      try {
        const response = await apiRequest('/api/cheatsheets/', { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to load cheat sheets');
        const data = await response.json();
        if (!controller.signal.aborted) setListing({ session, sheets: data });
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        controllers.delete(controller);
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void fetchSheets();
    return cancel;
  }, [hasAuth, session, apiRequest]);

  const handleEdit = (sheet) => {
    onEditSheet(sheet);
    navigate('/');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this cheat sheet?')) return;
    if (!hasAuth) return;
    const controller = new globalThis.AbortController();
    controllersRef.current.add(controller);
    try {
      const response = await apiRequest(`/api/cheatsheets/${id}/`, {
        method: 'DELETE', signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to delete cheat sheet');
      }

      if (!controller.signal.aborted) setListing((previous) => ({ ...previous, sheets: previous.sheets.filter((sheet) => sheet.id !== id) }));
    } catch (err) {
      if (!controller.signal.aborted) alert(err.message);
    } finally {
      controllersRef.current.delete(controller);
    }
  };

  const handleDownload = async (sheet) => {
    if (!hasAuth) return;
    const controller = new globalThis.AbortController();
    controllersRef.current.add(controller);
    try {
      const response = await apiRequest('/api/compile/', {
        method: 'POST', signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cheat_sheet_id: sheet.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const a = document.createElement('a');
      const url = window.URL.createObjectURL(blob);
      try {
        a.href = url;
        a.download = `${sheet.title || 'cheat_sheet'}.pdf`;
        document.body.appendChild(a);
        a.click();
      } finally {
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (!controller.signal.aborted) alert(err.message);
    } finally {
      controllersRef.current.delete(controller);
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
