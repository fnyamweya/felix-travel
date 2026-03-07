import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

function formatMoney(amount: number, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount / 100);
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--color-neutral-600)', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  );
}

export function AdminDashboard() {
  const { data: bookings } = useQuery({ queryKey: ['admin-bookings'], queryFn: () => apiClient.admin.listBookings({ limit: 100 }) });
  const { data: payouts } = useQuery({ queryKey: ['admin-payouts'], queryFn: () => apiClient.admin.listPayouts({ limit: 100 }) });

  const totalBookings = bookings?.total ?? 0;
  const totalRevenue = bookings?.items?.reduce((s: number, b: any) => s + (b.commissionAmount ?? 0), 0) ?? 0;
  const pendingPayouts = payouts?.items?.filter((p: any) => p.status === 'pending').length ?? 0;
  const totalPaidOut = payouts?.items?.filter((p: any) => p.status === 'succeeded').reduce((s: number, p: any) => s + p.amount, 0) ?? 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>Last updated: now</span>
      </div>

      <div className="grid-4 mb-4">
        <StatCard label="Total Bookings" value={totalBookings} />
        <StatCard label="Commission Earned" value={formatMoney(totalRevenue)} />
        <StatCard label="Pending Payouts" value={pendingPayouts} />
        <StatCard label="Total Paid Out" value={formatMoney(totalPaidOut)} />
      </div>

      <div className="card">
        <div className="section-title">Recent Bookings</div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(bookings?.items ?? []).slice(0, 10).map((b: any) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600 }}>{b.reference}</td>
                  <td>{b.customerId}</td>
                  <td>{b.serviceDate}</td>
                  <td>{formatMoney(b.totalAmount, b.currencyCode)}</td>
                  <td><span className={`badge badge-${b.status === 'paid' || b.status === 'confirmed' ? 'success' : b.status === 'cancelled' ? 'danger' : 'warning'}`}>{b.status}</span></td>
                </tr>
              ))}
              {(bookings?.items ?? []).length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-neutral-600)', padding: '2rem' }}>No bookings yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
