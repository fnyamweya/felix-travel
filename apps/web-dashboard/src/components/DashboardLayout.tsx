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
import { Badge, Button, ScrollArea, cn } from '@felix-travel/ui';
import { useAuth } from '../lib/auth-context.js';

type NavItem = { to: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/admin' || item.to === '/provider'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-primary/15 font-semibold text-white'
            : 'text-sidebar-foreground/80 hover:bg-white/8 hover:text-white'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </NavLink>
  );
}

const adminNav: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/admin/bookings', label: 'Bookings', icon: BookOpenCheck },
      { to: '/admin/customers', label: 'Customers', icon: ShieldCheck },
      { to: '/admin/providers', label: 'Providers', icon: Building2 },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/admin/refunds', label: 'Refunds', icon: CreditCard },
      { to: '/admin/payouts', label: 'Payouts', icon: Wallet },
      { to: '/admin/charges', label: 'Charges', icon: Blocks },
      { to: '/admin/charges/simulate', label: 'Simulator', icon: FileSearch },
      { to: '/admin/ledger', label: 'Ledger', icon: Landmark },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/admin/roles', label: 'Roles', icon: ShieldCheck },
      { to: '/admin/audit', label: 'Audit log', icon: ClipboardList },
    ],
  },
];

const providerNav: NavGroup[] = [
  {
    label: 'Provider',
    items: [
      { to: '/provider', label: 'Overview', icon: LayoutDashboard },
      { to: '/provider/bookings', label: 'Bookings', icon: BookOpenCheck },
      { to: '/provider/listings', label: 'Listings', icon: ListChecks },
      { to: '/provider/payouts', label: 'Payouts', icon: Wallet },
      { to: '/provider/settlement', label: 'Statements', icon: ReceiptText },
      { to: '/provider/accounts', label: 'Accounts', icon: Settings2 },
    ],
  },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isProvider = user?.role === 'service_provider';
  const navigation = isProvider ? providerNav : adminNav;
  const consoleLabel = user?.role === 'admin'
    ? 'Admin'
    : user?.role === 'agent'
      ? 'Operations'
      : 'Provider';

  return (
    <div className="min-h-screen bg-mesh-shell">
      <div className="grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-xs font-bold tracking-widest text-white">
                FT
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">Felix Travel</div>
                <div className="truncate text-[11px] text-sidebar-muted">{consoleLabel}</div>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <nav className="space-y-5 px-3 py-4">
                {navigation.map((group) => (
                  <div key={group.label} className="space-y-1">
                    <div className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
                      {group.label}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => (
                        <SidebarLink key={item.to} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </ScrollArea>

            <div className="border-t border-sidebar-border p-3">
              <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="truncate text-[11px] text-sidebar-muted">{user?.email}</div>
                </div>
                <Badge className="shrink-0 border-white/10 bg-white/10 text-[9px] uppercase tracking-wider text-white/80">
                  {user?.role?.replace('_', ' ')}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full border-white/10 bg-white/5 text-xs text-white hover:bg-white/10 hover:text-white"
                onClick={() => { logout(); navigate('/login'); }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <main className="page-content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
