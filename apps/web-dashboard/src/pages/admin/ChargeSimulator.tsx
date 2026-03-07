import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

function formatMoney(amount: number, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(amount / 100);
}

export function AdminChargeSimulator() {
  const [form, setForm] = useState({
    scope: 'booking_level',
    timing: 'booking_confirm',
    jurisdictionCountry: 'KE',
    currencyCode: 'KES',
    bookingSubtotal: '100000',
    payoutAmount: '',
    paymentAmount: '',
    providerId: '',
    guestCount: '1',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const simulate = useMutation({
    mutationFn: () => apiClient.charges.simulate({
      scope: form.scope as any,
      timing: form.timing as any,
      jurisdictionCountry: form.jurisdictionCountry.toUpperCase(),
      currencyCode: form.currencyCode.toUpperCase(),
      bookingSubtotal: form.bookingSubtotal ? Number(form.bookingSubtotal) : undefined,
      payoutAmount: form.payoutAmount ? Number(form.payoutAmount) : undefined,
      paymentAmount: form.paymentAmount ? Number(form.paymentAmount) : undefined,
      providerId: form.providerId || undefined,
      guestCount: form.guestCount ? Number(form.guestCount) : undefined,
    }),
  });

  const result = simulate.data;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Charge Simulator</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Input form */}
        <div className="card">
          <div className="section-title">Simulation Input</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Scope</label>
              <select value={form.scope} onChange={set('scope')}>
                <option value="booking_level">Booking Level</option>
                <option value="booking_item_level">Booking Item Level</option>
                <option value="payment_level">Payment Level</option>
                <option value="payout_level">Payout Level</option>
                <option value="commission_level">Commission Level</option>
                <option value="refund_level">Refund Level</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Timing</label>
              <select value={form.timing} onChange={set('timing')}>
                <option value="booking_quote">Booking Quote</option>
                <option value="booking_confirm">Booking Confirm</option>
                <option value="payment_capture">Payment Capture</option>
                <option value="payout">Payout</option>
                <option value="refund">Refund</option>
              </select>
            </div>
            <div className="grid-2">
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Country</label>
                <input value={form.jurisdictionCountry} onChange={set('jurisdictionCountry')} maxLength={2} placeholder="KE" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Currency</label>
                <input value={form.currencyCode} onChange={set('currencyCode')} maxLength={3} placeholder="KES" />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Booking Subtotal (minor units)</label>
              <input type="number" value={form.bookingSubtotal} onChange={set('bookingSubtotal')} placeholder="e.g. 100000 = KES 1000" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Payout Amount (optional)</label>
              <input type="number" value={form.payoutAmount} onChange={set('payoutAmount')} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Provider ID (optional)</label>
              <input value={form.providerId} onChange={set('providerId')} placeholder="prov_…" />
            </div>
            <button
              className="btn-primary"
              onClick={() => simulate.mutate()}
              disabled={simulate.isPending}
              style={{ padding: '0.625rem', fontWeight: 600 }}
            >
              {simulate.isPending ? 'Simulating…' : 'Run Simulation'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div>
          {simulate.error && (
            <div className="alert-error" style={{ marginBottom: '1rem' }}>
              {String((simulate.error as any)?.message ?? simulate.error)}
            </div>
          )}

          {result && (
            <>
              {/* Customer breakdown */}
              <div className="card" style={{ marginBottom: '1rem' }}>
                <div className="section-title">Customer Breakdown</div>
                <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{formatMoney(result.breakdown.customer.subtotal, form.currencyCode)}</span></div>
                  {[...result.breakdown.customer.taxLines, ...result.breakdown.customer.levyLines, ...result.breakdown.customer.dutyLines, ...result.breakdown.customer.feeLines].map((l: any) => (
                    <div key={l.chargeCode} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-neutral-600)' }}>
                      <span>{l.chargeName} {l.rateBps ? `(${l.rateBps / 100}%)` : ''}</span>
                      <span>+{formatMoney(l.chargeAmount, form.currencyCode)}</span>
                    </div>
                  ))}
                  {result.breakdown.customer.discountLines.map((l: any) => (
                    <div key={l.chargeCode} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
                      <span>{l.chargeName}</span><span>−{formatMoney(l.chargeAmount, form.currencyCode)}</span>
                    </div>
                  ))}
                  <hr className="divider" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>Total</span><span>{formatMoney(result.breakdown.customer.total, form.currencyCode)}</span>
                  </div>
                </div>
              </div>

              {/* Provider breakdown */}
              <div className="card" style={{ marginBottom: '1rem' }}>
                <div className="section-title">Provider Settlement</div>
                <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gross Booking Value</span><span>{formatMoney(result.breakdown.provider.grossBookingValue, form.currencyCode)}</span></div>
                  {[...result.breakdown.provider.commissionLines, ...result.breakdown.provider.taxOnCommissionLines, ...result.breakdown.provider.withholdingLines, ...result.breakdown.provider.fxLines, ...result.breakdown.provider.feeLines].map((l: any) => (
                    <div key={l.chargeCode} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-danger)' }}>
                      <span>{l.chargeName}</span><span>−{formatMoney(l.chargeAmount, form.currencyCode)}</span>
                    </div>
                  ))}
                  <hr className="divider" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--color-success)' }}>
                    <span>Net Payable</span><span>{formatMoney(result.breakdown.provider.netPayable, form.currencyCode)}</span>
                  </div>
                </div>
              </div>

              {/* Applied rules */}
              {result.appliedRules.length > 0 && (
                <div className="card">
                  <div className="section-title">Applied Rules</div>
                  {result.appliedRules.map((r: any) => (
                    <div key={r.ruleId} style={{ fontSize: '0.8125rem', marginBottom: '0.5rem', padding: '0.5rem', background: 'var(--color-neutral-100)', borderRadius: 4 }}>
                      <span className="font-semibold">{r.chargeCode}</span>{' '}
                      <span className="text-muted">rule: {r.ruleId.slice(-8)} / set: {r.ruleSetId.slice(-8)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!result && !simulate.isPending && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-neutral-600)' }}>
              Enter values on the left and click<br />Run Simulation to see the charge breakdown.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
