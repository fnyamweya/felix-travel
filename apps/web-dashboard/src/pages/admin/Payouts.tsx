import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@felix-travel/ui';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, titleizeToken } from '../../lib/admin-utils.js';
import {
  DataTable,
  DataTableEmpty,
  EntityCell,
  InfoCard,
  InfoGrid,
  PageHeader,
  PageShell,
  SectionCard,
  StatCard,
  StatGrid,
  Toolbar,
  WorkspaceGrid,
} from '../../components/workspace-ui.js';

const statusVariant = (s: string) =>
  s === 'succeeded' ? 'success' : s === 'failed' ? 'destructive' : s === 'processing' ? 'info' : 'warning';

export function AdminPayouts() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runProviderId, setRunProviderId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payouts', page, status],
    queryFn: () => apiClient.admin.listPayouts({ page, pageSize: 25, ...(status !== 'all' ? { status } : {}) }),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['admin-providers'],
    queryFn: () => apiClient.providers.list(),
  });

  const { data: chargeLines } = useQuery({
    queryKey: ['payout-charge-lines', selectedId],
    queryFn: () => apiClient.charges.getPayoutChargeLines(selectedId!),
    enabled: Boolean(selectedId),
  });

  const runMutation = useMutation({
    mutationFn: () => apiClient.payouts.runPayout(runProviderId, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-payouts'] }); setRunProviderId(''); },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.admin.approvePayout(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-payouts'] }),
  });

  const payouts = (data?.payouts ?? []) as any[];
  const total = data?.meta?.total ?? payouts.length;
  const filtered = useMemo(() => status === 'all' ? payouts : payouts.filter((p: any) => p.status === status), [payouts, status]);
  const succeeded = payouts.filter((p: any) => p.status === 'succeeded').length;
  const pending = payouts.filter((p: any) => p.status === 'pending' || p.status === 'pending_approval').length;
  const failed = payouts.filter((p: any) => p.status === 'failed').length;
  const selected = payouts.find((p: any) => p.id === selectedId) ?? null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="Payout operations"
        description="Run, approve and monitor provider settlement payouts."
      />

      <StatGrid>
        <StatCard label="Total payouts" value={total} hint="All-time payout count" icon={Banknote} />
        <StatCard label="Succeeded" value={succeeded} hint="Successfully disbursed" icon={CheckCircle2} tone="success" />
        <StatCard label="Pending" value={pending} hint="Awaiting approval or processing" icon={Clock} tone="warning" />
        <StatCard label="Failed" value={failed} hint="Failed disbursement attempts" icon={AlertTriangle} tone="info" />
      </StatGrid>

      <WorkspaceGrid
        main={
          <SectionCard title="All payouts" description="Click any row to inspect payout detail and charge deductions.">
            <Toolbar>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="pending_approval">Pending approval</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="succeeded">Succeeded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-2">
                <Select value={runProviderId} onValueChange={setRunProviderId}>
                  <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select provider…" /></SelectTrigger>
                  <SelectContent>
                    {(providers as any[]).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending || !runProviderId}>
                  {runMutation.isPending ? 'Running…' : 'Run Payout'}
                </Button>
              </div>
            </Toolbar>
            <DataTable headers={['Provider', 'Amount', 'Status', 'Tingg Ref', 'Created']}>
              {filtered.map((p: any) => (
                <tr key={p.id} className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40 ${selectedId === p.id ? 'bg-primary/5' : ''}`} onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}>
                  <td className="p-4"><EntityCell title={p.providerId} subtitle={p.id.slice(-8)} /></td>
                  <td className="p-4 text-sm font-medium text-foreground">{formatMoney(p.amount, p.currencyCode)}</td>
                  <td className="p-4"><Badge variant={statusVariant(p.status)}>{titleizeToken(p.status)}</Badge></td>
                  <td className="p-4 font-mono text-xs text-muted-foreground">{p.tinggPaymentRef ?? '—'}</td>
                  <td className="p-4 text-sm text-muted-foreground">{formatDate(p.createdAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <DataTableEmpty colSpan={5} label={isLoading ? 'Loading payouts…' : 'No payouts match the current filter.'} />}
            </DataTable>
            {total > 25 && (
              <div className="flex items-center justify-end gap-3 border-t border-border/50 px-4 py-3">
                <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setPage((pg) => Math.max(1, pg - 1))} disabled={page === 1}>Previous</button>
                <span className="text-sm text-muted-foreground">Page {page}</span>
                <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setPage((pg) => pg + 1)} disabled={payouts.length < 25}>Next</button>
              </div>
            )}
          </SectionCard>
        }
        side={
          selected ? (
            <div className="space-y-6">
              <SectionCard title="Payout detail" description={`ID …${selected.id.slice(-8)}`}>
                <InfoGrid>
                  <InfoCard label="Status" value={<Badge variant={statusVariant(selected.status)}>{titleizeToken(selected.status)}</Badge>} />
                  <InfoCard label="Provider" value={<span className="font-mono text-xs">{selected.providerId}</span>} />
                  <InfoCard label="Amount" value={formatMoney(selected.amount, selected.currencyCode)} />
                  <InfoCard label="Currency" value={selected.currencyCode} />
                  <InfoCard label="Tingg Ref" value={selected.tinggPaymentRef ?? '—'} />
                  <InfoCard label="Period end" value={selected.periodEnd ? formatDate(selected.periodEnd) : '—'} />
                  <InfoCard label="Created" value={formatDate(selected.createdAt)} />
                  {selected.processedAt && <InfoCard label="Processed" value={formatDate(selected.processedAt)} />}
                  {selected.failureReason && <InfoCard label="Failure reason" value={selected.failureReason} />}
                </InfoGrid>
                {(selected.status === 'pending' || selected.status === 'pending_approval') && (
                  <div className="mt-4">
                    <Button onClick={() => approveMutation.mutate(selected.id)} disabled={approveMutation.isPending}>
                      {approveMutation.isPending ? 'Approving…' : 'Approve Payout'}
                    </Button>
                  </div>
                )}
              </SectionCard>
              <SectionCard title="Charge deductions" description="Charge lines applied to this payout.">
                {chargeLines && Array.isArray(chargeLines) && chargeLines.length > 0 ? (
                  <DataTable headers={['Charge', 'Type', 'Amount']}>
                    {chargeLines.map((cl: any, i: number) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="p-3 text-sm">{cl.label ?? cl.chargeDefinitionId}</td>
                        <td className="p-3 text-sm text-muted-foreground">{titleizeToken(cl.calculationType ?? cl.type ?? '—')}</td>
                        <td className="p-3 text-sm font-medium">{formatMoney(cl.amount, selected.currencyCode)}</td>
                      </tr>
                    ))}
                  </DataTable>
                ) : (
                  <div className="py-6 text-center text-sm text-muted-foreground">No charge deductions.</div>
                )}
              </SectionCard>
            </div>
          ) : (
            <SectionCard title="Detail" description="Select a payout to inspect its detail and charge deductions.">
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Banknote className="mr-2 h-5 w-5 opacity-40" /> Click a row to view detail
              </div>
            </SectionCard>
          )
        }
      />
    </PageShell>
  );
}
