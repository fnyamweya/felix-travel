import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

function formatMoney(amount: number, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(amount / 100);
}

export function AdminPayouts() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payouts', status],
    queryFn: () => apiClient.admin.listPayouts(status ? { status } : {}),
  });

  const runMutation = useMutation({
    mutationFn: () => apiClient.payouts.runPayout('all', { idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-payouts'] }),
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Payouts</h1>
        <button className="btn-primary" onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
          {runMutation.isPending ? 'Running…' : 'Run Payout Batch'}
        </button>
      </div>

      <div className="card">
        <div style={{ marginBottom: '1rem' }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 200 }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {isLoading ? <div>Loading…</div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Amount</th>
                  <th>Currency</th>
                  <th>Status</th>
                  <th>Tingg Ref</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {(data?.payouts ?? []).map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.providerId}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(p.amount, p.currencyCode)}</td>
                    <td>{p.currencyCode}</td>
                    <td><span className={`badge badge-${p.status === 'succeeded' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}`}>{p.status}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{p.tinggPaymentRef ?? '—'}</td>
                    <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
