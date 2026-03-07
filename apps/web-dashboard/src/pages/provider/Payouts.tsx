import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

function formatMoney(amount: number, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(amount / 100);
}

export function ProviderPayouts() {
  const [selectedPayout, setSelectedPayout] = useState<string | null>(null);

  const { data: payouts } = useQuery({
    queryKey: ['provider-payouts'],
    queryFn: () => apiClient.payouts.list(),
  });

  const { data: chargeLines } = useQuery({
    queryKey: ['payout-charges', selectedPayout],
    queryFn: () => apiClient.charges.getPayoutChargeLines(selectedPayout!),
    enabled: !!selectedPayout,
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
      <div className="card">
        <div className="page-header" style={{ marginBottom: '1rem' }}>
          <h1 className="page-title" style={{ margin: 0 }}>Payout History</h1>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {((payouts?.items ?? payouts) ?? []).map((p: any) => (
                <tr key={p.id} style={{ background: selectedPayout === p.id ? 'var(--color-neutral-100)' : undefined }}>
                  <td style={{ fontWeight: 600 }}>{formatMoney(p.amount, p.currencyCode)}</td>
                  <td><span className={`badge badge-${p.status === 'succeeded' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}`}>{p.status}</span></td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      onClick={() => setSelectedPayout(p.id)}>
                      View Charges
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPayout && (
        <div className="card" style={{ position: 'sticky', top: '1rem' }}>
          <div className="section-title">Payout Deductions</div>
          {!chargeLines ? <div>Loading…</div> : (
            <div style={{ fontSize: '0.875rem' }}>
              {(chargeLines ?? []).length === 0 ? (
                <p className="text-muted">No charge deductions for this payout.</p>
              ) : (
                (chargeLines ?? []).map((line: any) => (
                  <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-neutral-200)' }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{line.description}</div>
                      <div className="text-xs text-muted">{line.scope}</div>
                    </div>
                    <div style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                      −{formatMoney(line.chargeAmount, line.currencyCode)}
                    </div>
                  </div>
                ))
              )}
              {(chargeLines ?? []).length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: '0.5rem' }}>
                  <span>Total Deducted</span>
                  <span style={{ color: 'var(--color-danger)' }}>
                    −{formatMoney((chargeLines ?? []).reduce((s: number, l: any) => s + l.chargeAmount, 0), chargeLines?.[0]?.currencyCode)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
