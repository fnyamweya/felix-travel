import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Blocks,
  BookOpenCheck,
  Building2,
  ClipboardList,
  CreditCard,
  FileSearch,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LucideIcon,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Badge, Button, ScrollArea, Separator, cn } from '@felix-travel/ui';
import { useAuth } from '../lib/auth-context.js';

type NavigationItem = {
  to: string;
  label: string;
  caption: string;
  icon: LucideIcon;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

function AppNavLink({ item }: { item: NavigationItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'group flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all',
          isActive
            ? 'border-primary/30 bg-primary/10 text-foreground shadow-sm'
            : 'border-transparent text-sidebar-foreground/88 hover:border-sidebar-border hover:bg-white/5'
        )
      }
    >
      <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-sidebar-foreground/90 group-hover:text-white">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{item.label}</div>
        <div className="mt-1 text-xs leading-5 text-sidebar-muted">{item.caption}</div>
      </div>
    </NavLink>
  );
}

const adminNavigation: NavigationGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', caption: 'Revenue, queues, and live operations', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/admin/bookings', label: 'Bookings', caption: 'Monitor booking throughput and exceptions', icon: BookOpenCheck },
      { to: '/admin/customers', label: 'Access', caption: 'Manage operators, invites, and account state', icon: ShieldCheck },
      { to: '/admin/providers', label: 'Providers', caption: 'Provider setup, markets, and coverage', icon: Building2 },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/admin/refunds', label: 'Refunds', caption: 'Review and process refund requests', icon: CreditCard },
      { to: '/admin/payouts', label: 'Payouts', caption: 'Settlement pipeline and approvals', icon: Wallet },
      { to: '/admin/charges', label: 'Charges', caption: 'Definitions, rules, and dependencies', icon: Blocks },
      { to: '/admin/charges/simulate', label: 'Simulator', caption: 'Test charge outcomes before release', icon: FileSearch },
    ],
  },
  {
    label: 'Control',
    items: [
      { to: '/admin/audit', label: 'Audit Log', caption: 'Trace operational and financial changes', icon: ClipboardList },
    ],
  },
];

const providerNavigation: NavigationGroup[] = [
  {
    label: 'Provider',
    items: [
      { to: '/provider', label: 'Overview', caption: 'Bookings, balances, and readiness', icon: LayoutDashboard },
      { to: '/provider/bookings', label: 'Bookings', caption: 'Service delivery and charge detail', icon: BookOpenCheck },
      { to: '/provider/listings', label: 'Listings', caption: 'Inventory, pricing, and availability', icon: ListChecks },
      { to: '/provider/payouts', label: 'Payouts', caption: 'Request settlement and track batches', icon: Wallet },
      { to: '/provider/settlement', label: 'Statements', caption: 'Generate exports for reconciliation', icon: ReceiptText },
      { to: '/provider/accounts', label: 'Accounts', caption: 'Payout routes, settings, and webhooks', icon: Settings2 },
    ],
  },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isProvider = user?.role === 'service_provider';
  const navigation = isProvider ? providerNavigation : adminNavigation;
  const consoleLabel = user?.role === 'admin'
    ? 'Admin console'
    : user?.role === 'agent'
      ? 'Operations console'
      : 'Provider portal';

  return (
    <div className="min-h-screen bg-mesh-shell">
      <div className="grid min-h-screen lg:grid-cols-[304px_minmax(0,1fr)]">
        <aside className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col">
            <div className="border-b border-sidebar-border px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-base font-semibold tracking-[0.24em] text-white">
                  FT
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">Felix Travel</div>
                  <div className="truncate text-xs text-sidebar-muted">{consoleLabel}</div>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-6 px-4 py-5">
                {navigation.map((group) => (
                  <div key={group.label} className="space-y-3">
                    <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sidebar-muted">
                      {group.label}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <AppNavLink key={item.to} item={item} />
                      ))}
                    </div>
                  </div>
                ))}

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-white/80" />
                    <div className="text-sm font-semibold text-white">Operational posture</div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-sidebar-muted">
                    Use the domain workspaces to keep bookings, payouts, and provider governance aligned with the live schema.
                  </p>
                </div>
              </div>
            </ScrollArea>

            <div className="border-t border-sidebar-border px-4 py-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="truncate text-xs text-sidebar-muted">{user?.email}</div>
                  </div>
                  <Badge className="border-white/10 bg-white/10 text-[10px] uppercase tracking-[0.18em] text-white/80">
                    {user?.role?.replace('_', ' ')}
                  </Badge>
                </div>
                <Separator className="my-4 bg-white/10" />
                <Button
                  variant="outline"
                  className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                >
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-border/70 bg-white/75 backdrop-blur">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 xl:flex-row xl:items-center xl:justify-between xl:px-8">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Felix Travel workspace
                </div>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{consoleLabel}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="bg-accent text-accent-foreground">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Badge>
              </div>
            </div>
          </header>

          <main className="page-content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
