import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

function formatMoney(amount: number, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(amount / 100);
}

export function ProviderSettlement() {
  const { data: payouts } = useQuery({
    queryKey: ['provider-payouts-settlement'],
    queryFn: () => apiClient.payouts.list(),
  });

  const items = payouts?.payouts ?? [];
  const succeeded = items.filter((p: any) => p.status === 'succeeded');
  const totalGross = succeeded.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
  const currency = succeeded[0]?.currencyCode ?? 'KES';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settlement Statement</h1>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        <div className="section-title">Settlement Summary</div>

        <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total Payouts (succeeded)</span>
            <strong>{succeeded.length}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total Amount Received</span>
            <strong>{formatMoney(totalGross, currency)}</strong>
          </div>
        </div>

        <hr className="divider" />

        <div className="section-title">Your Deduction Schedule</div>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>
          <p style={{ marginBottom: '0.5rem' }}>The following charges are deducted from your payouts per our service agreement:</p>
          <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
            <li>Platform Commission — 10% of gross booking value</li>
            <li>VAT on Commission — 16% of commission amount</li>
            <li>Withholding Tax — 5% of gross payout (KE)</li>
            <li>Payout Fee — KES 50 per disbursement</li>
          </ul>
        </div>

        <hr className="divider" />

        <p style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-600)' }}>
          For a detailed payout-by-payout breakdown including all applied charges, see the Payouts page.
        </p>
      </div>
    </div>
  );
}
