import { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export default AuthContext;

export const AuthProvider = ({ children }) => {
  // Tokens are stored in-memory only (not localStorage) to reduce XSS risk.
  // Users will need to log in again after a page refresh.
  const [authTokens, setAuthTokens] = useState(null);
  const [user, setUser] = useState(null);

  const navigate = useNavigate();

  const loginUser = async (username, password) => {
    try {
      const response = await fetch('/api/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json().catch(() => ({ detail: 'Invalid server response' }));

      if (response.ok) {
        setAuthTokens(data);
        setUser(jwtDecode(data.access));
        navigate('/dashboard');
      } else {
        alert(data.detail || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Network error. Is the backend running?');
    }
  };

  const registerUser = async (username, password) => {
    try {
      const response = await fetch('/api/register/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.status === 201) {
        // Auto login after registration
        await loginUser(username, password);
      } else {
        const data = await response.json().catch(() => ({}));
        const errorMessage = typeof data === 'object'
          ? Object.entries(data).map(([field, msgs]) => `${field}: ${[].concat(msgs).join(', ')}`).join('\n')
          : 'Registration failed';
        alert(`Registration failed:\n${errorMessage}`);
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Network error. Is the backend running?');
    }
  };

  const logoutUser = () => {
    setAuthTokens(null);
    setUser(null);
    navigate('/login');
  };

  useEffect(() => {
    const updateToken = async () => {
      if (!authTokens) return;

      try {
        const response = await fetch('/api/token/refresh/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh: authTokens?.refresh }),
        });

        const data = await response.json().catch(() => ({ detail: 'Invalid server response' }));

        if (response.ok) {
          setAuthTokens(prev => ({ ...prev, ...data }));
          setUser(jwtDecode(data.access));
        } else {
          setAuthTokens(null);
          setUser(null);
          navigate('/login');
        }
      } catch (err) {
        console.error('Token refresh failed', err);
        setAuthTokens(null);
        setUser(null);
        navigate('/login');
      }
    };

    const interval = window.setInterval(() => {
      if (authTokens) {
        updateToken();
      }
    }, 1000 * 60 * 4); // Refresh every 4 minutes (default lifespan is 5m)
    return () => window.clearInterval(interval);
  }, [authTokens, navigate]);

  return (
    <AuthContext.Provider value={{ user, authTokens, loginUser, registerUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
};