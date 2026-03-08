import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api-client.js';

export function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await apiClient.auth.requestPasswordReset({ email });
            setSent(true);
        } catch (err: any) {
            setError(err?.message ?? 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7' }}>
            <div style={{ width: 360 }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#172b4d' }}>✈ Felix Travel</div>
                    <div style={{ color: '#5e6c84', fontSize: '0.875rem', marginTop: '0.25rem' }}>Dashboard</div>
                </div>
                <div className="card">
                    <h1 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Reset your password</h1>
                    {sent ? (
                        <div>
                            <p style={{ color: '#36B37E', marginBottom: '1rem' }}>
                                If an account exists for <strong>{email}</strong>, a password reset link has been sent.
                            </p>
                            <Link to="/login" style={{ color: '#0052cc', textDecoration: 'none', fontSize: '0.875rem' }}>
                                ← Back to sign in
                            </Link>
                        </div>
                    ) : (
                        <>
                            {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Email</label>
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                                </div>
                                <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.625rem', fontWeight: 600 }}>
                                    {loading ? 'Sending…' : 'Send reset link'}
                                </button>
                            </form>
                            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                                <Link to="/login" style={{ color: '#0052cc', textDecoration: 'none', fontSize: '0.875rem' }}>
                                    ← Back to sign in
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
