
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'badge-neutral' },
  quoted: { label: 'Quoted', className: 'badge-neutral' },
  pending_payment: { label: 'Awaiting Payment', className: 'badge-warning' },
  payment_processing: { label: 'Processing', className: 'badge-warning' },
  paid: { label: 'Paid', className: 'badge-success' },
  confirmed: { label: 'Confirmed', className: 'badge-success' },
  partially_refunded: { label: 'Part Refunded', className: 'badge-info' },
  refunded: { label: 'Refunded', className: 'badge-info' },
  cancelled: { label: 'Cancelled', className: 'badge-danger' },
  failed: { label: 'Failed', className: 'badge-danger' },
  payout_pending: { label: 'Payout Pending', className: 'badge-warning' },
  payout_completed: { label: 'Payout Done', className: 'badge-success' },
};

export function BookingStatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, className: 'badge-neutral' };
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}
