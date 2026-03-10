import { useQuery } from '@tanstack/react-query';
import { BellRing, Blocks, Building2, CreditCard, TrendingUp, Wallet } from 'lucide-react';
import { BookingStatusBadge, Badge } from '@felix-travel/ui';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, titleizeToken } from '../../lib/admin-utils.js';
import {
  DataTable,
  DataTableEmpty,
  EntityCell,
  HeroPanel,
  InfoCard,
  InfoGrid,
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
        title="Marketplace command center"
        description="Watch bookings, settlement queues, and commercial exceptions from one control surface, then step directly into the domain that needs intervention."
        actions={
          <>
            <ActionButtonLink to="/admin/charges/simulate" variant="secondary">Run charge simulation</ActionButtonLink>
            <ActionButtonLink to="/admin/audit" variant="outline">Open audit log</ActionButtonLink>
          </>
        }
        spotlight={
          <div className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Today’s operating view</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard label="Revenue-carrying bookings" value={<span className="text-white">{paidBookings}</span>} />
              <InfoCard label="Items awaiting finance action" value={<span className="text-white">{pendingPayouts + pendingRefunds}</span>} />
            </div>
          </div>
        }
      />

      <StatGrid>
        <StatCard label="Bookings" value={totalBookings} hint={`${paidBookings} active bookings moving revenue`} icon={TrendingUp} />
        <StatCard label="Commission earned" value={formatMoney(commissionEarned)} hint="Platform commission across the current working set" icon={Wallet} tone="info" />
        <StatCard label="Pending payouts" value={pendingPayouts} hint="Settlement batches waiting on review or release" icon={CreditCard} tone="warning" />
        <StatCard label="Pending refunds" value={pendingRefunds} hint="Refund requests still requiring intervention" icon={BellRing} tone="warning" />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <QuickActionCard
          title="Access review"
          description="Invite operators, attach provider roles, and disable risky accounts without leaving the workspace."
          to="/admin/customers"
        />
        <QuickActionCard
          title="Provider setup"
          description="Onboard partners with cleaner market and reserve visibility before bookings hit production."
          to="/admin/providers"
        />
        <QuickActionCard
          title="Charge governance"
          description="Control pricing logic through structured definitions, rules, and dependencies."
          to="/admin/charges"
        />
      </div>

      <WorkspaceGrid
        main={
          <SectionCard
            title="Recent bookings"
            description="A working ledger of the most recent bookings, including service dates, totals, and live booking state."
          >
            <DataTable headers={['Reference', 'Service date', 'Total', 'Commission', 'Status']}>
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
              {(bookings?.bookings ?? []).length === 0 && <DataTableEmpty colSpan={5} label="No bookings available." />}
            </DataTable>
          </SectionCard>
        }
        side={
          <div className="space-y-6">
            <SectionCard
              title="Queue watch"
              description="The next finance and operations items that should be reviewed."
            >
              <div className="space-y-3">
                {queueItems.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{item.type} {item.id.slice(-8)}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{item.value}</div>
                      </div>
                      <Badge variant={item.type === 'Refund' ? 'warning' : 'info'}>{item.label}</Badge>
                    </div>
                  </div>
                ))}
                {queueItems.length === 0 && <div className="text-sm text-muted-foreground">No payout or refund activity to surface right now.</div>}
              </div>
            </SectionCard>

            <SectionCard
              title="Coverage"
              description="Quick operational anchors for the core control domains."
            >
              <InfoGrid>
                <InfoCard label="Access" value={<span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Operators and roles</span>} />
                <InfoCard label="Charges" value={<span className="inline-flex items-center gap-2"><Blocks className="h-4 w-4 text-primary" /> Structured pricing logic</span>} />
              </InfoGrid>
            </SectionCard>
          </div>
        }
      />
    </PageShell>
  );
}
