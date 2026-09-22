import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthContext from '../context/AuthContext';
import Dashboard from './Dashboard';

const renderWithContext = (component, authContextValue = {}) => {
  return render(
    <AuthContext.Provider value={authContextValue}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

const mockSheets = [
  { id: 1, title: 'Math Formulas', created_at: '2026-05-01T10:00:00Z', updated_at: '2026-05-01T10:30:00Z' },
  { id: 2, title: 'Physics Laws', created_at: '2026-04-20T10:00:00Z', updated_at: '2026-04-21T10:30:00Z' }
];

describe('Dashboard Component', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('ignores an old response body after switching accounts', async () => {
    let resolveOld;
    const oldBody = new Promise((resolve) => { resolveOld = resolve; });
    const readOld = vi.fn(() => oldBody);
    fetch.mockResolvedValueOnce({ ok: true, json: readOld })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ ...mockSheets[0], title: 'New account sheet' }] });
    const view = (access) => <AuthContext.Provider value={{ authTokens: { access } }}><BrowserRouter><Dashboard /></BrowserRouter></AuthContext.Provider>;
    const rendered = render(view('first'));
    await waitFor(() => expect(readOld).toHaveBeenCalledOnce());
    rendered.rerender(view('second'));
    await screen.findByText('New account sheet');
    await act(async () => { resolveOld(mockSheets); });
    expect(screen.getByText('New account sheet')).toBeInTheDocument();
    expect(screen.queryByText('Math Formulas')).not.toBeInTheDocument();
  });

  it('clears account sheets after logout', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockSheets });
    const view = (authTokens) => <AuthContext.Provider value={{ authTokens }}><BrowserRouter><Dashboard /></BrowserRouter></AuthContext.Provider>;
    const rendered = render(view({ access: 'first' }));
    await screen.findByText('Math Formulas');
    rendered.rerender(view(null));
    expect(screen.queryByText('Math Formulas')).not.toBeInTheDocument();
  });

  it('does not publish a PDF after unmount while reading its body', async () => {
    let resolveBlob;
    const pendingBlob = new Promise((resolve) => { resolveBlob = resolve; });
    const readBlob = vi.fn(() => pendingBlob);
    const createObjectURL = vi.fn(() => 'blob:stale');
    vi.stubGlobal('URL', Object.assign(class extends globalThis.URL {}, { createObjectURL, revokeObjectURL: vi.fn() }));
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockSheets })
      .mockResolvedValueOnce({ ok: true, blob: readBlob });
    const rendered = renderWithContext(<Dashboard />, { authTokens: { access: 'first' } });
    await screen.findByText('Math Formulas');
    fireEvent.click(screen.getAllByRole('button', { name: 'Download PDF' })[0]);
    await waitFor(() => expect(readBlob).toHaveBeenCalledOnce());
    const signal = fetch.mock.calls[1][1].signal;
    rendered.unmount();
    await act(async () => { resolveBlob(new Blob(['pdf'])); });
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(signal?.aborted).toBe(true);
  });

  it('renders an empty dashboard without requesting sheets when signed out', async () => {
    renderWithContext(<Dashboard />, {});
    expect(await screen.findByText(/you haven't saved any cheat sheets yet/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows a failed sheet-list request', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500 });
    renderWithContext(<Dashboard />, { authTokens: { access: 'token' } });
    expect(await screen.findByText('Error: Failed to load cheat sheets')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('keeps the sheet and reports a failed deletion', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockSheets })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    renderWithContext(<Dashboard />, { authTokens: { access: 'token' } });
    await screen.findByText('Math Formulas');
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]);
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Failed to delete cheat sheet'));
    expect(fetch).toHaveBeenLastCalledWith('/api/cheatsheets/1/', expect.objectContaining({ method: 'DELETE' }));
    expect(screen.getByText('Math Formulas')).toBeInTheDocument();
  });

  it('reports the server error when downloading a PDF fails', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockSheets })
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: 'Compile failed' }) });
    renderWithContext(<Dashboard />, { authTokens: { access: 'token' } });
    await screen.findByText('Math Formulas');
    fireEvent.click(screen.getAllByRole('button', { name: 'Download PDF' })[0]);
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Compile failed'));
    expect(fetch).toHaveBeenLastCalledWith('/api/compile/', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ cheat_sheet_id: 1 }),
    }));
  });

  it('renders loading state initially', () => {
    global.fetch.mockImplementationOnce(() => new Promise(() => {})); // pending promise
    renderWithContext(<Dashboard />, { authTokens: { access: 'fake-token' } });
    expect(screen.getByText(/loading your sheets.../i)).toBeInTheDocument();
  });

  it('renders empty state when there are no sheets', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    renderWithContext(<Dashboard />, { authTokens: { access: 'fake-token' } });

    await waitFor(() => {
      expect(screen.getByText(/you haven't saved any cheat sheets yet/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /create your first sheet/i })).toBeInTheDocument();
  });

  it('renders a list of sheets when API returns data', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSheets,
    });

    renderWithContext(<Dashboard />, { authTokens: { access: 'fake-token' } });

    await waitFor(() => {
      expect(screen.queryByText(/loading your sheets.../i)).not.toBeInTheDocument();
    });

    expect(screen.getByText('Math Formulas')).toBeInTheDocument();
    expect(screen.getByText('Physics Laws')).toBeInTheDocument();
  });

  it('calls onEditSheet and navigate when Edit is clicked', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSheets,
    });

    const mockOnEditSheet = vi.fn();
    renderWithContext(<Dashboard onEditSheet={mockOnEditSheet} />, { authTokens: { access: 'fake-token' } });

    await waitFor(() => {
      expect(screen.getByText('Math Formulas')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);

    expect(mockOnEditSheet).toHaveBeenCalledTimes(1);
    expect(mockOnEditSheet).toHaveBeenCalledWith(mockSheets[0]);
  });

  it('calls onDelete when Delete occurs and handles confirmation', async () => {
    window.confirm = vi.fn(() => true); // Mock confirm to always click "yes"
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSheets,
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
    });

    renderWithContext(<Dashboard />, { authTokens: { access: 'fake-token' } });

    await waitFor(() => {
      expect(screen.getByText('Math Formulas')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/cheatsheets/1/', expect.objectContaining({ method: 'DELETE' }));
    });
  });
});
