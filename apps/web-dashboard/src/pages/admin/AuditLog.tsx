import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { Badge, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@felix-travel/ui';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, titleizeToken } from '../../lib/admin-utils.js';
import {
  DataTable,
  DataTableEmpty,
  EntityCell,
  InfoCard,
  InfoGrid,
  PageHeader,
  PageShell,
  SectionCard,
  Toolbar,
  WorkspaceGrid,
} from '../../components/workspace-ui.js';

export function AdminAuditLog() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('all');
  const [entityIdFilter, setEntityIdFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', page, entityType, entityIdFilter],
    queryFn: () =>
      apiClient.admin.getAuditLog({
        page,
        ...(entityType !== 'all' ? { entityType } : {}),
        ...(entityIdFilter.trim() ? { entityId: entityIdFilter.trim() } : {}),
      }),
  });

  const logs = (data?.logs ?? []) as any[];
  const total = data?.meta?.total ?? logs.length;
  const selected = logs.find((e: any) => e.id === selectedId) ?? null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="Audit log"
        description="Immutable timeline of every significant action performed in the system."
      />

      <WorkspaceGrid
        main={
          <SectionCard title="Event stream" description="Click any row to inspect the full event payload.">
            <Toolbar>
              <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Entity type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  <SelectItem value="booking">Booking</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="payout">Payout</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="provider">Provider</SelectItem>
                  <SelectItem value="listing">Listing</SelectItem>
                  <SelectItem value="charge">Charge</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={entityIdFilter}
                onChange={(e) => { setEntityIdFilter(e.target.value); setPage(1); }}
                placeholder="Filter by entity ID…"
                className="w-[280px]"
              />
            </Toolbar>
            <DataTable headers={['Timestamp', 'Actor', 'Role', 'Action', 'Entity']}>
              {logs.map((e: any) => (
                <tr key={e.id} className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40 ${selectedId === e.id ? 'bg-primary/5' : ''}`} onClick={() => setSelectedId(selectedId === e.id ? null : e.id)}>
                  <td className="p-4 font-mono text-xs text-muted-foreground">{formatDate(e.createdAt)}</td>
                  <td className="p-4"><EntityCell title={e.actorId?.slice(-8) ?? 'system'} subtitle={e.actorRole ?? '—'} /></td>
                  <td className="p-4"><Badge variant="neutral">{e.actorRole ?? '—'}</Badge></td>
                  <td className="p-4 font-mono text-xs text-primary">{e.action}</td>
                  <td className="p-4 text-xs text-muted-foreground">{e.entityType}:{e.entityId?.slice(-8)}</td>
                </tr>
              ))}
              {logs.length === 0 && <DataTableEmpty colSpan={5} label={isLoading ? 'Loading events…' : 'No audit events match the current filter.'} />}
            </DataTable>
            {total > 25 && (
              <div className="flex items-center justify-end gap-3 border-t border-border/50 px-4 py-3">
                <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setPage((pg) => Math.max(1, pg - 1))} disabled={page === 1}>Previous</button>
                <span className="text-sm text-muted-foreground">Page {page}</span>
                <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setPage((pg) => pg + 1)} disabled={logs.length < 25}>Next</button>
              </div>
            )}
          </SectionCard>
        }
        side={
          selected ? (
            <div className="space-y-6">
              <SectionCard title="Event detail" description={`${selected.action}`}>
                <InfoGrid>
                  <InfoCard label="Action" value={<span className="font-mono text-xs text-primary">{selected.action}</span>} />
                  <InfoCard label="Actor" value={<span className="font-mono text-xs">{selected.actorId}</span>} />
                  <InfoCard label="Role" value={<Badge variant="neutral">{selected.actorRole ?? '—'}</Badge>} />
                  <InfoCard label="Entity type" value={titleizeToken(selected.entityType ?? '—')} />
                  <InfoCard label="Entity ID" value={<span className="font-mono text-xs">{selected.entityId}</span>} />
                  <InfoCard label="Timestamp" value={formatDate(selected.createdAt)} />
                  {selected.ipAddress && <InfoCard label="IP address" value={selected.ipAddress} />}
                  {selected.userAgent && <InfoCard label="User agent" value={<span className="text-xs break-all">{selected.userAgent}</span>} />}
                </InfoGrid>
              </SectionCard>
              {selected.metadata && (
                <SectionCard title="Metadata" description="Raw event payload.">
                  <pre className="max-h-64 overflow-auto rounded-lg bg-muted/50 p-4 text-xs font-mono whitespace-pre-wrap break-all">
                    {typeof selected.metadata === 'string' ? selected.metadata : JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </SectionCard>
              )}
              {selected.changes && (
                <SectionCard title="Changes" description="Before/after state diff.">
                  <pre className="max-h-64 overflow-auto rounded-lg bg-muted/50 p-4 text-xs font-mono whitespace-pre-wrap break-all">
                    {typeof selected.changes === 'string' ? selected.changes : JSON.stringify(selected.changes, null, 2)}
                  </pre>
                </SectionCard>
              )}
            </div>
          ) : (
            <SectionCard title="Detail" description="Select an event to inspect its full payload.">
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <ScrollText className="mr-2 h-5 w-5 opacity-40" /> Click a row to view detail
              </div>
            </SectionCard>
          )
        }
      />
    </PageShell>
  );
}
