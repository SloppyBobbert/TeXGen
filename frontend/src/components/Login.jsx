import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { loginUser } = useContext(AuthContext);

  const handleSubmit = (e) => {
    e.preventDefault();
    loginUser(username, password);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '2.5rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' }}>
      <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Welcome Back</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text)' }}>Username</label>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input-field"
            required
            style={{ marginBottom: 0 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text)' }}>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            required
            style={{ marginBottom: 0 }}
          />
        </div>
        <button type="submit" className="btn primary" style={{ padding: '0.75rem', marginTop: '0.5rem', fontSize: '1rem' }}>Log In</button>
      </form>
      <p style={{ marginTop: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Don't have an account? <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>Sign Up</Link>
      </p>
    </div>
  );
};

export default Login;