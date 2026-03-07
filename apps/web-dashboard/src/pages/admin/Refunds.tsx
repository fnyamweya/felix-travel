import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

function formatMoney(amount: number, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(amount / 100);
}

export function AdminRefunds() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending_approval');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-refunds', status],
    queryFn: () => apiClient.admin.listRefunds({ status: status || undefined }),
  });

  const approveMutation = useMutation({
    mutationFn: (refundId: string) => apiClient.payments.approveRefund(refundId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-refunds'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ refundId, reason }: { refundId: string; reason: string }) =>
      apiClient.payments.rejectRefund(refundId, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-refunds'] }),
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Refunds</h1>
      </div>

      <div className="card">
        <div style={{ marginBottom: '1rem' }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 200 }}>
            <option value="">All</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="succeeded">Succeeded</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {isLoading ? <div>Loading…</div> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Reason</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? data ?? []).map((r: any) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.bookingId?.slice(-8)}</td>
                    <td>{r.reason}</td>
                    <td>{formatMoney(r.amount, r.currencyCode)}</td>
                    <td><span className={`badge badge-${r.status === 'succeeded' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}`}>{r.status}</span></td>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td>
                      {r.status === 'pending_approval' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                            onClick={() => approveMutation.mutate(r.id)}>
                            Approve
                          </button>
                          <button className="btn-danger" style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                            onClick={() => { const reason = prompt('Rejection reason?'); if (reason) rejectMutation.mutate({ refundId: r.id, reason }); }}>
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
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
