import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, HandCoins, Receipt, Wallet } from 'lucide-react';
import { Button, Input } from '@felix-travel/ui';
import { useAuth } from '../../lib/auth-context.js';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, titleizeToken } from '../../lib/admin-utils.js';
import {
  DataTable,
  DataTableEmpty,
  EmptyBlock,
  EntityCell,
  PageHeader,
  PageShell,
  SectionCard,
  StatCard,
  StatGrid,
  WorkspaceGrid,
} from '../../components/workspace-ui.js';

type StatementBooking = {
  id: string;
  reference: string;
  serviceDate: string;
  status: string;
  totalAmount: number;
  commissionAmount: number;
  currencyCode: string;
};

type StatementPayout = {
  id: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
  amount: number;
  currencyCode: string;
};

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ProviderSettlement() {
  const { user } = useAuth();
  const providerId = user?.providerId;
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const enabled = Boolean(providerId);

  const { data: bookingsData } = useQuery({
    queryKey: ['provider-bookings', providerId, 'statement'],
    queryFn: () => apiClient.providers.getBookings(providerId!, { pageSize: 200 }),
    enabled,
  });

  const { data: payoutsData } = useQuery({
    queryKey: ['provider-payouts', providerId, 'statement'],
    queryFn: () => apiClient.payouts.list({ pageSize: 200 }),
    enabled,
  });

  if (!providerId) {
    return (
      <PageShell>
        <EmptyBlock
          title="No provider context is attached to this account."
          description="Assign a provider profile to this user before generating settlement statements."
        />
      </PageShell>
    );
  }

  const bookings = (bookingsData?.bookings ?? []) as StatementBooking[];
  const payouts = (payoutsData?.payouts ?? []) as StatementPayout[];

  const filteredBookings = useMemo(() => bookings.filter((booking: any) => {
    const date = booking.serviceDate;
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;
    return true;
  }), [bookings, fromDate, toDate]);

  const filteredPayouts = useMemo(() => payouts.filter((payout: any) => {
    const date = (payout.processedAt ?? payout.createdAt)?.slice(0, 10);
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;
    return true;
  }), [payouts, fromDate, toDate]);

  const grossBookings = filteredBookings.reduce((sum: number, booking: any) => sum + (booking.totalAmount ?? 0), 0);
  const commission = filteredBookings.reduce((sum: number, booking: any) => sum + (booking.commissionAmount ?? 0), 0);
  const netBeforePayout = filteredBookings.reduce((sum: number, booking: any) => sum + ((booking.totalAmount ?? 0) - (booking.commissionAmount ?? 0)), 0);
  const settled = filteredPayouts.filter((payout: any) => payout.status === 'succeeded').reduce((sum: number, payout: any) => sum + payout.amount, 0);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Provider statements"
        title="Settlement statements"
        description="Generate clean commercial and payout statements for any operating period, then export the underlying activity for reconciliation."
        actions={
          <>
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="w-[180px]" />
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="w-[180px]" />
            <Button
              variant="outline"
              onClick={() => downloadCsv('provider-settlement-bookings.csv', [
                ['Reference', 'Service Date', 'Status', 'Total', 'Commission', 'Currency'],
                ...filteredBookings.map((booking: any) => [
                  booking.reference,
                  booking.serviceDate,
                  booking.status,
                  booking.totalAmount,
                  booking.commissionAmount,
                  booking.currencyCode,
                ]),
              ])}
            >
              <Download className="h-4 w-4" />
              Export bookings
            </Button>
            <Button
              onClick={() => downloadCsv('provider-settlement-payouts.csv', [
                ['Payout ID', 'Status', 'Created', 'Processed', 'Amount', 'Currency'],
                ...filteredPayouts.map((payout: any) => [
                  payout.id,
                  payout.status,
                  payout.createdAt,
                  payout.processedAt ?? '',
                  payout.amount,
                  payout.currencyCode,
                ]),
              ])}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export payouts
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatCard label="Gross bookings" value={formatMoney(grossBookings, filteredBookings[0]?.currencyCode ?? 'KES')} hint={`${filteredBookings.length} bookings in scope`} icon={Receipt} />
        <StatCard label="Commission" value={formatMoney(commission, filteredBookings[0]?.currencyCode ?? 'KES')} hint="Platform commission across the filtered period" icon={HandCoins} tone="warning" />
        <StatCard label="Net before payout" value={formatMoney(netBeforePayout, filteredBookings[0]?.currencyCode ?? 'KES')} hint="Booking-side value before payout batching" icon={Wallet} tone="info" />
        <StatCard label="Settled" value={formatMoney(settled, filteredPayouts[0]?.currencyCode ?? 'KES')} hint="Completed payouts in the selected period" icon={FileSpreadsheet} tone="success" />
      </StatGrid>

      <WorkspaceGrid
        main={
          <SectionCard
            title="Statement source bookings"
            description="The booking ledger that drives the commercial side of the statement."
          >
            <DataTable headers={['Reference', 'Service date', 'Total', 'Commission', 'Status']}>
              {filteredBookings.map((booking: any) => (
                <tr key={booking.id} className="border-b border-border/60">
                  <td className="p-4">
                    <EntityCell title={booking.reference} subtitle={booking.id.slice(-8)} />
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{formatDate(booking.serviceDate)}</td>
                  <td className="p-4 text-sm font-medium text-foreground">{formatMoney(booking.totalAmount, booking.currencyCode)}</td>
                  <td className="p-4 text-sm text-muted-foreground">{formatMoney(booking.commissionAmount, booking.currencyCode)}</td>
                  <td className="p-4 text-sm text-muted-foreground">{titleizeToken(booking.status)}</td>
                </tr>
              ))}
              {filteredBookings.length === 0 && <DataTableEmpty colSpan={5} label="No bookings found for the selected period." />}
            </DataTable>
          </SectionCard>
        }
        side={
          <SectionCard
            title="Statement source payouts"
            description="Disbursement-side activity that completes the settlement picture."
          >
            <div className="space-y-3">
              {filteredPayouts.map((payout: any) => (
                <div key={payout.id} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{payout.id.slice(-8)}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {titleizeToken(payout.status)} / processed {formatDate(payout.processedAt ?? payout.createdAt)}
                      </div>
                    </div>
                    <div className="text-sm font-medium text-foreground">{formatMoney(payout.amount, payout.currencyCode)}</div>
                  </div>
                </div>
              ))}
              {filteredPayouts.length === 0 && (
                <EmptyBlock
                  title="No payouts found"
                  description="No payout activity falls inside the selected statement period."
                />
              )}
            </div>
          </SectionCard>
        }
      />
    </PageShell>
  );
}
