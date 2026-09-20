import { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import { createApiClient } from '../api/client';

const AuthContext = createContext();
const publicApi = createApiClient();
export default AuthContext;

export const AuthProvider = ({ children }) => {
  // Credentials stay in memory. Every login/logout invalidates older responses.
  const [authTokens, setAuthTokens] = useState(null);
  const [user, setUser] = useState(null);
  const sessionRef = useRef({ version: 0, tokens: null });
  const controllersRef = useRef(new Set());
  const navigate = useNavigate();

  const publishTokens = useCallback((tokens) => {
    const decoded = tokens ? jwtDecode(tokens.access) : null;
    sessionRef.current = { ...sessionRef.current, tokens };
    setAuthTokens(tokens);
    setUser(decoded);
  }, []);

  const resetSession = useCallback(() => {
    sessionRef.current = { version: sessionRef.current.version + 1, tokens: null };
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    publishTokens(null);
    return sessionRef.current.version;
  }, [publishTokens]);

  const requestAuth = useCallback(async (url, body) => {
    const version = sessionRef.current.version;
    const controller = new globalThis.AbortController();
    controllersRef.current.add(controller);
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await publicApi.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = response.status === 201 ? {} : await response.json().catch(() => ({ detail: 'Invalid server response' }));
      if (version !== sessionRef.current.version || controller.signal.aborted) return null;
      return { response, data };
    } finally {
      window.clearTimeout(timeout);
      controllersRef.current.delete(controller);
    }
  }, []);

  // One client per provider shares refresh across timer and concurrent reads.
  const [api] = useState(() => createApiClient({
    getSession: () => sessionRef.current,
    refreshSession: async (original) => {
      if (sessionRef.current.version !== original.version) return false;
      try {
        const result = await requestAuth('/api/token/refresh/', { refresh: original.tokens.refresh });
        if (sessionRef.current.version !== original.version) return false;
        if (result?.response.ok) {
          publishTokens({ ...original.tokens, ...result.data });
          return true;
        }
      } catch {
        if (sessionRef.current.version !== original.version) return false;
        console.error('Token refresh failed');
      }
      resetSession();
      navigate('/');
      return false;
    },
  }));

  const loginUser = async (username, password) => {
    const version = resetSession();
    try {
      const result = await requestAuth('/api/token/', { username, password });
      if (!result || version !== sessionRef.current.version) return;
      if (result.response.ok) {
        publishTokens(result.data);
        navigate('/');
      } else {
        alert(result.data.detail || 'Invalid credentials');
      }
    } catch {
      if (version !== sessionRef.current.version) return;
      console.error('Login request failed');
      alert('Network error. Is the backend running?');
    }
  };

  const registerUser = async (username, password) => {
    const version = resetSession();
    try {
      const result = await requestAuth('/api/register/', { username, password });
      if (!result || version !== sessionRef.current.version) return;
      if (result.response.status === 201) {
        await loginUser(username, password);
      } else {
        const errorMessage = result.data && typeof result.data === 'object'
          ? Object.entries(result.data).map(([field, msgs]) => `${field}: ${[].concat(msgs).join(', ')}`).join('\n')
          : 'Registration failed';
        alert(`Registration failed:\n${errorMessage}`);
      }
    } catch {
      if (version !== sessionRef.current.version) return;
      console.error('Registration request failed');
      alert('Network error. Is the backend running?');
    }
  };

  const logoutUser = () => {
    resetSession();
    navigate('/');
  };

  useEffect(() => {
    const controllers = controllersRef.current;
    const interval = window.setInterval(() => { void api.refresh(); }, 1000 * 60 * 4);
    return () => {
      window.clearInterval(interval);
      sessionRef.current = { version: sessionRef.current.version + 1, tokens: null };
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, [api]);

  return (
    <AuthContext.Provider value={{ user, authTokens, loginUser, registerUser, logoutUser, apiRequest: api.request, authSessionVersion: sessionRef.current.version }}>
      {children}
    </AuthContext.Provider>
  );
};
