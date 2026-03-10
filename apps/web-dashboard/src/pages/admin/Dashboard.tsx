import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';
import { formatMoney, formatDate, titleizeToken } from '../../lib/admin-utils.js';

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="dashboard-stat-card">
      <span className="dashboard-stat-label">{label}</span>
      <strong className="dashboard-stat-value">{value}</strong>
      <span className="dashboard-stat-hint">{hint}</span>
    </div>
  );
}

export function AdminDashboard() {
  const { data: bookings } = useQuery({
    queryKey: ['admin-bookings', 'dashboard'],
    queryFn: () => apiClient.admin.listBookings({ pageSize: 100 }),
  });

  const { data: payouts } = useQuery({
    queryKey: ['admin-payouts', 'dashboard'],
    queryFn: () => apiClient.admin.listPayouts({ pageSize: 100 }),
  });

  const { data: refunds } = useQuery({
    queryKey: ['admin-refunds', 'dashboard'],
    queryFn: () => apiClient.admin.listRefunds({ pageSize: 100 }),
  });

  const totalBookings = bookings?.meta?.total ?? 0;
  const paidBookings = bookings?.bookings?.filter((booking: any) => booking.status === 'paid' || booking.status === 'confirmed').length ?? 0;
  const commissionEarned = bookings?.bookings?.reduce((sum: number, booking: any) => sum + (booking.commissionAmount ?? 0), 0) ?? 0;
  const pendingPayouts = payouts?.payouts?.filter((payout: any) => payout.status === 'pending').length ?? 0;
  const pendingRefunds = refunds?.refunds?.filter((refund: any) => refund.status === 'pending').length ?? 0;

  const actionCards = [
    {
      title: 'Access review',
      body: 'Invite new operators, assign provider access, and disable risky accounts.',
      to: '/admin/customers',
    },
    {
      title: 'Provider setup',
      body: 'Bring new partners online and keep commercial contact details current.',
      to: '/admin/providers',
    },
    {
      title: 'Charge governance',
      body: 'Adjust definitions and rule versions with a clear audit trail.',
      to: '/admin/charges',
    },
  ];

  return (
    <div className="domain-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Operations snapshot</span>
          <h1 className="page-title">Marketplace command center</h1>
          <p className="page-subtitle">
            Watch the live operating picture, then jump directly into the domain workspace that needs attention.
          </p>
        </div>
        <div className="hero-actions">
          <Link to="/admin/charges/simulate" className="ghost-link">Run a charge simulation</Link>
          <Link to="/admin/audit" className="ghost-link">Open the audit log</Link>
        </div>
      </section>

      <div className="dashboard-stat-grid">
        <StatCard label="Bookings" value={totalBookings} hint={`${paidBookings} revenue-carrying bookings in the current result set`} />
        <StatCard label="Commission earned" value={formatMoney(commissionEarned)} hint="Commission total across recent bookings" />
        <StatCard label="Pending payouts" value={pendingPayouts} hint="Batches waiting for review or approval" />
        <StatCard label="Pending refunds" value={pendingRefunds} hint="Refund requests that still need intervention" />
      </div>

      <div className="workspace-triptych" style={{ marginBottom: '1.5rem' }}>
        {actionCards.map((card) => (
          <Link key={card.title} to={card.to} className="feature-card">
            <strong>{card.title}</strong>
            <span>{card.body}</span>
          </Link>
        ))}
      </div>

      <div className="domain-grid">
        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Recent bookings</h2>
              <p className="section-copy">Keep an eye on booking references, service dates, and payment state.</p>
            </div>
          </div>
          <div className="table-container domain-table">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Service date</th>
                  <th>Total</th>
                  <th>Commission</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(bookings?.bookings ?? []).slice(0, 8).map((booking: any) => (
                  <tr key={booking.id}>
                    <td>
                      <div className="entity-cell">
                        <strong>{booking.reference}</strong>
                        <span>{booking.id.slice(-8)}</span>
                      </div>
                    </td>
                    <td>{formatDate(booking.serviceDate)}</td>
                    <td>{formatMoney(booking.totalAmount, booking.currencyCode)}</td>
                    <td>{formatMoney(booking.commissionAmount, booking.currencyCode)}</td>
                    <td>
                      <span className={`badge ${booking.status === 'confirmed' || booking.status === 'paid' ? 'badge-success' : booking.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                        {titleizeToken(booking.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {(bookings?.bookings ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-empty">No bookings available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="workspace-panel workspace-panel-sticky">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Queue watch</h2>
              <p className="section-copy">Prioritize the next operational decisions without opening every page.</p>
            </div>
          </div>

          <div className="list-stack">
            {(payouts?.payouts ?? []).slice(0, 4).map((payout: any) => (
              <div key={payout.id} className="list-card static">
                <strong>Payout {payout.id.slice(-8)}</strong>
                <span>{titleizeToken(payout.status)} / {formatMoney(payout.amount, payout.currencyCode)}</span>
              </div>
            ))}
            {(refunds?.refunds ?? []).slice(0, 4).map((refund: any) => (
              <div key={refund.id} className="list-card static">
                <strong>Refund {refund.id.slice(-8)}</strong>
                <span>{titleizeToken(refund.status)} / {formatMoney(refund.amount, refund.currencyCode)}</span>
              </div>
            ))}
            {!(payouts?.payouts?.length || refunds?.refunds?.length) && (
              <div className="empty-panel">No payout or refund activity to surface right now.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
