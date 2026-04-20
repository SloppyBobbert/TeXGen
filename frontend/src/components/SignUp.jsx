import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const SignUp = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { registerUser } = useContext(AuthContext);

  const handleSubmit = (e) => {
    e.preventDefault();
    registerUser(username, password);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '2.5rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' }}>
      <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Create an Account</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label htmlFor="signup-username" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text)' }}>Username</label>
          <input
            id="signup-username"
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input-field"
            autoComplete="username"
            required
            style={{ marginBottom: 0 }}
          />
        </div>
        <div>
          <label htmlFor="signup-password" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text)' }}>Password</label>
          <input
            id="signup-password"
            type="password"
            placeholder="Choose a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            autoComplete="new-password"
            required
            style={{ marginBottom: 0 }}
          />
        </div>
        <button type="submit" className="btn primary" style={{ padding: '0.75rem', marginTop: '0.5rem', fontSize: '1rem' }}>Sign Up</button>
      </form>
      <p style={{ marginTop: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>Log In</Link>
      </p>
    </div>
  );
};

export default SignUp;