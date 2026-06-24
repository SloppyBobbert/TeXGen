import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import AuthContext from './context/AuthContext';

vi.mock('./components/CreateCheatSheet', () => ({
  default: ({ initialData, onSave, onReset, isSaving }) => (
    <div>
      <div data-testid="sheet-title">{initialData.title}</div>
      <button type="button" onClick={onReset}>Mock Reset</button>
      <button
        type="button"
        disabled={isSaving}
        onClick={() => onSave({
          title: 'Saved Sheet',
          content: '\\begin{document}Saved\\end{document}',
          columns: 3,
          fontSize: '8pt',
          spacing: 'tiny',
          margins: '0.5in',
          selectedFormulas: [{ class: 'ALGEBRA I', category: 'Linear Equations', name: 'Slope Formula' }],
        })}
      >
        Mock Save
      </button>
    </div>
  ),
}));

vi.mock('./components/Dashboard', () => ({
  default: () => <div>Dashboard</div>,
}));

vi.mock('./components/Login', () => ({
  default: () => <div>Login</div>,
}));

vi.mock('./components/SignUp', () => ({
  default: () => <div>Sign Up</div>,
}));

describe('App sheet persistence flow', () => {
  const authValue = {
    user: { username: 'testuser' },
    authTokens: { access: 'test-token' },
    logoutUser: vi.fn(),
  };

  const renderApp = () => render(
    <MemoryRouter initialEntries={['/']}>
      <AuthContext.Provider value={authValue}>
        <App />
      </AuthContext.Provider>
    </MemoryRouter>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.alert = vi.fn();
    global.fetch = vi.fn();
  });

  it('reset clears draft storage keys and replaces current sheet with defaults', () => {
    localStorage.setItem('currentCheatSheet', JSON.stringify({ title: 'Old Sheet', content: 'old' }));
    localStorage.setItem('cheatSheetData', JSON.stringify({ selectedClasses: { 'ALGEBRA I': true } }));
    localStorage.setItem('cheatSheetLatex', JSON.stringify({ content: 'stale draft' }));

    renderApp();

    expect(screen.getByTestId('sheet-title')).toHaveTextContent('Old Sheet');

    fireEvent.click(screen.getByRole('button', { name: 'Mock Reset' }));

    expect(JSON.parse(localStorage.getItem('currentCheatSheet'))).toEqual({
      title: '',
      content: '',
      columns: 2,
      fontSize: '10pt',
      spacing: 'large',
      margins: '0.25in',
      selectedFormulas: [],
    });
    expect(localStorage.getItem('cheatSheetData')).toBeNull();
    expect(localStorage.getItem('cheatSheetLatex')).toBeNull();
  });

  it('save posts current sheet payload and persists server-normalized response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 42,
        latex_content: '\\begin{document}Saved from API\\end{document}',
        font_size: '9pt',
        selected_formulas: [{ class: 'ALGEBRA I', category: 'Linear Equations', name: 'Slope Formula' }],
      }),
    });

    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Mock Save' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/cheatsheets/', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
      }));
    });

    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody).toEqual({
      title: 'Saved Sheet',
      latex_content: '\\begin{document}Saved\\end{document}',
      columns: 3,
      margins: '0.5in',
      font_size: '8pt',
      selected_formulas: [{ class: 'ALGEBRA I', category: 'Linear Equations', name: 'Slope Formula' }],
    });

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('currentCheatSheet'))).toEqual(expect.objectContaining({
        id: 42,
        title: 'Saved Sheet',
        content: '\\begin{document}Saved from API\\end{document}',
        fontSize: '9pt',
      }));
    });
    expect(window.alert).toHaveBeenCalledWith('Progress saved!');
  });
});
