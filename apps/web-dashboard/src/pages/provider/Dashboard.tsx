import { useQuery } from '@tanstack/react-query';
import {
  BookOpenCheck,
  CalendarClock,
  CircleDollarSign,
  HandCoins,
  ListChecks,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { BookingStatusBadge, Badge } from '@felix-travel/ui';
import { useAuth } from '../../lib/auth-context.js';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney } from '../../lib/admin-utils.js';
import {
  ActionButtonLink,
  DataTable,
  DataTableEmpty,
  EmptyBlock,
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
} from '../../components/workspace-ui.js';

export function ProviderDashboard() {
  const { user } = useAuth();
  const providerId = user?.providerId;
  const enabled = Boolean(providerId);

  const { data: provider } = useQuery({
    queryKey: ['provider-profile', providerId],
    queryFn: () => apiClient.providers.get(providerId!),
    enabled,
  });

  const { data: settings } = useQuery({
    queryKey: ['provider-settings', providerId],
    queryFn: () => apiClient.providers.getSettings(providerId!),
    enabled,
  });

  const { data: bookingsData } = useQuery({
    queryKey: ['provider-bookings', providerId],
    queryFn: () => apiClient.providers.getBookings(providerId!, { pageSize: 100 }),
    enabled,
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['provider-listings', providerId],
    queryFn: () => apiClient.providers.getListings(providerId!),
    enabled,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['provider-payout-accounts', providerId],
    queryFn: () => apiClient.providers.getPayoutAccounts(providerId!),
    enabled,
  });

  const { data: payouts } = useQuery({
    queryKey: ['provider-payouts', providerId],
    queryFn: () => apiClient.payouts.list({ pageSize: 100 }),
    enabled,
  });

  if (!providerId) {
    return (
      <PageShell>
        <EmptyBlock
          title="No provider context is attached to this account."
          description="Assign a provider profile to this user before using provider operations."
        />
      </PageShell>
    );
  }

  const bookings = bookingsData?.bookings ?? [];
  const payoutItems = payouts?.payouts ?? [];
  const activeListings = (listings as any[]).filter((listing) => listing.status === 'active').length;
  const draftListings = (listings as any[]).filter((listing) => listing.status === 'draft' || listing.status === 'pending_review').length;
  const upcomingBookings = bookings.filter((booking: any) => booking.status === 'confirmed' || booking.status === 'paid').length;
  const grossBooked = bookings.reduce((sum: number, booking: any) => sum + (booking.totalAmount ?? 0), 0);
  const pendingPayoutValue = payoutItems
    .filter((payout: any) => ['pending', 'scheduled', 'processing', 'on_hold'].includes(payout.status))
    .reduce((sum: number, payout: any) => sum + payout.amount, 0);
  const settledValue = payoutItems
    .filter((payout: any) => payout.status === 'succeeded')
    .reduce((sum: number, payout: any) => sum + payout.amount, 0);
  const defaultAccount = accounts.find((account: any) => account.isDefault);
  const settingsSummary = settings as {
    settlementDelayDays?: number | null;
    commissionBps?: number;
    autoApprovePayout?: boolean;
  } | null;

  return (
    <PageShell>
      <HeroPanel
        title={provider?.name ?? 'Provider portal'}
        description="Run bookings, listings, payout readiness, and finance exports from a single professional workspace built for day-to-day provider operations."
        actions={
          <>
            <ActionButtonLink to="/provider/listings" variant="secondary">Manage listings</ActionButtonLink>
            <ActionButtonLink to="/provider/payouts" variant="outline">Request payout</ActionButtonLink>
          </>
        }
        spotlight={
          <div className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Settlement posture</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-sm text-slate-200">Default payout route</span>
                <Badge className="border-white/10 bg-white/10 text-white">{defaultAccount ? 'Configured' : 'Missing'}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-sm text-slate-200">Verification</span>
                <Badge className="border-white/10 bg-white/10 text-white">{provider?.isVerified ? 'Verified' : 'Pending'}</Badge>
              </div>
            </div>
          </div>
        }
      />

      <StatGrid>
        <StatCard label="Gross booked" value={formatMoney(grossBooked, provider?.currencyCode ?? 'KES')} hint={`${bookings.length} bookings in the current working set`} icon={CircleDollarSign} />
        <StatCard label="Upcoming services" value={upcomingBookings} hint="Paid or confirmed bookings awaiting fulfilment" icon={CalendarClock} tone="info" />
        <StatCard label="Pending settlement" value={formatMoney(pendingPayoutValue, provider?.currencyCode ?? 'KES')} hint="Payout batches not yet completed" icon={HandCoins} tone="warning" />
        <StatCard label="Settled" value={formatMoney(settledValue, provider?.currencyCode ?? 'KES')} hint="Payouts already processed successfully" icon={WalletCards} tone="success" />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <QuickActionCard title="Manage listings" description="Create inventory, adjust pricing, and publish polished bookable experiences." to="/provider/listings" />
        <QuickActionCard title="Generate statements" description="Export booking and payout activity into clean settlement statements for finance." to="/provider/settlement" />
        <QuickActionCard title="Manage accounts" description="Keep payout routes, settlement preferences, and webhook integrations current." to="/provider/accounts" />
      </div>

      <WorkspaceGrid
        main={
          <SectionCard
            title="Operational pulse"
            description="Recent bookings, service dates, and revenue activity across the provider account."
          >
            <DataTable headers={['Booking', 'Service date', 'Total', 'Status']}>
              {bookings.slice(0, 8).map((booking: any) => (
                <tr key={booking.id} className="border-b border-border/60">
                  <td className="p-4">
                    <EntityCell title={booking.reference} subtitle={booking.id.slice(-8)} />
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{formatDate(booking.serviceDate)}</td>
                  <td className="p-4 text-sm font-medium text-foreground">{formatMoney(booking.totalAmount, booking.currencyCode)}</td>
                  <td className="p-4"><BookingStatusBadge status={booking.status} /></td>
                </tr>
              ))}
              {bookings.length === 0 && <DataTableEmpty colSpan={4} label="No bookings found for this provider yet." />}
            </DataTable>
          </SectionCard>
        }
        side={
          <div className="space-y-6">
            <SectionCard
              title="Readiness"
              description="The main setup items that affect bookings, settlement, and operational scale."
            >
              <InfoGrid>
                <InfoCard label="Listing health" value={<span className="inline-flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" /> {activeListings} active / {draftListings} in setup</span>} />
                <InfoCard label="Settlement delay" value={<span className="inline-flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-primary" /> {settingsSummary?.settlementDelayDays ?? 0} days</span>} />
                <InfoCard label="Commission setting" value={`${((settingsSummary?.commissionBps ?? 0) / 100).toFixed(2)}%`} />
                <InfoCard label="Payout policy" value={settingsSummary?.autoApprovePayout ? 'Auto-approval enabled' : 'Manual approval required'} />
              </InfoGrid>
            </SectionCard>

            <SectionCard
              title="Operational state"
              description="Current account posture for provider activation and payouts."
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/35 px-4 py-3">
                  <span className="text-sm text-foreground">Provider status</span>
                  <Badge variant={provider?.isActive ? 'success' : 'warning'}>
                    {provider?.isActive ? 'Live' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/35 px-4 py-3">
                  <span className="text-sm text-foreground">Verification</span>
                  <Badge variant={provider?.isVerified ? 'info' : 'warning'}>
                    {provider?.isVerified ? 'Verified' : 'Pending'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/35 px-4 py-3">
                  <span className="text-sm text-foreground">Default account</span>
                  <span className="text-sm text-muted-foreground">
                    {defaultAccount ? `${defaultAccount.accountType.replace(/_/g, ' ')} ending ${defaultAccount.accountNumber.slice(-4)}` : 'Not configured'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/35 px-4 py-3">
                  <span className="text-sm text-foreground">Compliance</span>
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Ready for provider operations
                  </span>
                </div>
              </div>
            </SectionCard>
          </div>
        }
      />
    </PageShell>
  );
}
