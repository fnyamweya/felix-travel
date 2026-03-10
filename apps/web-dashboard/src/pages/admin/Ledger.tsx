import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Badge,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@felix-travel/ui';
import { BookOpen, DollarSign, Landmark, TrendingUp } from 'lucide-react';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, titleizeToken } from '../../lib/admin-utils.js';
import {
    DataTable,
    DataTableEmpty,
    EmptyBlock,
    EntityCell,
    Field,
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

function formatLedgerAmount(amount: number, currency = 'KES') {
    return formatMoney(amount, currency);
}

/* ─── Component ─── */

export function AdminLedger() {
    const [activeTab, setActiveTab] = useState('chart');
    const [search, setSearch] = useState('');
    const [selectedAccountCode, setSelectedAccountCode] = useState<string | null>(null);
    const [providerFilter, setProviderFilter] = useState<string>('__all');
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

        // Provider filter
        if (providerFilter === '__platform') {
            list = list.filter((a: any) => !a.providerId);
        } else if (providerFilter !== '__all') {
            list = list.filter((a: any) => a.providerId === providerFilter);
        }

        // Text search
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((a: any) =>
                [a.code, a.name, a.type].some((v) => String(v).toLowerCase().includes(q))
            );
        }
        return list;
    }, [accounts, providerFilter, search]);

    const platformAccounts = accounts.filter((a: any) => !a.providerId);
    const providerAccounts = accounts.filter((a: any) => a.providerId);
    const accountsByType = useMemo(() => {
        const map = new Map<string, number>();
        for (const a of accounts) {
            map.set(a.type, (map.get(a.type) ?? 0) + 1);
        }
        return map;
    }, [accounts]);

    const providerName = (id: string) => providers.find((p: any) => p.id === id)?.name ?? id.slice(-8);

    return (
        <PageShell>
            <PageHeader
                eyebrow="Finance"
                title="General Ledger"
                description="Accounts, balances, and journal entries across providers."
            />

            <StatGrid>
                <StatCard label="Accounts" value={accounts.length} hint={`${platformAccounts.length} platform · ${providerAccounts.length} provider`} icon={Landmark} />
                <StatCard label="Assets" value={accountsByType.get('asset') ?? 0} hint="Cash clearing, outgoing" icon={DollarSign} tone="info" />
                <StatCard label="Revenue" value={accountsByType.get('revenue') ?? 0} hint="Commission, fees, FX" icon={TrendingUp} tone="success" />
                <StatCard label="Liabilities" value={accountsByType.get('liability') ?? 0} hint="Payables, refunds, tax" icon={BookOpen} tone="warning" />
            </StatGrid>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-6">
                    <TabsTrigger value="chart">Chart of Accounts</TabsTrigger>
                    <TabsTrigger value="journal">Journal Entries</TabsTrigger>
                </TabsList>

                {/* ═══ TAB 1: Chart of Accounts ═══ */}
                <TabsContent value="chart">
                    <SectionCard
                        title="Chart of accounts"
                        description="Filter by provider or search by code/name."
                        action={
                            <div className="flex items-center gap-3">
                                <div className="w-56">
                                    <Field label="">
                                        <Select value={providerFilter} onValueChange={setProviderFilter}>
                                            <SelectTrigger><SelectValue placeholder="All accounts" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__all">All accounts</SelectItem>
                                                <SelectItem value="__platform">Platform only</SelectItem>
                                                {providers.map((p: any) => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                </div>
                                <SearchField value={search} onChange={setSearch} placeholder="Search accounts" />
                            </div>
                        }
                    >
                        <DataTable headers={['Account', 'Type', 'Scope', 'Status', 'Created']}>
                            {accountsLoading && <DataTableEmpty colSpan={5} label="Loading accounts..." />}
                            {!accountsLoading && filteredAccounts.length === 0 && <DataTableEmpty colSpan={5} label="No accounts match." />}
                            {filteredAccounts.map((a: any) => (
                                <tr key={a.id}
                                    className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40 ${a.code === selectedAccountCode ? 'bg-primary/5' : ''}`}
                                    onClick={() => { setSelectedAccountCode(a.code); setActiveTab('journal'); }}>
                                    <td className="p-4"><EntityCell title={a.code} subtitle={a.name} /></td>
                                    <td className="p-4"><Badge variant={accountTypeVariant(a.type)}>{titleizeToken(a.type)}</Badge></td>
                                    <td className="p-4 text-sm text-muted-foreground">
                                        {a.providerId ? providerName(a.providerId) : 'Platform'}
                                    </td>
                                    <td className="p-4">
                                        <Badge variant={a.isActive ? 'success' : 'secondary'}>{a.isActive ? 'Active' : 'Inactive'}</Badge>
                                    </td>
                                    <td className="p-4 text-sm text-muted-foreground">{formatDate(a.createdAt)}</td>
                                </tr>
                            ))}
                        </DataTable>
                    </SectionCard>
                </TabsContent>

                {/* ═══ TAB 2: Journal Entries ═══ */}
                <TabsContent value="journal">
                    {!selectedAccountCode ? (
                        <EmptyBlock title="Select an account" description="Select an account from the Chart of Accounts tab." />
                    ) : (
                        <WorkspaceGrid
                            main={
                                <SectionCard
                                    title={`Journal lines — ${selectedAccountCode}`}
                                    description={selectedAccount ? `${selectedAccount.name} (${titleizeToken(selectedAccount.type)})` : ''}
                                >
                                    {entries.length === 0 ? (
                                        <EmptyBlock title="No journal entries" description="This account has no posted journal entry lines." />
                                    ) : (
                                        <DataTable headers={['#', 'Debit', 'Credit', 'Currency', 'Memo', 'Posted']}>
                                            {entries.map((e: any, idx: number) => (
                                                <tr key={e.id ?? idx} className="border-b border-border/60">
                                                    <td className="p-4 text-xs text-muted-foreground">{idx + 1}</td>
                                                    <td className="p-4 font-mono text-sm">
                                                        {e.debitAmount > 0 ? (
                                                            <span className="text-blue-600 dark:text-blue-400">{formatLedgerAmount(e.debitAmount)}</span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="p-4 font-mono text-sm">
                                                        {e.creditAmount > 0 ? (
                                                            <span className="text-emerald-600 dark:text-emerald-400">{formatLedgerAmount(e.creditAmount)}</span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="p-4 text-sm text-muted-foreground">{e.currencyCode}</td>
                                                    <td className="p-4 text-sm text-muted-foreground">{e.memo || '—'}</td>
                                                    <td className="p-4 text-sm text-muted-foreground">{formatDate(e.createdAt)}</td>
                                                </tr>
                                            ))}
                                        </DataTable>
                                    )}
                                </SectionCard>
                            }
                            side={
                                <SectionCard title="Account summary" description={selectedAccount?.name ?? ''}>
                                    <div className="space-y-5">
                                        {balance ? (
                                            <>
                                                <InfoGrid>
                                                    <InfoCard label="Total debits" value={formatLedgerAmount(balance.totalDebits)} />
                                                    <InfoCard label="Total credits" value={formatLedgerAmount(balance.totalCredits)} />
                                                </InfoGrid>
                                                <div className="rounded-2xl border border-border/60 bg-muted/25 px-5 py-5">
                                                    <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Net debit balance</div>
                                                    <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                                                        {formatLedgerAmount(balance.netDebitBalance)}
                                                    </div>
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        {balance.netDebitBalance > 0 ? 'Debit heavy' : balance.netDebitBalance < 0 ? 'Credit heavy' : 'Balanced'}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <EmptyBlock title="Loading..." description="Fetching account balance." />
                                        )}

                                        {selectedAccount && (
                                            <InfoGrid>
                                                <InfoCard label="Code" value={selectedAccount.code} />
                                                <InfoCard label="Type" value={titleizeToken(selectedAccount.type)} />
                                                <InfoCard label="Scope" value={selectedAccount.providerId ? providerName(selectedAccount.providerId) : 'Platform'} />
                                                <InfoCard label="Active" value={selectedAccount.isActive ? 'Yes' : 'No'} />
                                                <InfoCard label="Entries" value={String(entries.length)} />
                                                <InfoCard label="Created" value={formatDate(selectedAccount.createdAt)} />
                                            </InfoGrid>
                                        )}

                                        {/* Quick account selector */}
                                        <div className="space-y-2 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
                                            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Switch account</div>
                                            <Field label="">
                                                <Select value={selectedAccountCode ?? '__none'} onValueChange={(v) => setSelectedAccountCode(v === '__none' ? null : v)}>
                                                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none">Select account</SelectItem>
                                                        {accounts.map((a: any) => (
                                                            <SelectItem key={a.id} value={a.code}>{a.code} — {a.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </Field>
                                        </div>
                                    </div>
                                </SectionCard>
                            }
                        />
                    )}
                </TabsContent>
            </Tabs>
        </PageShell>
    );
}
