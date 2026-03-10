import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange, CircleDollarSign, TicketCheck, TicketX } from 'lucide-react';
import { BookingStatusBadge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@felix-travel/ui';
import { useAuth } from '../../lib/auth-context.js';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, titleizeToken } from '../../lib/admin-utils.js';
import {
  DataTable,
  DataTableEmpty,
  EmptyBlock,
  EntityCell,
  InfoCard,
  InfoGrid,
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

export function ProviderBookings() {
  const { user } = useAuth();
  const providerId = user?.providerId;
  const [status, setStatus] = useState('all');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

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
          description="Assign a provider profile to this user before using provider booking operations."
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
  const cancelled = bookings.filter((booking: any) => booking.status === 'cancelled').length;
  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) ?? null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Provider bookings"
        title="Booking operations"
        description="Track fulfilment status, upcoming service dates, and the charge lines attached to each booking from one clean operator workspace."
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
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <StatGrid>
        <StatCard label="Bookings" value={bookings.length} hint="All provider-visible bookings in the current result set" icon={CalendarRange} />
        <StatCard label="Paid" value={paid} hint="Bookings ready for service delivery or settlement progression" icon={CircleDollarSign} tone="info" />
        <StatCard label="Confirmed" value={confirmed} hint="Confirmed service commitments still to be delivered" icon={TicketCheck} tone="success" />
        <StatCard label="Cancelled" value={cancelled} hint="Cancelled bookings that may need follow-up or refunds" icon={TicketX} tone="warning" />
      </StatGrid>

      <WorkspaceGrid
        main={
          <SectionCard
            title="Booking queue"
            description="Select a booking to inspect totals, guest counts, and the computed charge breakdown."
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
                description="Choose a booking from the queue to inspect guest, pricing, and charge details."
              />
            ) : (
              <div className="space-y-5">
                <InfoGrid>
                  <InfoCard label="Reference" value={selectedBooking.reference} />
                  <InfoCard label="Service date" value={formatDate(selectedBooking.serviceDate)} />
                  <InfoCard label="Subtotal" value={formatMoney(selectedBooking.subtotalAmount, selectedBooking.currencyCode)} />
                  <InfoCard label="Commission" value={formatMoney(selectedBooking.commissionAmount, selectedBooking.currencyCode)} />
                </InfoGrid>

                <div className="space-y-3">
                  {(chargeLines ?? []).length === 0 && (
                    <EmptyBlock
                      title="No charge lines recorded"
                      description="This booking does not currently have computed charge lines attached."
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
