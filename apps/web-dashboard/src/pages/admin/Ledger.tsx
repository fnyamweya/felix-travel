import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Badge,
    Button,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@felix-travel/ui';
import {
    ArrowDownLeft,
    ArrowUpRight,
    BookOpen,
    ChevronLeft,
    DollarSign,
    Download,
    FileText,
    Landmark,
    Scale,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, titleizeToken } from '../../lib/admin-utils.js';
import {
    DataTable,
    EmptyBlock,
    InfoCard,
    InfoGrid,
    PageHeader,
    PageShell,
    SearchField,
    SectionCard,
    StatCard,
    StatGrid,
    WorkspaceGrid,
} from '../../components/workspace-ui.js';
import { FilterChips, TableSkeleton } from '../../components/interaction-framework.js';

/* ─── helpers ─── */

function accountTypeVariant(type: string): 'info' | 'warning' | 'success' | 'secondary' | 'destructive' {
    switch (type) {
        case 'asset': return 'info';
        case 'liability': return 'warning';
        case 'revenue': return 'success';
        case 'expense': return 'destructive';
        case 'equity': return 'secondary';
        default: return 'secondary';
    }
}

function accountTypeIcon(type: string) {
    switch (type) {
        case 'asset': return ArrowUpRight;
        case 'liability': return ArrowDownLeft;
        case 'revenue': return TrendingUp;
        case 'expense': return TrendingDown;
        case 'equity': return Scale;
        default: return FileText;
    }
}

function fmtAmount(amount: number, currency = 'KES') {
    return formatMoney(amount, currency);
}

function normalBalance(type: string, debits: number, credits: number): number {
    const isDebitNormal = type === 'asset' || type === 'expense';
    return isDebitNormal ? debits - credits : credits - debits;
}

function exportToCsv(rows: any[], columns: { key: string; header: string }[], filename: string) {
    const header = columns.map(c => c.header).join(',');
    const body = rows.map(r => columns.map(c => {
        const v = r[c.key];
        return typeof v === 'string' && v.includes(',') ? `"${v}"` : v ?? '';
    }).join(',')).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/* ─── Account Detail View ─── */

function AccountDetailView({
    account,
    accounts,
    balance,
    entries,
    providers,
    onBack,
    onSwitch,
}: {
    account: any;
    accounts: any[];
    balance: any;
    entries: any[];
    providers: any[];
    onBack: () => void;
    onSwitch: (code: string) => void;
}) {
    const providerName = (id: string) => providers.find((p: any) => p.id === id)?.name ?? id.slice(-8);
    const Icon = accountTypeIcon(account.type);
    const bal = balance ? normalBalance(account.type, balance.totalDebits, balance.totalCredits) : 0;

    return (
        <div className="space-y-6">
            {/* Back + Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="mr-1 h-4 w-4" /> Back</Button>
            </div>

            {/* Account header card */}
            <div className="flex items-start justify-between rounded-2xl border border-border/60 bg-card p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-foreground">{account.name}</h2>
                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-mono">{account.code}</span>
                            <span>·</span>
                            <Badge variant={accountTypeVariant(account.type)}>{titleizeToken(account.type)}</Badge>
                            <span>·</span>
                            <span>{account.providerId ? providerName(account.providerId) : 'Platform'}</span>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Balance</div>
                    <div className={`mt-1 text-2xl font-bold tabular-nums ${bal >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                        {fmtAmount(Math.abs(bal))}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                        {account.type === 'asset' || account.type === 'expense' ? 'Normal debit balance' : 'Normal credit balance'}
                    </div>
                </div>
            </div>

            {/* Balance tiles */}
            {balance && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl border border-border/60 bg-card px-5 py-4">
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Debits</div>
                        <div className="mt-1 text-lg font-semibold tabular-nums text-blue-600 dark:text-blue-400">{fmtAmount(balance.totalDebits)}</div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card px-5 py-4">
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Credits</div>
                        <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtAmount(balance.totalCredits)}</div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card px-5 py-4">
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Entry Count</div>
                        <div className="mt-1 text-lg font-semibold tabular-nums">{entries.length}</div>
                    </div>
                </div>
            )}

            <WorkspaceGrid
                main={
                    <SectionCard
                        title="Transactions"
                        description={`All journal entry lines for ${account.name}`}
                        action={
                            entries.length > 0 ? (
                                <Button variant="outline" size="sm" onClick={() => {
                                    exportToCsv(entries, [
                                        { key: 'createdAt', header: 'Date' },
                                        { key: 'memo', header: 'Description' },
                                        { key: 'debitAmount', header: 'Debit' },
                                        { key: 'creditAmount', header: 'Credit' },
                                        { key: 'currencyCode', header: 'Currency' },
                                    ], `ledger-${account.code}-${account.name.replace(/\s+/g, '_')}.csv`);
                                }}>
                                    <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
                                </Button>
                            ) : undefined
                        }
                    >
                        {entries.length === 0 ? (
                            <EmptyBlock title="No transactions" description="This account has no posted journal entry lines yet." />
                        ) : (
                            <DataTable headers={['Date', 'Description', 'Debit', 'Credit', 'Currency']}>
                                {entries.map((e: any, idx: number) => (
                                    <tr key={e.id ?? idx} className="border-b border-border/60 transition-colors hover:bg-muted/30">
                                        <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">{formatDate(e.createdAt)}</td>
                                        <td className="p-4 text-sm">{e.memo || <span className="text-muted-foreground italic">No memo</span>}</td>
                                        <td className="p-4 font-mono text-sm text-right">
                                            {e.debitAmount > 0 ? (
                                                <span className="text-blue-600 dark:text-blue-400">{fmtAmount(e.debitAmount)}</span>
                                            ) : <span className="text-muted-foreground/50">—</span>}
                                        </td>
                                        <td className="p-4 font-mono text-sm text-right">
                                            {e.creditAmount > 0 ? (
                                                <span className="text-emerald-600 dark:text-emerald-400">{fmtAmount(e.creditAmount)}</span>
                                            ) : <span className="text-muted-foreground/50">—</span>}
                                        </td>
                                        <td className="p-4 text-sm text-muted-foreground">{e.currencyCode}</td>
                                    </tr>
                                ))}
                            </DataTable>
                        )}
                    </SectionCard>
                }
                side={
                    <div className="space-y-4">
                        <SectionCard title="Account Details">
                            <InfoGrid>
                                <InfoCard label="Account Name" value={account.name} />
                                <InfoCard label="Code" value={account.code} />
                                <InfoCard label="Type" value={titleizeToken(account.type)} />
                                <InfoCard label="Scope" value={account.providerId ? providerName(account.providerId) : 'Platform'} />
                                <InfoCard label="Status" value={account.isActive ? 'Active' : 'Inactive'} />
                                <InfoCard label="Created" value={formatDate(account.createdAt)} />
                            </InfoGrid>
                        </SectionCard>

                        <SectionCard title="Quick Switch">
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                                {accounts.map((a: any) => (
                                    <button
                                        key={a.id}
                                        onClick={() => onSwitch(a.code)}
                                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 ${a.code === account.code ? 'bg-primary/10 font-medium' : ''}`}
                                    >
                                        <Badge variant={accountTypeVariant(a.type)} className="text-[10px] px-1.5">{a.code}</Badge>
                                        <span className="truncate">{a.name}</span>
                                    </button>
                                ))}
                            </div>
                        </SectionCard>
                    </div>
                }
            />
        </div>
    );
}

/* ─── Main Component ─── */

export function AdminLedger() {
    const [search, setSearch] = useState('');
    const [selectedAccountCode, setSelectedAccountCode] = useState<string | null>(null);
    const [providerFilter, setProviderFilter] = useState<string>('__all');
    const [typeFilter, setTypeFilter] = useState<string>('__all');
    const [entryCurrency] = useState('KES');

    /* ─ queries ─ */

    const { data: accountsRaw = [], isLoading: accountsLoading } = useQuery({
        queryKey: ['admin-ledger-accounts'],
        queryFn: () => apiClient.admin.listLedgerAccounts(),
    });
    const accounts = (Array.isArray(accountsRaw) ? accountsRaw : (accountsRaw as any)?.data ?? []) as any[];

    const { data: providersRaw = [] } = useQuery({
        queryKey: ['admin-providers'],
        queryFn: () => apiClient.providers.list(),
    });
    const providers = (Array.isArray(providersRaw) ? providersRaw : (providersRaw as any)?.data ?? []) as any[];

    const selectedAccount = accounts.find((a: any) => a.code === selectedAccountCode) ?? null;

    const { data: balanceRaw } = useQuery({
        queryKey: ['admin-ledger-balance', selectedAccountCode, entryCurrency],
        queryFn: () => apiClient.admin.getLedgerBalance(selectedAccountCode!, entryCurrency),
        enabled: Boolean(selectedAccountCode),
    });
    const balance = (balanceRaw && typeof balanceRaw === 'object' && 'totalDebits' in (balanceRaw as any))
        ? (balanceRaw as any)
        : (balanceRaw as any)?.data ?? null;

    const { data: entriesRaw = [] } = useQuery({
        queryKey: ['admin-ledger-entries', selectedAccountCode],
        queryFn: () => apiClient.admin.getLedgerEntries(selectedAccountCode!),
        enabled: Boolean(selectedAccountCode),
    });
    const entries = (Array.isArray(entriesRaw) ? entriesRaw : (entriesRaw as any)?.data ?? []) as any[];

    /* ─ derived ─ */

    const filteredAccounts = useMemo(() => {
        let list = accounts;

        if (providerFilter === '__platform') {
            list = list.filter((a: any) => !a.providerId);
        } else if (providerFilter !== '__all') {
            list = list.filter((a: any) => a.providerId === providerFilter);
        }

        if (typeFilter !== '__all') {
            list = list.filter((a: any) => a.type === typeFilter);
        }

        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((a: any) =>
                [a.code, a.name, a.type].some((v) => String(v).toLowerCase().includes(q))
            );
        }
        return list;
    }, [accounts, providerFilter, typeFilter, search]);

    const platformAccounts = accounts.filter((a: any) => !a.providerId);
    const providerAccountsList = accounts.filter((a: any) => a.providerId);
    const accountsByType = useMemo(() => {
        const map = new Map<string, number>();
        for (const a of accounts) {
            map.set(a.type, (map.get(a.type) ?? 0) + 1);
        }
        return map;
    }, [accounts]);

    const providerName = (id: string) => providers.find((p: any) => p.id === id)?.name ?? id.slice(-8);

    /* ─ detail view ─ */
    if (selectedAccount) {
        return (
            <PageShell>
                <AccountDetailView
                    account={selectedAccount}
                    accounts={accounts}
                    balance={balance}
                    entries={entries}
                    providers={providers}
                    onBack={() => setSelectedAccountCode(null)}
                    onSwitch={(code) => setSelectedAccountCode(code)}
                />
            </PageShell>
        );
    }

    /* ─ chart of accounts view ─ */
    const typeFilters = [
        { value: '__all', label: 'All types' },
        { value: 'asset', label: 'Assets' },
        { value: 'liability', label: 'Liabilities' },
        { value: 'equity', label: 'Equity' },
        { value: 'revenue', label: 'Revenue' },
        { value: 'expense', label: 'Expenses' },
    ];

    return (
        <PageShell>
            <PageHeader
                eyebrow="Finance"
                title="General Ledger"
                description="Chart of accounts, balances, and journal entries."
            />

            <StatGrid>
                <StatCard label="Accounts" value={accounts.length} hint={`${platformAccounts.length} platform · ${providerAccountsList.length} provider`} icon={Landmark} />
                <StatCard label="Assets" value={accountsByType.get('asset') ?? 0} hint="Cash clearing, outgoing" icon={DollarSign} tone="info" />
                <StatCard label="Revenue" value={accountsByType.get('revenue') ?? 0} hint="Commission, fees, FX" icon={TrendingUp} tone="success" />
                <StatCard label="Liabilities" value={accountsByType.get('liability') ?? 0} hint="Payables, refunds, tax" icon={BookOpen} tone="warning" />
            </StatGrid>

            <SectionCard
                title="Chart of Accounts"
                description={`${filteredAccounts.length} account${filteredAccounts.length !== 1 ? 's' : ''} found`}
                action={
                    <div className="flex items-center gap-3">
                        <div className="w-48">
                            <Select value={providerFilter} onValueChange={setProviderFilter}>
                                <SelectTrigger><SelectValue placeholder="All scopes" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all">All scopes</SelectItem>
                                    <SelectItem value="__platform">Platform only</SelectItem>
                                    {providers.map((p: any) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <SearchField value={search} onChange={setSearch} placeholder="Search accounts..." />
                    </div>
                }
            >
                <div className="mb-4">
                    <FilterChips
                        options={typeFilters}
                        value={typeFilter}
                        onChange={setTypeFilter}
                    />
                </div>

                {accountsLoading ? (
                    <TableSkeleton rows={8} cols={6} />
                ) : filteredAccounts.length === 0 ? (
                    <EmptyBlock title="No accounts match" description="Try adjusting your filters or search query." />
                ) : (
                    <DataTable headers={['Account Name', 'Code', 'Type', 'Scope', 'Status', '']}>
                        {filteredAccounts.map((a: any) => {
                            const Icon = accountTypeIcon(a.type);
                            return (
                                <tr
                                    key={a.id}
                                    className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40"
                                    onClick={() => setSelectedAccountCode(a.code)}
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60">
                                                <Icon className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground">{a.name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 font-mono text-sm text-muted-foreground">{a.code}</td>
                                    <td className="p-4"><Badge variant={accountTypeVariant(a.type)}>{titleizeToken(a.type)}</Badge></td>
                                    <td className="p-4 text-sm text-muted-foreground">
                                        {a.providerId ? providerName(a.providerId) : 'Platform'}
                                    </td>
                                    <td className="p-4">
                                        <Badge variant={a.isActive ? 'success' : 'secondary'}>{a.isActive ? 'Active' : 'Inactive'}</Badge>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Button variant="ghost" size="sm">View →</Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </DataTable>
                )}
            </SectionCard>
        </PageShell>
    );
}
