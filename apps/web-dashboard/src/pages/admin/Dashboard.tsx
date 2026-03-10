import { useQuery } from '@tanstack/react-query';
import { BellRing, CreditCard, TrendingUp, Wallet } from 'lucide-react';
import { BookingStatusBadge, Badge } from '@felix-travel/ui';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, titleizeToken } from '../../lib/admin-utils.js';
import {
  DataTable,
  DataTableEmpty,
  EntityCell,
  HeroPanel,
  InfoCard,
  PageShell,
  QuickActionCard,
  SectionCard,
  StatCard,
  StatGrid,
  WorkspaceGrid,
  ActionButtonLink,
} from '../../components/workspace-ui.js';

export function AdminDashboard() {
  const { data: bookings } = useQuery({
    queryKey: ['admin-bookings', 'dashboard'],
    queryFn: () => apiClient.admin.listBookings({ pageSize: 100 }),
  });

  const { data: payouts } = useQuery({
    queryKey: ['admin-payouts', 'dashboard'],
    queryFn: () => apiClient.admin.listPayouts({ pageSize: 100 }),
  });

  const { data: refunds } = useQuery({
    queryKey: ['admin-refunds', 'dashboard'],
    queryFn: () => apiClient.admin.listRefunds({ pageSize: 100 }),
  });

  const totalBookings = bookings?.meta?.total ?? 0;
  const paidBookings = bookings?.bookings?.filter((booking: any) => booking.status === 'paid' || booking.status === 'confirmed').length ?? 0;
  const commissionEarned = bookings?.bookings?.reduce((sum: number, booking: any) => sum + (booking.commissionAmount ?? 0), 0) ?? 0;
  const pendingPayouts = payouts?.payouts?.filter((payout: any) => payout.status === 'pending').length ?? 0;
  const pendingRefunds = refunds?.refunds?.filter((refund: any) => refund.status === 'pending').length ?? 0;
  const queueItems = [
    ...(payouts?.payouts ?? []).slice(0, 4).map((payout: any) => ({
      id: payout.id,
      type: 'Payout',
      label: titleizeToken(payout.status),
      value: formatMoney(payout.amount, payout.currencyCode),
    })),
    ...(refunds?.refunds ?? []).slice(0, 4).map((refund: any) => ({
      id: refund.id,
      type: 'Refund',
      label: titleizeToken(refund.status),
      value: formatMoney(refund.amount, refund.currencyCode),
    })),
  ];

  return (
    <PageShell>
      <HeroPanel
        title="Command center"
        description="Bookings, settlements, and charge governance at a glance."
        actions={
          <>
            <ActionButtonLink to="/admin/charges/simulate" variant="secondary">Charge simulator</ActionButtonLink>
            <ActionButtonLink to="/admin/audit" variant="outline">Audit log</ActionButtonLink>
          </>
        }
        spotlight={
          <div className="space-y-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Today</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoCard label="Active bookings" value={<span className="text-white">{paidBookings}</span>} />
              <InfoCard label="Pending actions" value={<span className="text-white">{pendingPayouts + pendingRefunds}</span>} />
            </div>
          </div>
        }
      />

      <StatGrid>
        <StatCard label="Bookings" value={totalBookings} hint={`${paidBookings} active`} icon={TrendingUp} />
        <StatCard label="Commission" value={formatMoney(commissionEarned)} icon={Wallet} tone="info" />
        <StatCard label="Pending payouts" value={pendingPayouts} icon={CreditCard} tone="warning" />
        <StatCard label="Pending refunds" value={pendingRefunds} icon={BellRing} tone="warning" />
      </StatGrid>

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickActionCard title="Customers" description="Manage operators, invites, and accounts." to="/admin/customers" />
        <QuickActionCard title="Providers" description="Onboard and manage provider partners." to="/admin/providers" />
        <QuickActionCard title="Charges" description="Definitions, rules, and pricing logic." to="/admin/charges" />
      </div>

      <WorkspaceGrid
        main={
          <SectionCard title="Recent bookings">
            <DataTable headers={['Reference', 'Date', 'Total', 'Commission', 'Status']}>
              {(bookings?.bookings ?? []).slice(0, 8).map((booking: any) => (
                <tr key={booking.id} className="border-b border-border/60">
                  <td className="p-4">
                    <EntityCell title={booking.reference} subtitle={booking.id.slice(-8)} />
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{formatDate(booking.serviceDate)}</td>
                  <td className="p-4 text-sm font-medium text-foreground">{formatMoney(booking.totalAmount, booking.currencyCode)}</td>
                  <td className="p-4 text-sm text-muted-foreground">{formatMoney(booking.commissionAmount, booking.currencyCode)}</td>
                  <td className="p-4"><BookingStatusBadge status={booking.status} /></td>
                </tr>
              ))}
              {(bookings?.bookings ?? []).length === 0 && <DataTableEmpty colSpan={5} label="No bookings yet." />}
            </DataTable>
          </SectionCard>
        }
        side={
          <div className="space-y-5">
            <SectionCard title="Queue">
              <div className="space-y-2">
                {queueItems.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-3">
                    <div>
                      <div className="text-sm font-medium">{item.type} {item.id.slice(-8)}</div>
                      <div className="text-xs text-muted-foreground">{item.value}</div>
                    </div>
                    <Badge variant={item.type === 'Refund' ? 'warning' : 'info'}>{item.label}</Badge>
                  </div>
                ))}
                {queueItems.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No pending items.</p>}
              </div>
            </SectionCard>
          </div>
        }
      />
    </PageShell>
  );
}
