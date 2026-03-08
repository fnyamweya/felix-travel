import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';

function SidebarLink({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
      <span>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isProvider = user?.role === 'service_provider';

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">✈ Felix Travel</div>

        {!isProvider && (
          <>
            <div className="sidebar-section">Main</div>
            <SidebarLink to="/admin" icon="📊" label="Dashboard" />
            <SidebarLink to="/admin/bookings" icon="📋" label="Bookings" />
            <SidebarLink to="/admin/customers" icon="👥" label="Customers" />
            <SidebarLink to="/admin/providers" icon="🏢" label="Providers" />

            <div className="sidebar-section">Finance</div>
            <SidebarLink to="/admin/refunds" icon="↩️" label="Refunds" />
            <SidebarLink to="/admin/payouts" icon="💸" label="Payouts" />
            <SidebarLink to="/admin/charges" icon="⚙️" label="Charge Engine" />
            <SidebarLink to="/admin/charges/simulate" icon="🧮" label="Simulator" />

            <div className="sidebar-section">System</div>
            <SidebarLink to="/admin/audit" icon="📝" label="Audit Log" />
          </>
        )}

        {isProvider && (
          <>
            <div className="sidebar-section">Provider</div>
            <SidebarLink to="/provider" icon="📊" label="Overview" />
            <SidebarLink to="/provider/payouts" icon="💸" label="Payouts" />
            <SidebarLink to="/provider/settlement" icon="📄" label="Settlement" />
          </>
        )}

        <div style={{ marginTop: 'auto', padding: '1rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>
            {user?.firstName} {user?.lastName}
            <br />
            <span style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</span>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="btn-secondary" style={{ width: '100%', padding: '6px 10px', fontSize: '0.8125rem' }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <div className="topbar">
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
            {user?.role === 'admin' ? 'Admin Console' : user?.role === 'agent' ? 'Agent Console' : 'Provider Portal'}
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-600)' }}>
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
