import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, CalendarRange, TicketCheck, TicketX } from 'lucide-react';
import { BookingStatusBadge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@felix-travel/ui';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, titleizeToken } from '../../lib/admin-utils.js';
import {
  DataTable,
  DataTableEmpty,
  EntityCell,
  InfoCard,
  InfoGrid,
  PageHeader,
  PageShell,
  SectionCard,
  StatCard,
  StatGrid,
  Toolbar,
  WorkspaceGrid,
} from '../../components/workspace-ui.js';

export function AdminBookings() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-bookings', page, status],
    queryFn: () => apiClient.admin.listBookings({ page, pageSize: 25, ...(status !== 'all' ? { status } : {}) }),
  });

  const { data: chargeLines } = useQuery({
    queryKey: ['booking-charge-lines', selectedId],
    queryFn: () => apiClient.charges.getBookingChargeLines(selectedId!),
    enabled: Boolean(selectedId),
  });

  const bookings = (data?.bookings ?? []) as any[];
  const total = data?.meta?.total ?? bookings.length;
  const filtered = useMemo(() => status === 'all' ? bookings : bookings.filter((b: any) => b.status === status), [bookings, status]);
  const confirmed = bookings.filter((b: any) => b.status === 'confirmed' || b.status === 'paid').length;
  const pending = bookings.filter((b: any) => b.status === 'pending_payment').length;
  const cancelled = bookings.filter((b: any) => b.status === 'cancelled').length;
  const selected = bookings.find((b: any) => b.id === selectedId) ?? null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="Booking operations"
        description="Monitor booking throughput, exceptions, and charge detail across all providers and customers."
      />

      <StatGrid>
        <StatCard label="Total bookings" value={total} hint="All-time booking count in the working set" icon={BookOpenCheck} />
        <StatCard label="Active" value={confirmed} hint="Confirmed or paid bookings" icon={TicketCheck} tone="success" />
        <StatCard label="Pending payment" value={pending} hint="Awaiting customer payment" icon={CalendarRange} tone="warning" />
        <StatCard label="Cancelled" value={cancelled} hint="Cancelled or refunded" icon={TicketX} tone="info" />
      </StatGrid>

      <WorkspaceGrid
        main={
          <SectionCard title="All bookings" description="Click any row to inspect booking detail and attached charge lines.">
            <Toolbar>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_payment">Pending Payment</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </Toolbar>
            <DataTable headers={['Reference', 'Service date', 'Guests', 'Total', 'Commission', 'Status']}>
              {filtered.map((b: any) => (
                <tr key={b.id} className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40 ${selectedId === b.id ? 'bg-primary/5' : ''}`} onClick={() => setSelectedId(selectedId === b.id ? null : b.id)}>
                  <td className="p-4"><EntityCell title={b.reference} subtitle={b.id.slice(-8)} /></td>
                  <td className="p-4 text-sm text-muted-foreground">{formatDate(b.serviceDate)}</td>
                  <td className="p-4 text-sm text-muted-foreground">{b.guestCount}</td>
                  <td className="p-4 text-sm font-medium text-foreground">{formatMoney(b.totalAmount, b.currencyCode)}</td>
                  <td className="p-4 text-sm text-muted-foreground">{formatMoney(b.commissionAmount, b.currencyCode)}</td>
                  <td className="p-4"><BookingStatusBadge status={b.status} /></td>
                </tr>
              ))}
              {filtered.length === 0 && <DataTableEmpty colSpan={6} label={isLoading ? 'Loading bookings…' : 'No bookings match the current filter.'} />}
            </DataTable>
            {total > 25 && (
              <div className="flex items-center justify-end gap-3 border-t border-border/50 px-4 py-3">
                <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                <span className="text-sm text-muted-foreground">Page {page}</span>
                <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setPage((p) => p + 1)} disabled={bookings.length < 25}>Next</button>
              </div>
            )}
          </SectionCard>
        }
        side={
          selected ? (
            <div className="space-y-6">
              <SectionCard title="Booking detail" description={`Reference ${selected.reference}`}>
                <InfoGrid>
                  <InfoCard label="Status" value={<BookingStatusBadge status={selected.status} />} />
                  <InfoCard label="Service date" value={formatDate(selected.serviceDate)} />
                  <InfoCard label="Guests" value={selected.guestCount} />
                  <InfoCard label="Currency" value={selected.currencyCode} />
                  <InfoCard label="Subtotal" value={formatMoney(selected.subtotalAmount, selected.currencyCode)} />
                  <InfoCard label="Commission" value={formatMoney(selected.commissionAmount, selected.currencyCode)} />
                  <InfoCard label="Tax" value={formatMoney(selected.taxAmount, selected.currencyCode)} />
                  <InfoCard label="Total" value={formatMoney(selected.totalAmount, selected.currencyCode)} />
                  <InfoCard label="Customer" value={<span className="font-mono text-xs">{selected.customerId?.slice(-8)}</span>} />
                  <InfoCard label="Provider" value={<span className="font-mono text-xs">{selected.providerId}</span>} />
                  <InfoCard label="Listing" value={<span className="font-mono text-xs">{selected.listingId}</span>} />
                  <InfoCard label="Created" value={formatDate(selected.createdAt)} />
                  {selected.confirmedAt && <InfoCard label="Confirmed" value={formatDate(selected.confirmedAt)} />}
                  {selected.cancelledAt && <InfoCard label="Cancelled" value={formatDate(selected.cancelledAt)} />}
                  {selected.specialRequests && <InfoCard label="Special requests" value={selected.specialRequests} />}
                  {selected.cancellationReason && <InfoCard label="Cancel reason" value={selected.cancellationReason} />}
                </InfoGrid>
              </SectionCard>
              <SectionCard title="Charge lines" description="Fees and taxes computed for this booking.">
                {chargeLines && Array.isArray(chargeLines) && chargeLines.length > 0 ? (
                  <DataTable headers={['Charge', 'Type', 'Amount']}>
                    {chargeLines.map((cl: any, i: number) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="p-3 text-sm">{cl.label ?? cl.chargeDefinitionId}</td>
                        <td className="p-3 text-sm text-muted-foreground">{titleizeToken(cl.calculationType ?? cl.type ?? '—')}</td>
                        <td className="p-3 text-sm font-medium">{formatMoney(cl.amount, selected.currencyCode)}</td>
                      </tr>
                    ))}
                  </DataTable>
                ) : (
                  <div className="py-6 text-center text-sm text-muted-foreground">No charge lines attached.</div>
                )}
              </SectionCard>
            </div>
          ) : (
            <SectionCard title="Detail" description="Select a booking to inspect its detail and charge lines.">
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <BookOpenCheck className="mr-2 h-5 w-5 opacity-40" /> Click a row to view detail
              </div>
            </SectionCard>
          )
        }
      />
    </PageShell>
  );
}
