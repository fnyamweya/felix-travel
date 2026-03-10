import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth-context.js';
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

export function ProviderDashboard() {
  const { user } = useAuth();
  const providerId = user?.providerId;

  const enabled = Boolean(providerId);

  const { data: provider } = useQuery({
    queryKey: ['provider-profile', providerId],
    queryFn: () => apiClient.providers.get(providerId!),
    enabled,
  });

  const { data: settings } = useQuery({
    queryKey: ['provider-settings', providerId],
    queryFn: () => apiClient.providers.getSettings(providerId!),
    enabled,
  });

  const { data: bookingsData } = useQuery({
    queryKey: ['provider-bookings', providerId],
    queryFn: () => apiClient.providers.getBookings(providerId!, { pageSize: 100 }),
    enabled,
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['provider-listings', providerId],
    queryFn: () => apiClient.providers.getListings(providerId!),
    enabled,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['provider-payout-accounts', providerId],
    queryFn: () => apiClient.providers.getPayoutAccounts(providerId!),
    enabled,
  });

  const { data: payouts } = useQuery({
    queryKey: ['provider-payouts', providerId],
    queryFn: () => apiClient.payouts.list({ pageSize: 100 }),
    enabled,
  });

  if (!providerId) {
    return <div className="empty-panel">No provider context is attached to this account.</div>;
  }

  const bookings = bookingsData?.bookings ?? [];
  const payoutItems = payouts?.payouts ?? [];
  const activeListings = (listings as any[]).filter((listing) => listing.status === 'active').length;
  const draftListings = (listings as any[]).filter((listing) => listing.status === 'draft' || listing.status === 'pending_review').length;
  const upcomingBookings = bookings.filter((booking: any) => booking.status === 'confirmed' || booking.status === 'paid').length;
  const grossBooked = bookings.reduce((sum: number, booking: any) => sum + (booking.totalAmount ?? 0), 0);
  const pendingPayoutValue = payoutItems
    .filter((payout: any) => ['pending', 'scheduled', 'processing', 'on_hold'].includes(payout.status))
    .reduce((sum: number, payout: any) => sum + payout.amount, 0);
  const settledValue = payoutItems
    .filter((payout: any) => payout.status === 'succeeded')
    .reduce((sum: number, payout: any) => sum + payout.amount, 0);
  const defaultAccount = accounts.find((account: any) => account.isDefault);
  const settingsSummary = settings as {
    settlementDelayDays?: number | null;
    commissionBps?: number;
    autoApprovePayout?: boolean;
  } | null;

  const featureCards = [
    {
      title: 'Manage listings',
      body: 'Create new inventory, adjust pricing, and publish ready-to-sell experiences.',
      to: '/provider/listings',
    },
    {
      title: 'Request payout',
      body: 'Review payout readiness and trigger the next settlement batch when bookings are eligible.',
      to: '/provider/payouts',
    },
    {
      title: 'Generate statement',
      body: 'Export booking and payout activity into a clean settlement statement for finance review.',
      to: '/provider/settlement',
    },
  ];

  return (
    <div className="domain-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Provider workspace</span>
          <h1 className="page-title">{provider?.name ?? 'Provider portal'}</h1>
          <p className="page-subtitle">
            Track operational performance, stay ahead of settlement readiness, and keep your inventory and payout setup current from one place.
          </p>
        </div>
        <div className="hero-actions">
          <Link to="/provider/listings" className="ghost-link">Open listings</Link>
          <Link to="/provider/accounts" className="ghost-link">Manage accounts</Link>
        </div>
      </section>

      <div className="dashboard-stat-grid">
        <StatCard label="Gross booked" value={formatMoney(grossBooked, provider?.currencyCode ?? 'KES')} hint={`${bookings.length} bookings in the current working set`} />
        <StatCard label="Upcoming services" value={upcomingBookings} hint="Paid or confirmed bookings awaiting fulfilment" />
        <StatCard label="Pending settlement" value={formatMoney(pendingPayoutValue, provider?.currencyCode ?? 'KES')} hint="Payouts not yet completed" />
        <StatCard label="Settled" value={formatMoney(settledValue, provider?.currencyCode ?? 'KES')} hint="Payouts already processed successfully" />
      </div>

      <div className="workspace-triptych" style={{ marginBottom: '1.5rem' }}>
        {featureCards.map((card) => (
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
              <h2 className="section-title">Operational pulse</h2>
              <p className="section-copy">Recent bookings, listing health, and provider-side readiness at a glance.</p>
            </div>
          </div>

          <div className="detail-grid" style={{ marginTop: 0, marginBottom: '1rem' }}>
            <div className="detail-card">
              <span className="detail-label">Listing status</span>
              <strong>{activeListings} active / {draftListings} awaiting work</strong>
            </div>
            <div className="detail-card">
              <span className="detail-label">Default payout account</span>
              <strong>{defaultAccount ? `${defaultAccount.accountType.replace(/_/g, ' ')} ending ${defaultAccount.accountNumber.slice(-4)}` : 'Not configured'}</strong>
            </div>
            <div className="detail-card">
              <span className="detail-label">Settlement delay</span>
              <strong>{settingsSummary?.settlementDelayDays ?? 0} days</strong>
            </div>
            <div className="detail-card">
              <span className="detail-label">Commission setting</span>
              <strong>{((settingsSummary?.commissionBps ?? 0) / 100).toFixed(2)}%</strong>
            </div>
          </div>

          <div className="table-container domain-table">
            <table>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Service date</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 8).map((booking: any) => (
                  <tr key={booking.id}>
                    <td>
                      <div className="entity-cell">
                        <strong>{booking.reference}</strong>
                        <span>{booking.id.slice(-8)}</span>
                      </div>
                    </td>
                    <td>{formatDate(booking.serviceDate)}</td>
                    <td>{formatMoney(booking.totalAmount, booking.currencyCode)}</td>
                    <td>
                      <span className={`badge ${booking.status === 'confirmed' || booking.status === 'paid' ? 'badge-success' : booking.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                        {titleizeToken(booking.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="table-empty">No bookings found for this provider yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="workspace-panel workspace-panel-sticky">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Readiness</h2>
              <p className="section-copy">The next things that need attention before bookings and settlements flow cleanly.</p>
            </div>
          </div>

          <div className="list-stack">
            <div className="list-card static">
              <strong>Provider status</strong>
              <span>{provider?.isActive ? 'Live and available for operations' : 'Inactive'} / {provider?.isVerified ? 'Verified' : 'Pending verification'}</span>
            </div>
            <div className="list-card static">
              <strong>Payout setup</strong>
              <span>{defaultAccount ? 'Default payout route configured' : 'Add a default payout account to enable settlement requests'}</span>
            </div>
            <div className="list-card static">
              <strong>Payout policy</strong>
              <span>{settingsSummary?.autoApprovePayout ? 'Auto-approval enabled where thresholds allow' : 'Manual approval still required for payout batches'}</span>
            </div>
            <div className="list-card static">
              <strong>Listings</strong>
              <span>{activeListings > 0 ? `${activeListings} live experiences visible to customers` : 'No active listings are live yet'}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
