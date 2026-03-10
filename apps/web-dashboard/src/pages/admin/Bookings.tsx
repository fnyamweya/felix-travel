import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, CalendarRange, Check, Clock, TicketCheck, TicketX } from 'lucide-react';
import { Badge, BookingStatusBadge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from '@felix-travel/ui';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, getErrorMessage, titleizeToken } from '../../lib/admin-utils.js';
import {
  DataTable,
  DataTableEmpty,
  EntityCell,
  InfoCard,
  InfoGrid,
  Notice,
  PageHeader,
  PageShell,
  SectionCard,
  StatCard,
  StatGrid,
  Toolbar,
  WorkspaceGrid,
} from '../../components/workspace-ui.js';

const CONFIRMABLE = ['paid', 'provider_accepted', 'provider_on_hold'];

export function AdminBookings() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState('detail');
  const [overrideForm, setOverrideForm] = useState({ chargeDefinitionId: '', reason: '', overrideAmount: '', isWaived: false });
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-bookings', page, status],
    queryFn: () => apiClient.admin.listBookings({ page, pageSize: 25, ...(status !== 'all' ? { status } : {}) }),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-booking-detail', selectedId],
    queryFn: () => apiClient.admin.getBookingDetail(selectedId!),
    enabled: Boolean(selectedId),
  });

  const { data: chargeLines } = useQuery({
    queryKey: ['booking-charge-lines', selectedId],
    queryFn: () => apiClient.charges.getBookingChargeLines(selectedId!),
    enabled: Boolean(selectedId),
  });

  const bookings = (data?.bookings ?? []) as any[];
  const total = data?.meta?.total ?? bookings.length;
  const filtered = useMemo(() => status === 'all' ? bookings : bookings.filter((b: any) => b.status === status), [bookings, status]);
  const confirmed = bookings.filter((b: any) => ['confirmed', 'paid', 'provider_accepted'].includes(b.status)).length;
  const pending = bookings.filter((b: any) => ['pending_payment', 'provider_on_hold'].includes(b.status)).length;
  const cancelled = bookings.filter((b: any) => b.status === 'cancelled' || b.status === 'provider_rejected').length;
  const selected = bookings.find((b: any) => b.id === selectedId) ?? null;
  const canConfirm = selected && CONFIRMABLE.includes(selected.status);

  const history = (detail as any)?.history ?? [];
  const overrides = (detail as any)?.overrides ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
    queryClient.invalidateQueries({ queryKey: ['admin-booking-detail', selectedId] });
    setActionError(null);
  };

  const confirmMutation = useMutation({
    mutationFn: () => apiClient.admin.adminConfirmBooking(selectedId!),
    onSuccess: invalidate,
    onError: (e) => setActionError(getErrorMessage(e)),
  });

  const createOverrideMutation = useMutation({
    mutationFn: () => apiClient.admin.createChargeOverride(selectedId!, {
      chargeDefinitionId: overrideForm.chargeDefinitionId,
      reason: overrideForm.reason,
      ...(overrideForm.overrideAmount ? { overrideAmount: parseInt(overrideForm.overrideAmount, 10) } : { isWaived: true }),
    }),
    onSuccess: () => {
      invalidate();
      setOverrideForm({ chargeDefinitionId: '', reason: '', overrideAmount: '', isWaived: false });
    },
    onError: (e) => setActionError(getErrorMessage(e)),
  });

  const approveOverrideMutation = useMutation({
    mutationFn: (overrideId: string) => apiClient.admin.approveChargeOverride(selectedId!, overrideId),
    onSuccess: invalidate,
    onError: (e) => setActionError(getErrorMessage(e)),
  });

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
                  <SelectItem value="provider_on_hold">Provider On Hold</SelectItem>
                  <SelectItem value="provider_accepted">Provider Accepted</SelectItem>
                  <SelectItem value="provider_rejected">Provider Rejected</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="payout_pending">Payout Pending</SelectItem>
                  <SelectItem value="payout_completed">Payout Completed</SelectItem>
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
            <div className="space-y-4">
              {actionError && <Notice message={actionError} variant="destructive" />}

              <Tabs value={sideTab} onValueChange={(v: string) => setSideTab(v as any)}>
                <TabsList className="w-full">
                  <TabsTrigger value="detail" className="flex-1">Detail</TabsTrigger>
                  <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
                  <TabsTrigger value="overrides" className="flex-1">Overrides</TabsTrigger>
                </TabsList>

                {/* ── Detail tab ── */}
                <TabsContent value="detail">
                  <div className="space-y-6 pt-4">
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

                    {canConfirm && (
                      <SectionCard title="Admin actions" description="Force-confirm this booking.">
                        <Button
                          className="w-full"
                          disabled={confirmMutation.isPending}
                          onClick={() => confirmMutation.mutate()}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          {confirmMutation.isPending ? 'Confirming…' : 'Force Confirm Booking'}
                        </Button>
                      </SectionCard>
                    )}

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
                </TabsContent>

                {/* ── History tab ── */}
                <TabsContent value="history">
                  <div className="pt-4">
                    <SectionCard title="Status history" description="Transitions for this booking.">
                      {history.length > 0 ? (
                        <div className="space-y-3">
                          {history.map((h: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 rounded-md border border-border/60 p-3">
                              <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 text-sm">
                                  <Badge variant="secondary">{titleizeToken(h.fromStatus ?? 'new')}</Badge>
                                  <span className="text-muted-foreground">→</span>
                                  <Badge>{titleizeToken(h.toStatus)}</Badge>
                                </div>
                                {h.reason && <p className="text-xs text-muted-foreground">{h.reason}</p>}
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(h.createdAt)}
                                  {h.changedBy && <> · <span className="font-mono">{h.changedBy.slice(-8)}</span></>}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          {detailLoading ? 'Loading…' : 'No status history recorded.'}
                        </div>
                      )}
                    </SectionCard>
                  </div>
                </TabsContent>

                {/* ── Overrides tab ── */}
                <TabsContent value="overrides">
                  <div className="space-y-6 pt-4">
                    <SectionCard title="Charge overrides" description="Per-booking charge adjustments.">
                      {overrides.length > 0 ? (
                        <DataTable headers={['Charge', 'Override', 'Status', '']}>
                          {overrides.map((o: any) => (
                            <tr key={o.id} className="border-b border-border/60">
                              <td className="p-3 text-sm font-mono text-xs">{o.chargeDefinitionId.slice(-8)}</td>
                              <td className="p-3 text-sm">
                                {o.isWaived ? (
                                  <Badge variant="secondary">Waived</Badge>
                                ) : o.overrideAmount != null ? (
                                  formatMoney(o.overrideAmount, selected.currencyCode)
                                ) : o.overrideRateBps != null ? (
                                  `${(o.overrideRateBps / 100).toFixed(2)}%`
                                ) : '—'}
                              </td>
                              <td className="p-3 text-sm">
                                <Badge variant={o.status === 'approved' ? 'default' : o.status === 'rejected' ? 'destructive' : 'secondary'}>
                                  {titleizeToken(o.status)}
                                </Badge>
                              </td>
                              <td className="p-3 text-sm">
                                {o.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={approveOverrideMutation.isPending}
                                    onClick={() => approveOverrideMutation.mutate(o.id)}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </DataTable>
                      ) : (
                        <div className="py-4 text-center text-sm text-muted-foreground">No overrides yet.</div>
                      )}
                    </SectionCard>

                    <SectionCard title="New override" description="Create a charge override for this booking.">
                      <div className="space-y-3">
                        <Input
                          placeholder="Charge definition ID"
                          value={overrideForm.chargeDefinitionId}
                          onChange={(e) => setOverrideForm((f) => ({ ...f, chargeDefinitionId: e.target.value }))}
                        />
                        <Input
                          placeholder="Override amount (optional)"
                          type="number"
                          value={overrideForm.overrideAmount}
                          onChange={(e) => setOverrideForm((f) => ({ ...f, overrideAmount: e.target.value }))}
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={overrideForm.isWaived}
                            onChange={(e) => setOverrideForm((f) => ({ ...f, isWaived: e.target.checked }))}
                          />
                          Waive this charge
                        </label>
                        <Input
                          placeholder="Reason"
                          value={overrideForm.reason}
                          onChange={(e) => setOverrideForm((f) => ({ ...f, reason: e.target.value }))}
                        />
                        <Button
                          className="w-full"
                          disabled={!overrideForm.chargeDefinitionId || !overrideForm.reason || createOverrideMutation.isPending}
                          onClick={() => createOverrideMutation.mutate()}
                        >
                          {createOverrideMutation.isPending ? 'Creating…' : 'Create Override'}
                        </Button>
                      </div>
                    </SectionCard>
                  </div>
                </TabsContent>
              </Tabs>
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
