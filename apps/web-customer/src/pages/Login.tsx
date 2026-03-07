import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/bookings');
    } catch (err: any) {
      setError(err?.message ?? 'Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Sign in to Felix Travel</h1>
      {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.625rem', fontWeight: 600 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>
        Don't have an account? <Link to="/register">Sign up</Link>
      </p>
    </div>
  );
}
