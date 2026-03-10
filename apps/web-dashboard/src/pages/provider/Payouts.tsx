import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth-context.js';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, getErrorMessage, titleizeToken } from '../../lib/admin-utils.js';

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="dashboard-stat-card">
      <span className="dashboard-stat-label">{label}</span>
      <strong className="dashboard-stat-value">{value}</strong>
      <span className="dashboard-stat-hint">{hint}</span>
    </div>
  );
}

export function ProviderPayouts() {
  const { user } = useAuth();
  const providerId = user?.providerId;
  const queryClient = useQueryClient();
  const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const enabled = Boolean(providerId);

  const { data: payouts } = useQuery({
    queryKey: ['provider-payouts', providerId],
    queryFn: () => apiClient.payouts.list({ pageSize: 100 }),
    enabled,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['provider-payout-accounts', providerId],
    queryFn: () => apiClient.providers.getPayoutAccounts(providerId!),
    enabled,
  });

  const { data: chargeLines } = useQuery({
    queryKey: ['provider-payout-charge-lines', selectedPayoutId],
    queryFn: () => apiClient.charges.getPayoutChargeLines(selectedPayoutId!),
    enabled: Boolean(selectedPayoutId),
  });

  const requestPayoutMutation = useMutation({
    mutationFn: async () => {
      if (!providerId) throw new Error('No provider context available.');
      return apiClient.payouts.runPayout(providerId, { idempotencyKey: crypto.randomUUID() });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider-payouts', providerId] });
      setMessage('Payout request submitted.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  if (!providerId) {
    return <div className="empty-panel">No provider context is attached to this account.</div>;
  }

  const payoutItems = payouts?.payouts ?? [];
  const pendingCount = payoutItems.filter((payout: any) => ['pending', 'processing', 'scheduled', 'on_hold'].includes(payout.status)).length;
  const settledValue = payoutItems.filter((payout: any) => payout.status === 'succeeded').reduce((sum: number, payout: any) => sum + payout.amount, 0);
  const heldCount = payoutItems.filter((payout: any) => payout.status === 'on_hold').length;
  const defaultAccount = accounts.find((account: any) => account.isDefault);
  const selectedPayout = payoutItems.find((payout: any) => payout.id === selectedPayoutId) ?? null;

  return (
    <div className="domain-page">
      <div className="domain-page-header">
        <div>
          <span className="eyebrow">Provider payouts</span>
          <h1 className="page-title">Payouts and settlement requests</h1>
          <p className="page-subtitle">
            Review prior disbursements, inspect deductions, and trigger a new payout request once you are ready to settle eligible bookings.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn-primary" onClick={() => void requestPayoutMutation.mutateAsync()} disabled={requestPayoutMutation.isPending || !defaultAccount}>
            {requestPayoutMutation.isPending ? 'Submitting...' : 'Request payout'}
          </button>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <StatCard label="Pending batches" value={pendingCount} hint="Payouts still moving through approval or processing" />
        <StatCard label="Settled value" value={formatMoney(settledValue, payoutItems[0]?.currencyCode ?? 'KES')} hint="Completed payout volume" />
        <StatCard label="On hold" value={heldCount} hint="Batches awaiting manual approval" />
        <StatCard label="Payout route" value={defaultAccount ? 'Ready' : 'Missing'} hint={defaultAccount ? `${defaultAccount.accountType.replace(/_/g, ' ')} ending ${defaultAccount.accountNumber.slice(-4)}` : 'Add a default payout account first'} />
      </div>

      {(message || errorMessage) && (
        <div className={errorMessage ? 'alert-error' : 'alert-success'} style={{ marginBottom: '1rem' }}>
          {errorMessage ?? message}
        </div>
      )}

      <div className="domain-grid">
        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Payout history</h2>
              <p className="section-copy">Select a payout to review processing details and deductions.</p>
            </div>
          </div>

          <div className="table-container domain-table">
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Processed</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {payoutItems.map((payout: any) => (
                  <tr
                    key={payout.id}
                    className={selectedPayoutId === payout.id ? 'table-row-selected' : ''}
                    onClick={() => setSelectedPayoutId(payout.id)}
                  >
                    <td>
                      <div className="entity-cell">
                        <strong>{payout.id.slice(-8)}</strong>
                        <span>{payout.payoutAccountId.slice(-8)}</span>
                      </div>
                    </td>
                    <td>{formatMoney(payout.amount, payout.currencyCode)}</td>
                    <td>
                      <span className={`badge ${payout.status === 'succeeded' ? 'badge-success' : payout.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                        {titleizeToken(payout.status)}
                      </span>
                    </td>
                    <td>{formatDate(payout.processedAt ?? payout.createdAt)}</td>
                    <td>{payout.tinggPaymentRef ?? 'Pending'}</td>
                  </tr>
                ))}
                {payoutItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-empty">No payouts have been created yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="workspace-panel workspace-panel-sticky">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Selected payout</h2>
              <p className="section-copy">Review deductions and operational context for the selected payout batch.</p>
            </div>
          </div>

          {!selectedPayout ? (
            <div className="empty-panel">Select a payout to inspect it.</div>
          ) : (
            <>
              <div className="detail-grid" style={{ marginTop: 0 }}>
                <div className="detail-card">
                  <span className="detail-label">Amount</span>
                  <strong>{formatMoney(selectedPayout.amount, selectedPayout.currencyCode)}</strong>
                </div>
                <div className="detail-card">
                  <span className="detail-label">Status</span>
                  <strong>{titleizeToken(selectedPayout.status)}</strong>
                </div>
                <div className="detail-card">
                  <span className="detail-label">Processed</span>
                  <strong>{formatDate(selectedPayout.processedAt ?? selectedPayout.createdAt)}</strong>
                </div>
                <div className="detail-card">
                  <span className="detail-label">Reference</span>
                  <strong>{selectedPayout.tinggPaymentRef ?? 'Pending dispatch'}</strong>
                </div>
              </div>

              <div className="list-stack" style={{ marginTop: '1rem' }}>
                {(chargeLines ?? []).map((line: any) => (
                  <div key={line.id} className="list-card static">
                    <strong>{line.description}</strong>
                    <span>{formatMoney(line.chargeAmount, line.currencyCode)} / {titleizeToken(line.scope)}</span>
                  </div>
                ))}
                {(chargeLines ?? []).length === 0 && <div className="empty-panel">No payout deductions were recorded for this batch.</div>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
