import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth-context.js';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, titleizeToken } from '../../lib/admin-utils.js';

type ProviderBooking = {
  id: string;
  reference: string;
  serviceDate: string;
  subtotalAmount: number;
  commissionAmount: number;
  totalAmount: number;
  currencyCode: string;
  guestCount: number;
  status: string;
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="dashboard-stat-card">
      <span className="dashboard-stat-label">{label}</span>
      <strong className="dashboard-stat-value">{value}</strong>
      <span className="dashboard-stat-hint">{hint}</span>
    </div>
  );
}

export function ProviderBookings() {
  const { user } = useAuth();
  const providerId = user?.providerId;
  const [status, setStatus] = useState('all');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['provider-bookings', providerId],
    queryFn: () => apiClient.providers.getBookings(providerId!, { pageSize: 100 }),
    enabled: Boolean(providerId),
  });

  const { data: chargeLines } = useQuery({
    queryKey: ['provider-booking-charge-lines', selectedBookingId],
    queryFn: () => apiClient.charges.getBookingChargeLines(selectedBookingId!),
    enabled: Boolean(selectedBookingId),
  });

  if (!providerId) {
    return <div className="empty-panel">No provider context is attached to this account.</div>;
  }

  const bookings = (data?.bookings ?? []) as ProviderBooking[];
  const filteredBookings = useMemo(() => (
    status === 'all' ? bookings : bookings.filter((booking: any) => booking.status === status)
  ), [bookings, status]);

  const confirmed = bookings.filter((booking: any) => booking.status === 'confirmed').length;
  const paid = bookings.filter((booking: any) => booking.status === 'paid').length;
  const cancelled = bookings.filter((booking: any) => booking.status === 'cancelled').length;
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) ?? null;

  return (
    <div className="domain-page">
      <div className="domain-page-header">
        <div>
          <span className="eyebrow">Provider bookings</span>
          <h1 className="page-title">Booking operations</h1>
          <p className="page-subtitle">
            Review fulfilment status, keep an eye on service dates, and inspect the charge breakdown tied to each booking.
          </p>
        </div>
        <div className="page-actions">
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="compact-select">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_payment">Pending payment</option>
            <option value="paid">Paid</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <StatCard label="Bookings" value={bookings.length} hint="All provider-visible bookings in the current result set" />
        <StatCard label="Paid" value={paid} hint="Bookings ready for service delivery or settlement progression" />
        <StatCard label="Confirmed" value={confirmed} hint="Confirmed service commitments still to be delivered" />
        <StatCard label="Cancelled" value={cancelled} hint="Cancelled bookings that may need follow-up or refunds" />
      </div>

      <div className="domain-grid">
        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Booking queue</h2>
              <p className="section-copy">Select a booking to inspect totals and applied charges.</p>
            </div>
          </div>

          <div className="table-container domain-table">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Service date</th>
                  <th>Guests</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((booking: any) => (
                  <tr key={booking.id} className={selectedBookingId === booking.id ? 'table-row-selected' : ''} onClick={() => setSelectedBookingId(booking.id)}>
                    <td>
                      <div className="entity-cell">
                        <strong>{booking.reference}</strong>
                        <span>{booking.id.slice(-8)}</span>
                      </div>
                    </td>
                    <td>{formatDate(booking.serviceDate)}</td>
                    <td>{booking.guestCount}</td>
                    <td>{formatMoney(booking.totalAmount, booking.currencyCode)}</td>
                    <td>
                      <span className={`badge ${booking.status === 'confirmed' || booking.status === 'paid' ? 'badge-success' : booking.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                        {titleizeToken(booking.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredBookings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-empty">No bookings match the selected filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="workspace-panel workspace-panel-sticky">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Booking detail</h2>
              <p className="section-copy">Amounts and computed charge lines for the selected booking.</p>
            </div>
          </div>

          {!selectedBooking ? (
            <div className="empty-panel">Select a booking to inspect it.</div>
          ) : (
            <>
              <div className="detail-grid" style={{ marginTop: 0 }}>
                <div className="detail-card">
                  <span className="detail-label">Reference</span>
                  <strong>{selectedBooking.reference}</strong>
                </div>
                <div className="detail-card">
                  <span className="detail-label">Service date</span>
                  <strong>{formatDate(selectedBooking.serviceDate)}</strong>
                </div>
                <div className="detail-card">
                  <span className="detail-label">Subtotal</span>
                  <strong>{formatMoney(selectedBooking.subtotalAmount, selectedBooking.currencyCode)}</strong>
                </div>
                <div className="detail-card">
                  <span className="detail-label">Commission</span>
                  <strong>{formatMoney(selectedBooking.commissionAmount, selectedBooking.currencyCode)}</strong>
                </div>
              </div>

              <div className="list-stack" style={{ marginTop: '1rem' }}>
                {(chargeLines ?? []).length === 0 && (
                  <div className="empty-panel">No charge lines have been recorded for this booking.</div>
                )}
                {(chargeLines ?? []).map((line: any) => (
                  <div key={line.id} className="list-card static">
                    <strong>{line.chargeCode}</strong>
                    <span>{formatMoney(line.chargeAmount, line.currencyCode)} / {titleizeToken(line.refundBehavior)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
