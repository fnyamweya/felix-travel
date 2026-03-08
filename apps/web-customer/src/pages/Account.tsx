import { useAuth } from '../lib/auth-context.js';

export function AccountPage() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="page-narrow">
      <h1 className="page-title">My Account</h1>
      <div className="card">
        <div className="section-title">Profile</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
          <div><span className="text-muted">First name</span><br /><strong>{user.firstName}</strong></div>
          <div><span className="text-muted">Last name</span><br /><strong>{user.lastName}</strong></div>
          <div><span className="text-muted">Email</span><br /><strong>{user.email}</strong></div>
          <div><span className="text-muted">Role</span><br /><strong style={{ textTransform: 'capitalize' }}>{user.role}</strong></div>
        </div>

        <hr className="divider" />

        <button className="btn-secondary" style={{ width: '100%', color: '#de350b', borderColor: '#de350b' }} onClick={logout}>
          Sign out
        </button>
      </div>
    </div>
  );
}
