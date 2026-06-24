import React, { useContext } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import AuthContext, { AuthProvider } from './AuthContext';

// Mock jwt-decode
vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn((_token) => ({ username: 'testuser', exp: Date.now() / 1000 + 3600 }))
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// A dummy component to consume AuthContext for testing
const TestComponent = () => {
  const { user, loginUser, logoutUser, registerUser } = useContext(AuthContext);
  
  return (
    <div>
      <div data-testid="user">{user ? user.username : 'No user'}</div>
      <button onClick={() => loginUser('testuser', 'password123')}>Login</button>
      <button onClick={() => logoutUser()}>Logout</button>
      <button onClick={() => registerUser('newuser', 'password123')}>Register</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    window.alert = vi.fn();
  });

  const renderWithRouter = (ui) => {
    return render(
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    );
  };

  it('provides initial state without user', () => {
    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    expect(screen.getByTestId('user')).toHaveTextContent('No user');
  });

  it('successfully logs in a user', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access: 'fake-access-token', refresh: 'fake-refresh-token' })
    });

    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('handles login failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Invalid credentials' })
    });

    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No user');
      expect(window.alert).toHaveBeenCalledWith('Invalid credentials');
    });
  });

  it('successfully registers and auto-logs in', async () => {
    // Registration fetch mock
    global.fetch.mockResolvedValueOnce({ status: 201 });
    // Auto-login fetch mock right after registration
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access: 'fake-access-token', refresh: 'fake-refresh-token' })
    });

    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Register'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('handles logout correctly', async () => {
    // First, login
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access: 'fake-access-token', refresh: 'fake-refresh-token' })
    });

    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
    });

    // Now, logout
    fireEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No user');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('refreshes tokens for an authenticated user', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access: 'fake-access-token', refresh: 'fake-refresh-token' })
    });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access: 'refreshed-access-token', refresh: 'refreshed-refresh-token' })
    });

    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
    });

    const refreshTokens = setIntervalSpy.mock.calls.at(-1)?.[0];

    await act(async () => {
      await refreshTokens();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/token/refresh/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: 'fake-refresh-token' }),
      });
      expect(jwtDecode).toHaveBeenLastCalledWith('refreshed-access-token');
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
    });
  });

  it('clears auth state when token refresh fails', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access: 'fake-access-token', refresh: 'fake-refresh-token' })
    });
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Token refresh failed' })
    });

    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
    });

    const refreshTokens = setIntervalSpy.mock.calls.at(-1)?.[0];

    await act(async () => {
      await refreshTokens();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No user');
      expect(mockNavigate).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenLastCalledWith('/');
    });
  });

  it('does not refresh tokens when no user is authenticated', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const refreshTokens = setIntervalSpy.mock.calls.at(-1)?.[0];

    act(() => {
      refreshTokens();
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('user')).toHaveTextContent('No user');
  });
});
