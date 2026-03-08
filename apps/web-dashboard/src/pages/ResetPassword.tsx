import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client.js';

export function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token') ?? '';
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await apiClient.auth.confirmPasswordReset({ token, password });
            setDone(true);
        } catch (err: any) {
            setError(err?.message ?? 'Reset failed. The link may be expired or invalid.');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7' }}>
                <div style={{ width: 360 }}>
                    <div className="card">
                        <p style={{ color: '#de350b', marginBottom: '1rem' }}>Invalid or missing reset token.</p>
                        <Link to="/forgot-password" style={{ color: '#0052cc', textDecoration: 'none', fontSize: '0.875rem' }}>
                            Request a new reset link
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7' }}>
            <div style={{ width: 360 }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#172b4d' }}>✈ Felix Travel</div>
                    <div style={{ color: '#5e6c84', fontSize: '0.875rem', marginTop: '0.25rem' }}>Dashboard</div>
                </div>
                <div className="card">
                    <h1 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Set new password</h1>
                    {done ? (
                        <div>
                            <p style={{ color: '#36B37E', marginBottom: '1rem' }}>Your password has been reset.</p>
                            <button className="btn-primary" onClick={() => navigate('/login')} style={{ padding: '0.625rem', fontWeight: 600, width: '100%' }}>
                                Sign in
                            </button>
                        </div>
                    ) : (
                        <>
                            {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>New password</label>
                                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus minLength={8} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Confirm password</label>
                                    <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
                                </div>
                                <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.625rem', fontWeight: 600 }}>
                                    {loading ? 'Resetting…' : 'Reset password'}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
