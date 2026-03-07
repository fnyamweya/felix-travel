import React from 'react';

interface ChargeLine {
  chargeCode: string;
  chargeName: string;
  category: string;
  chargeAmount: number;
  currencyCode: string;
  isInclusive: boolean;
  payer: string;
}

interface CustomerBreakdown {
  subtotal: number;
  taxLines: ChargeLine[];
  dutyLines: ChargeLine[];
  levyLines: ChargeLine[];
  feeLines: ChargeLine[];
  surchargeLines: ChargeLine[];
  discountLines: ChargeLine[];
  discountTotal: number;
  chargesTotal: number;
  total: number;
  currencyCode: string;
}

interface Props {
  customer: CustomerBreakdown;
  showTitle?: boolean;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount / 100);
}

function LineRow({ label, amount, currency, muted = false, bold = false, danger = false }: {
  label: string; amount: number; currency: string; muted?: boolean; bold?: boolean; danger?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.875rem', color: muted ? '#5e6c84' : 'inherit', fontWeight: bold ? 600 : 'normal' }}>
      <span>{label}</span>
      <span style={{ color: danger ? '#de350b' : undefined }}>{danger ? `− ${formatMoney(Math.abs(amount), currency)}` : formatMoney(amount, currency)}</span>
    </div>
  );
}

export function ChargeBreakdown({ customer, showTitle = true }: Props) {
  const allChargeLines = [
    ...customer.taxLines,
    ...customer.dutyLines,
    ...customer.levyLines,
    ...customer.feeLines.filter(l => l.payer === 'customer'),
    ...customer.surchargeLines,
  ];

  return (
    <div className="card" style={{ fontSize: '0.875rem' }}>
      {showTitle && <div className="section-title">Price Breakdown</div>}

      <LineRow label="Subtotal" amount={customer.subtotal} currency={customer.currencyCode} />

      {allChargeLines.map((line) => (
        <LineRow
          key={line.chargeCode}
          label={line.chargeName + (line.isInclusive ? ' (incl.)' : '')}
          amount={line.chargeAmount}
          currency={customer.currencyCode}
          muted={line.isInclusive}
        />
      ))}

      {customer.discountLines.map((line) => (
        <LineRow
          key={line.chargeCode}
          label={line.chargeName}
          amount={line.chargeAmount}
          currency={customer.currencyCode}
          danger
        />
      ))}

      <hr className="divider" />
      <LineRow label="Total" amount={customer.total} currency={customer.currencyCode} bold />
    </div>
  );
}
