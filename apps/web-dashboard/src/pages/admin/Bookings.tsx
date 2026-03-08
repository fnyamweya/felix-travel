import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

function formatMoney(amount: number, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(amount / 100);
}

export function AdminBookings() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-bookings', page, status],
    queryFn: () => apiClient.admin.listBookings({ page, pageSize: 25, ...(status ? { status } : {}) }),
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Bookings</h1>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 200 }}>
            <option value="">All statuses</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="paid">Paid</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        {isLoading ? <div>Loading…</div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Provider</th>
                  <th>Service Date</th>
                  <th>Guests</th>
                  <th>Total</th>
                  <th>Commission</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.bookings ?? []).map((b: any) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8rem' }}>{b.reference}</td>
                    <td>{b.customerId}</td>
                    <td>{b.providerId}</td>
                    <td>{b.serviceDate}</td>
                    <td>{b.guestCount}</td>
                    <td>{formatMoney(b.totalAmount, b.currencyCode)}</td>
                    <td>{formatMoney(b.commissionAmount, b.currencyCode)}</td>
                    <td><span className={`badge badge-${b.status === 'paid' || b.status === 'confirmed' ? 'success' : b.status === 'cancelled' || b.status === 'failed' ? 'danger' : 'warning'}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(data?.meta?.total ?? 0) > 25 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn-secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
            <span style={{ padding: '0.5rem', fontSize: '0.875rem' }}>Page {page}</span>
            <button className="btn-secondary" onClick={() => setPage(p => p + 1)} disabled={(data?.bookings?.length ?? 0) < 25}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
