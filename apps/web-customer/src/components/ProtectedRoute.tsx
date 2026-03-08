import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
