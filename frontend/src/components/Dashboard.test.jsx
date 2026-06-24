import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    window.alert = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('renders empty state without auth tokens and does not fetch sheets', async () => {
    renderWithContext(<Dashboard />, {});

    await waitFor(() => {
      expect(screen.getByText(/you haven't saved any cheat sheets yet/i)).toBeInTheDocument();
    });

    expect(global.fetch).not.toHaveBeenCalled();
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

  it('renders an error message when loading sheets fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
    });

    renderWithContext(<Dashboard />, { authTokens: { access: 'fake-token' } });

    await waitFor(() => {
      expect(screen.getByText(/error: failed to load cheat sheets/i)).toBeInTheDocument();
    });
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

  it('shows an alert when deleting a sheet fails', async () => {
    window.confirm = vi.fn(() => true);

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSheets,
    });

    global.fetch.mockResolvedValueOnce({
      ok: false,
    });

    renderWithContext(<Dashboard />, { authTokens: { access: 'fake-token' } });

    await waitFor(() => {
      expect(screen.getByText('Math Formulas')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to delete cheat sheet');
    });
  });

  it('shows an alert when PDF download fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSheets,
    });

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Compile failed' }),
    });

    renderWithContext(<Dashboard />, { authTokens: { access: 'fake-token' } });

    await waitFor(() => {
      expect(screen.getByText('Math Formulas')).toBeInTheDocument();
    });

    const downloadButtons = screen.getAllByRole('button', { name: /download pdf/i });
    fireEvent.click(downloadButtons[0]);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Compile failed');
    });
  });
});
