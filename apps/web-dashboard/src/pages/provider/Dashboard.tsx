import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';
import { useAuth } from '../../lib/auth-context.js';
import { Link } from 'react-router-dom';

function formatMoney(amount: number, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(amount / 100);
}

export function ProviderDashboard() {
  const { } = useAuth();

  const { data: payouts } = useQuery({
    queryKey: ['provider-payouts'],
    queryFn: () => apiClient.payouts.list(),
  });

  const pendingPayouts = (payouts?.payouts ?? []).filter((p: any) => p.status === 'pending' || p.status === 'scheduled');
  const totalEarned = (payouts?.payouts ?? []).filter((p: any) => p.status === 'succeeded').reduce((s: number, p: any) => s + p.amount, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Provider Dashboard</h1>
      </div>

      <div className="grid-3 mb-4">
        <div className="stat-card">
          <div className="stat-label">Pending Payouts</div>
          <div className="stat-value">{pendingPayouts.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Earned</div>
          <div className="stat-value">{formatMoney(totalEarned)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Your Status</div>
          <div className="stat-value" style={{ fontSize: '1rem', marginTop: '0.25rem' }}>
            <span className="badge badge-success">Active</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div className="section-title" style={{ margin: 0 }}>Recent Payouts</div>
          <Link to="/provider/payouts" style={{ fontSize: '0.875rem' }}>View all →</Link>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {(payouts?.payouts ?? []).slice(0, 5).map((p: any) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{formatMoney(p.amount, p.currencyCode)}</td>
                  <td><span className={`badge badge-${p.status === 'succeeded' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}`}>{p.status}</span></td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{p.tinggPaymentRef ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
