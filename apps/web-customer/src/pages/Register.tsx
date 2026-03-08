import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient, setTokens } from '../lib/api-client.js';

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await apiClient.auth.register(form);
      setTokens(result.tokens.accessToken, result.tokens.refreshToken);
      navigate('/bookings');
    } catch (err: any) {
      setError(err?.message ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Create your account</h1>
      {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="grid-2">
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>First name</label>
            <input value={form.firstName} onChange={set('firstName')} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>Last name</label>
            <input value={form.lastName} onChange={set('lastName')} required />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>Email</label>
          <input type="email" value={form.email} onChange={set('email')} required />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>Phone (optional)</label>
          <input type="tel" value={form.phone} onChange={set('phone')} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>Password</label>
          <input type="password" value={form.password} onChange={set('password')} required minLength={8} />
        </div>
        <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.625rem', fontWeight: 600 }}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
