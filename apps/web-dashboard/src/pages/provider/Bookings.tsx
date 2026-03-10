import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, Check, CircleDollarSign, Clock, TicketCheck, XCircle } from 'lucide-react';
import { BookingStatusBadge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@felix-travel/ui';
import { useAuth } from '../../lib/auth-context.js';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, getErrorMessage, titleizeToken } from '../../lib/admin-utils.js';
import {
  DataTable,
  DataTableEmpty,
  EmptyBlock,
  EntityCell,
  InfoCard,
  InfoGrid,
  Notice,
  PageHeader,
  PageShell,
  SectionCard,
  StatCard,
  StatGrid,
  WorkspaceGrid,
} from '../../components/workspace-ui.js';

type ProviderBooking = {
  id: string;
  reference: string;
  serviceDate: string;
  subtotalAmount: number;
  commissionAmount: number;
  totalAmount: number;
  currencyCode: string;
  guestCount: number;
  status: string;
};

const ACTIONABLE_STATUSES = ['paid', 'provider_on_hold'];

export function ProviderBookings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const providerId = user?.providerId;
  const [status, setStatus] = useState('all');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['provider-bookings', providerId],
    queryFn: () => apiClient.providers.getBookings(providerId!, { pageSize: 100 }),
    enabled: Boolean(providerId),
  });

  const { data: chargeLines } = useQuery({
    queryKey: ['provider-booking-charge-lines', selectedBookingId],
    queryFn: () => apiClient.charges.getBookingChargeLines(selectedBookingId!),
    enabled: Boolean(selectedBookingId),
  });

  if (!providerId) {
    return (
      <PageShell>
        <EmptyBlock
          title="No provider context is attached to this account."
          description="Assign a provider to use booking operations."
        />
      </PageShell>
    );
  }

  const bookings = (data?.bookings ?? []) as ProviderBooking[];
  const filteredBookings = useMemo(() => (
    status === 'all' ? bookings : bookings.filter((booking: any) => booking.status === status)
  ), [bookings, status]);

  const confirmed = bookings.filter((booking: any) => booking.status === 'confirmed').length;
  const paid = bookings.filter((booking: any) => booking.status === 'paid').length;
  const onHold = bookings.filter((booking: any) => booking.status === 'provider_on_hold').length;
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) ?? null;
  const canAct = selectedBooking && ACTIONABLE_STATUSES.includes(selectedBooking.status);

  const invalidateBookings = () => {
    queryClient.invalidateQueries({ queryKey: ['provider-bookings'] });
    setActionError(null);
    setActionReason('');
  };

  const acceptMutation = useMutation({
    mutationFn: () => apiClient.providers.acceptBooking(providerId!, selectedBookingId!),
    onSuccess: invalidateBookings,
    onError: (e) => setActionError(getErrorMessage(e)),
  });

  const holdMutation = useMutation({
    mutationFn: () => apiClient.providers.holdBooking(providerId!, selectedBookingId!, actionReason),
    onSuccess: invalidateBookings,
    onError: (e) => setActionError(getErrorMessage(e)),
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiClient.providers.rejectBooking(providerId!, selectedBookingId!, actionReason),
    onSuccess: invalidateBookings,
    onError: (e) => setActionError(getErrorMessage(e)),
  });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Provider bookings"
        title="Booking operations"
        description="Track fulfilment, service dates, and charge breakdowns."
        actions={
          <div className="min-w-[200px]">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_payment">Pending payment</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="provider_on_hold">On hold</SelectItem>
                <SelectItem value="provider_accepted">Accepted</SelectItem>
                <SelectItem value="provider_rejected">Rejected</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <StatGrid>
        <StatCard label="Bookings" value={bookings.length} hint="Provider bookings in current result set" icon={CalendarRange} />
        <StatCard label="Paid" value={paid} hint="Awaiting accept, hold, or reject" icon={CircleDollarSign} tone="info" />
        <StatCard label="On hold" value={onHold} hint="Placed on hold pending review" icon={Clock} tone="warning" />
        <StatCard label="Confirmed" value={confirmed} hint="Confirmed bookings awaiting delivery" icon={TicketCheck} tone="success" />
      </StatGrid>

      <WorkspaceGrid
        main={
          <SectionCard
            title="Booking queue"
            description="Select a booking to inspect totals and charges."
          >
            <DataTable headers={['Reference', 'Service date', 'Guests', 'Total', 'Status']}>
              {filteredBookings.map((booking: any) => (
                <tr
                  key={booking.id}
                  className={selectedBookingId === booking.id ? 'border-b border-border/60 bg-primary/5' : 'border-b border-border/60'}
                  onClick={() => setSelectedBookingId(booking.id)}
                >
                  <td className="cursor-pointer p-4">
                    <EntityCell title={booking.reference} subtitle={booking.id.slice(-8)} />
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{formatDate(booking.serviceDate)}</td>
                  <td className="p-4 text-sm text-foreground">{booking.guestCount}</td>
                  <td className="p-4 text-sm font-medium text-foreground">{formatMoney(booking.totalAmount, booking.currencyCode)}</td>
                  <td className="p-4"><BookingStatusBadge status={booking.status} /></td>
                </tr>
              ))}
              {filteredBookings.length === 0 && <DataTableEmpty colSpan={5} label="No bookings match the selected filter." />}
            </DataTable>
          </SectionCard>
        }
        side={
          <SectionCard
            title="Booking detail"
            description="Amounts and computed charges for the selected booking."
          >
            {!selectedBooking ? (
              <EmptyBlock
                title="Select a booking"
                description="Choose a booking to view pricing and charges."
              />
            ) : (
              <div className="space-y-5">
                <InfoGrid>
                  <InfoCard label="Reference" value={selectedBooking.reference} />
                  <InfoCard label="Service date" value={formatDate(selectedBooking.serviceDate)} />
                  <InfoCard label="Subtotal" value={formatMoney(selectedBooking.subtotalAmount, selectedBooking.currencyCode)} />
                  <InfoCard label="Commission" value={formatMoney(selectedBooking.commissionAmount, selectedBooking.currencyCode)} />
                  <InfoCard label="Status" value={titleizeToken(selectedBooking.status)} />
                  <InfoCard label="Net payable" value={formatMoney(selectedBooking.subtotalAmount - selectedBooking.commissionAmount, selectedBooking.currencyCode)} />
                </InfoGrid>

                {/* ── Booking action panel ── */}
                {canAct && (
                  <div className="rounded-2xl border border-border/60 bg-muted/25 p-4 space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Actions</div>
                    {actionError && <Notice message={actionError} variant="destructive" />}
                    <Button
                      className="w-full"
                      onClick={() => acceptMutation.mutate()}
                      disabled={acceptMutation.isPending}
                    >
                      <Check className="mr-2 h-4 w-4" /> Accept booking
                    </Button>
                    <Input
                      placeholder="Reason (required for hold/reject)"
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => holdMutation.mutate()}
                        disabled={holdMutation.isPending || !actionReason || selectedBooking.status === 'provider_on_hold'}
                      >
                        <Clock className="mr-2 h-4 w-4" /> Hold
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => rejectMutation.mutate()}
                        disabled={rejectMutation.isPending || !actionReason}
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {(chargeLines ?? []).length === 0 && (
                    <EmptyBlock
                      title="No charge lines recorded"
                      description="No charge lines attached to this booking."
                    />
                  )}
                  {(chargeLines ?? []).map((line: any) => (
                    <div key={line.id} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{line.chargeCode}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{titleizeToken(line.refundBehavior)}</div>
                        </div>
                        <div className="text-sm font-medium text-foreground">
                          {formatMoney(line.chargeAmount, line.currencyCode)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        }
      />
    </PageShell>
  );
}
