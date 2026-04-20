import { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export default AuthContext;

export const AuthProvider = ({ children }) => {
  const [authTokens, setAuthTokens] = useState(() =>
    localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null
  );
  const [user, setUser] = useState(() =>
    localStorage.getItem('authTokens') ? jwtDecode(localStorage.getItem('authTokens')) : null
  );
  
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

      const data = await response.json();

      if (response.status === 200) {
        setAuthTokens(data);
        setUser(jwtDecode(data.access));
        localStorage.setItem('authTokens', JSON.stringify(data));
        navigate('/');
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
        loginUser(username, password);
      } else {
        const data = await response.json();
        const errorMessage = typeof data === 'object' ? JSON.stringify(data) : 'Registration failed';
        alert(`Registration failed: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Network error. Is the backend running?');
    }
  };

  const logoutUser = () => {
    setAuthTokens(null);
    setUser(null);
    localStorage.removeItem('authTokens');
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

        const data = await response.json();

        if (response.status === 200) {
          setAuthTokens(data);
          setUser(jwtDecode(data.access));
          localStorage.setItem('authTokens', JSON.stringify(data));
        } else {
          setAuthTokens(null);
          setUser(null);
          localStorage.removeItem('authTokens');
          navigate('/login');
        }
      } catch (err) {
        console.error('Token refresh failed', err);
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