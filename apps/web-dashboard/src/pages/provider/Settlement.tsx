import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth-context.js';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, titleizeToken } from '../../lib/admin-utils.js';

type StatementBooking = {
  id: string;
  reference: string;
  serviceDate: string;
  status: string;
  totalAmount: number;
  commissionAmount: number;
  currencyCode: string;
};

type StatementPayout = {
  id: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
  amount: number;
  currencyCode: string;
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

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ProviderSettlement() {
  const { user } = useAuth();
  const providerId = user?.providerId;
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const enabled = Boolean(providerId);

  const { data: bookingsData } = useQuery({
    queryKey: ['provider-bookings', providerId, 'statement'],
    queryFn: () => apiClient.providers.getBookings(providerId!, { pageSize: 200 }),
    enabled,
  });

  const { data: payoutsData } = useQuery({
    queryKey: ['provider-payouts', providerId, 'statement'],
    queryFn: () => apiClient.payouts.list({ pageSize: 200 }),
    enabled,
  });

  if (!providerId) {
    return <div className="empty-panel">No provider context is attached to this account.</div>;
  }

  const bookings = (bookingsData?.bookings ?? []) as StatementBooking[];
  const payouts = (payoutsData?.payouts ?? []) as StatementPayout[];

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking: any) => {
      const date = booking.serviceDate;
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });
  }, [bookings, fromDate, toDate]);

  const filteredPayouts = useMemo(() => {
    return payouts.filter((payout: any) => {
      const date = (payout.processedAt ?? payout.createdAt)?.slice(0, 10);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });
  }, [payouts, fromDate, toDate]);

  const grossBookings = filteredBookings.reduce((sum: number, booking: any) => sum + (booking.totalAmount ?? 0), 0);
  const commission = filteredBookings.reduce((sum: number, booking: any) => sum + (booking.commissionAmount ?? 0), 0);
  const netBeforePayout = filteredBookings.reduce((sum: number, booking: any) => sum + ((booking.totalAmount ?? 0) - (booking.commissionAmount ?? 0)), 0);
  const settled = filteredPayouts.filter((payout: any) => payout.status === 'succeeded').reduce((sum: number, payout: any) => sum + payout.amount, 0);

  return (
    <div className="domain-page">
      <div className="domain-page-header">
        <div>
          <span className="eyebrow">Provider statements</span>
          <h1 className="page-title">Settlement statements</h1>
          <p className="page-subtitle">
            Generate a clean statement view for the selected period and export the underlying activity for finance or reconciliation workflows.
          </p>
        </div>
        <div className="page-actions">
          <input value={fromDate} type="date" onChange={(event) => setFromDate(event.target.value)} />
          <input value={toDate} type="date" onChange={(event) => setToDate(event.target.value)} />
          <button
            className="btn-secondary"
            onClick={() => downloadCsv('provider-settlement-bookings.csv', [
              ['Reference', 'Service Date', 'Status', 'Total', 'Commission', 'Currency'],
              ...filteredBookings.map((booking: any) => [
                booking.reference,
                booking.serviceDate,
                booking.status,
                booking.totalAmount,
                booking.commissionAmount,
                booking.currencyCode,
              ]),
            ])}
          >
            Export bookings CSV
          </button>
          <button
            className="btn-primary"
            onClick={() => downloadCsv('provider-settlement-payouts.csv', [
              ['Payout ID', 'Status', 'Created', 'Processed', 'Amount', 'Currency'],
              ...filteredPayouts.map((payout: any) => [
                payout.id,
                payout.status,
                payout.createdAt,
                payout.processedAt ?? '',
                payout.amount,
                payout.currencyCode,
              ]),
            ])}
          >
            Export payouts CSV
          </button>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <StatCard label="Gross bookings" value={formatMoney(grossBookings, filteredBookings[0]?.currencyCode ?? 'KES')} hint={`${filteredBookings.length} bookings in scope`} />
        <StatCard label="Commission" value={formatMoney(commission, filteredBookings[0]?.currencyCode ?? 'KES')} hint="Platform commission across the filtered period" />
        <StatCard label="Net before payout" value={formatMoney(netBeforePayout, filteredBookings[0]?.currencyCode ?? 'KES')} hint="Booking-side value before payout batching" />
        <StatCard label="Settled" value={formatMoney(settled, filteredPayouts[0]?.currencyCode ?? 'KES')} hint="Completed payouts in the selected period" />
      </div>

      <div className="domain-grid">
        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Statement source bookings</h2>
              <p className="section-copy">The booking ledger that drives the commercial side of the statement.</p>
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
                {filteredBookings.map((booking: any) => (
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
                {filteredBookings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-empty">No bookings found for the selected period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="workspace-panel workspace-panel-sticky">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Statement source payouts</h2>
              <p className="section-copy">Disbursement-side activity that completes the settlement picture.</p>
            </div>
          </div>
          <div className="list-stack">
            {filteredPayouts.map((payout: any) => (
              <div key={payout.id} className="list-card static">
                <strong>{payout.id.slice(-8)} / {formatMoney(payout.amount, payout.currencyCode)}</strong>
                <span>{titleizeToken(payout.status)} / processed {formatDate(payout.processedAt ?? payout.createdAt)}</span>
              </div>
            ))}
            {filteredPayouts.length === 0 && <div className="empty-panel">No payouts found for the selected period.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
