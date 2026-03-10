import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Badge, Button, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@felix-travel/ui';
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
  s === 'succeeded' ? 'success' : s === 'rejected' ? 'destructive' : s === 'approved' ? 'info' : 'warning';

export function AdminRefunds() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-refunds', page, status],
    queryFn: () => apiClient.admin.listRefunds({ page, pageSize: 25, ...(status !== 'all' ? { status } : {}) }),
  });

  const { data: chargeLines } = useQuery({
    queryKey: ['refund-charge-lines', selectedId],
    queryFn: () => apiClient.charges.getRefundChargeLines(selectedId!),
    enabled: Boolean(selectedId),
  });

  const approveMutation = useMutation({
    mutationFn: (refundId: string) => apiClient.payments.approveRefund(refundId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-refunds'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ refundId, reason }: { refundId: string; reason: string }) =>
      apiClient.payments.rejectRefund(refundId, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-refunds'] }); setRejectReason(''); },
  });

  const refunds = (data?.refunds ?? []) as any[];
  const total = data?.meta?.total ?? refunds.length;
  const filtered = useMemo(() => status === 'all' ? refunds : refunds.filter((r: any) => r.status === status), [refunds, status]);
  const succeeded = refunds.filter((r: any) => r.status === 'succeeded').length;
  const pendingApproval = refunds.filter((r: any) => r.status === 'pending_approval').length;
  const rejected = refunds.filter((r: any) => r.status === 'rejected').length;
  const selected = refunds.find((r: any) => r.id === selectedId) ?? null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="Refund operations"
        description="Review, approve and reject refund requests across all providers."
      />

      <StatGrid>
        <StatCard label="Total refunds" value={total} hint="All-time refund count" icon={RotateCcw} />
        <StatCard label="Succeeded" value={succeeded} hint="Successfully refunded" icon={CheckCircle2} tone="success" />
        <StatCard label="Pending approval" value={pendingApproval} hint="Awaiting admin review" icon={Clock} tone="warning" />
        <StatCard label="Rejected" value={rejected} hint="Declined refund requests" icon={XCircle} tone="info" />
      </StatGrid>

      <WorkspaceGrid
        main={
          <SectionCard title="All refunds" description="Click any row to inspect refund detail and charge reversals.">
            <Toolbar>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="succeeded">Succeeded</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </Toolbar>
            <DataTable headers={['Booking', 'Reason', 'Amount', 'Status', 'Requested']}>
              {filtered.map((r: any) => (
                <tr key={r.id} className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40 ${selectedId === r.id ? 'bg-primary/5' : ''}`} onClick={() => { setSelectedId(selectedId === r.id ? null : r.id); setRejectReason(''); }}>
                  <td className="p-4"><EntityCell title={r.bookingId?.slice(-8) ?? '—'} subtitle={r.id.slice(-8)} /></td>
                  <td className="p-4 text-sm text-muted-foreground">{r.reason ?? '—'}</td>
                  <td className="p-4 text-sm font-medium text-foreground">{formatMoney(r.amount, r.currencyCode)}</td>
                  <td className="p-4"><Badge variant={statusVariant(r.status)}>{titleizeToken(r.status)}</Badge></td>
                  <td className="p-4 text-sm text-muted-foreground">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <DataTableEmpty colSpan={5} label={isLoading ? 'Loading refunds…' : 'No refunds match the current filter.'} />}
            </DataTable>
            {total > 25 && (
              <div className="flex items-center justify-end gap-3 border-t border-border/50 px-4 py-3">
                <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setPage((pg) => Math.max(1, pg - 1))} disabled={page === 1}>Previous</button>
                <span className="text-sm text-muted-foreground">Page {page}</span>
                <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setPage((pg) => pg + 1)} disabled={refunds.length < 25}>Next</button>
              </div>
            )}
          </SectionCard>
        }
        side={
          selected ? (
            <div className="space-y-6">
              <SectionCard title="Refund detail" description={`ID …${selected.id.slice(-8)}`}>
                <InfoGrid>
                  <InfoCard label="Status" value={<Badge variant={statusVariant(selected.status)}>{titleizeToken(selected.status)}</Badge>} />
                  <InfoCard label="Booking" value={<span className="font-mono text-xs">{selected.bookingId}</span>} />
                  <InfoCard label="Amount" value={formatMoney(selected.amount, selected.currencyCode)} />
                  <InfoCard label="Currency" value={selected.currencyCode} />
                  <InfoCard label="Reason" value={selected.reason ?? '—'} />
                  <InfoCard label="Requested" value={formatDate(selected.createdAt)} />
                  {selected.approvedAt && <InfoCard label="Approved" value={formatDate(selected.approvedAt)} />}
                  {selected.rejectedAt && <InfoCard label="Rejected" value={formatDate(selected.rejectedAt)} />}
                  {selected.rejectionReason && <InfoCard label="Rejection reason" value={selected.rejectionReason} />}
                </InfoGrid>
                {selected.status === 'pending_approval' && (
                  <div className="mt-4 space-y-3">
                    <div className="flex gap-2">
                      <Button onClick={() => approveMutation.mutate(selected.id)} disabled={approveMutation.isPending}>
                        {approveMutation.isPending ? 'Approving…' : 'Approve'}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Enter rejection reason…"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                      />
                      <Button
                        variant="destructive"
                        onClick={() => rejectMutation.mutate({ refundId: selected.id, reason: rejectReason })}
                        disabled={rejectMutation.isPending || !rejectReason.trim()}
                      >
                        {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
                      </Button>
                    </div>
                  </div>
                )}
              </SectionCard>
              <SectionCard title="Charge reversals" description="Charge lines reversed for this refund.">
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
                  <div className="py-6 text-center text-sm text-muted-foreground">No charge reversals.</div>
                )}
              </SectionCard>
            </div>
          ) : (
            <SectionCard title="Detail" description="Select a refund to review its detail and take action.">
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <RotateCcw className="mr-2 h-5 w-5 opacity-40" /> Click a row to view detail
              </div>
            </SectionCard>
          )
        }
      />
    </PageShell>
  );
}
