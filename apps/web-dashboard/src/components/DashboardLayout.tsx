import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';

function SidebarLink({ to, accent, label, caption }: { to: string; accent: string; label: string; caption: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
      <span className="sidebar-link-mark">{accent}</span>
      <span className="sidebar-link-copy">
        <strong>{label}</strong>
        <small>{caption}</small>
      </span>
    </NavLink>
  );
}

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isProvider = user?.role === 'service_provider';

  const topbarLabel = user?.role === 'admin'
    ? 'Admin console'
    : user?.role === 'agent'
      ? 'Operations console'
      : 'Provider portal';

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">FT</span>
          <div>
            <strong>Felix Travel</strong>
            <small>Operations workspace</small>
          </div>
        </div>

        {!isProvider && (
          <>
            <div className="sidebar-section">Overview</div>
            <SidebarLink to="/admin" accent="DB" label="Dashboard" caption="Revenue, payouts, and live activity" />

            <div className="sidebar-section">Operations</div>
            <SidebarLink to="/admin/bookings" accent="BK" label="Bookings" caption="Monitor booking throughput" />
            <SidebarLink to="/admin/customers" accent="AC" label="Access" caption="Users, invites, and account controls" />
            <SidebarLink to="/admin/providers" accent="PR" label="Providers" caption="Provider records and market setup" />

            <div className="sidebar-section">Finance</div>
            <SidebarLink to="/admin/refunds" accent="RF" label="Refunds" caption="Refund requests and approvals" />
            <SidebarLink to="/admin/payouts" accent="PO" label="Payouts" caption="Settlement pipeline management" />
            <SidebarLink to="/admin/charges" accent="CH" label="Charges" caption="Definitions, rules, and dependencies" />
            <SidebarLink to="/admin/charges/simulate" accent="SM" label="Simulator" caption="Dry-run engine output" />

            <div className="sidebar-section">Control</div>
            <SidebarLink to="/admin/audit" accent="AL" label="Audit log" caption="Operational traceability" />
          </>
        )}

        {isProvider && (
          <>
            <div className="sidebar-section">Provider</div>
            <SidebarLink to="/provider" accent="OV" label="Overview" caption="Bookings and balance overview" />
            <SidebarLink to="/provider/payouts" accent="PO" label="Payouts" caption="Track upcoming settlements" />
            <SidebarLink to="/provider/settlement" accent="ST" label="Settlement" caption="Statements and invoice detail" />
          </>
        )}

        <div className="sidebar-user">
          <div className="sidebar-user-copy">
            <strong>{user?.firstName} {user?.lastName}</strong>
            <small>{user?.email}</small>
            <span>{user?.role?.replace('_', ' ')}</span>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="btn-secondary"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div>
            <span className="topbar-title">{topbarLabel}</span>
            <p className="topbar-copy">Schema-aware tools for day-to-day marketplace administration.</p>
          </div>
          <div className="topbar-meta">
            <span>{new Date().toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
