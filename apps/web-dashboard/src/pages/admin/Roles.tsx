import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from '@felix-travel/ui';
import { KeyRound, Shield, ShieldCheck, Users, X } from 'lucide-react';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, getErrorMessage } from '../../lib/admin-utils.js';
import {
    DataTable,
    DataTableEmpty,
    EmptyBlock,
    EntityCell,
    Field,
    InfoCard,
    InfoGrid,
    Notice,
    PageHeader,
    PageShell,
    SearchField,
    SectionCard,
    StatCard,
    StatGrid,
    WorkspaceGrid,
} from '../../components/workspace-ui.js';

/* ─── helpers ─── */

function familyBadge(slug: string): 'info' | 'warning' | 'success' | 'secondary' | 'destructive' {
    if (slug.includes('admin') || slug.includes('super')) return 'destructive';
    if (slug.includes('finance') || slug.includes('payout') || slug.includes('refund')) return 'warning';
    if (slug.includes('provider')) return 'success';
    if (slug.includes('agent') || slug.includes('ops') || slug.includes('operations')) return 'info';
    return 'secondary';
}

function groupColor(group: string): 'info' | 'warning' | 'success' | 'secondary' | 'destructive' {
    const g = group.toLowerCase();
    if (g.includes('admin')) return 'destructive';
    if (g.includes('finance') || g.includes('ledger') || g.includes('payout') || g.includes('refund')) return 'warning';
    if (g.includes('provider') || g.includes('catalog')) return 'success';
    if (g.includes('booking') || g.includes('risk')) return 'info';
    return 'secondary';
}

/* ─── Component ─── */

export function AdminRoles() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('roles');
    const [search, setSearch] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [addPermissionId, setAddPermissionId] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    /* ─ queries ─ */

    const { data: rolesRaw = [], isLoading: rolesLoading } = useQuery({
        queryKey: ['admin-roles'],
        queryFn: () => apiClient.admin.listRoles(),
    });
    const roles = (Array.isArray(rolesRaw) ? rolesRaw : (rolesRaw as any)?.data ?? []) as any[];

    const { data: permissionsRaw = [], isLoading: permsLoading } = useQuery({
        queryKey: ['admin-permissions'],
        queryFn: () => apiClient.admin.listPermissions(),
    });
    const allPermissions = (Array.isArray(permissionsRaw) ? permissionsRaw : (permissionsRaw as any)?.data ?? []) as any[];

    const { data: rolePermsRaw = [] } = useQuery({
        queryKey: ['admin-role-permissions', selectedRoleId],
        queryFn: () => apiClient.admin.getRolePermissions(selectedRoleId!),
        enabled: Boolean(selectedRoleId),
    });
    const rolePermissions = (Array.isArray(rolePermsRaw) ? rolePermsRaw : (rolePermsRaw as any)?.data ?? []) as any[];

    /* ─ derived ─ */

    const selectedRole = roles.find((r: any) => r.id === selectedRoleId) ?? null;
    const activeRoles = roles.filter((r: any) => r.isActive).length;
    const permGroups = useMemo(() => {
        const groups = new Map<string, any[]>();
        for (const p of allPermissions) {
            const g = p.group ?? 'General';
            if (!groups.has(g)) groups.set(g, []);
            groups.get(g)!.push(p);
        }
        return groups;
    }, [allPermissions]);

    const filteredRoles = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return roles;
        return roles.filter((r: any) => [r.slug, r.name, r.description].some((v) => String(v).toLowerCase().includes(q)));
    }, [roles, search]);

    const filteredPermissions = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return allPermissions;
        return allPermissions.filter((p: any) => [p.code, p.name, p.group].some((v) => String(v).toLowerCase().includes(q)));
    }, [allPermissions, search]);

    const assignedPermissionIds = new Set(rolePermissions.map((rp: any) => rp.permissionId));
    const unassignedPermissions = allPermissions.filter((p: any) => !assignedPermissionIds.has(p.id));

    /* ─ mutations ─ */

    const grantMutation = useMutation({
        mutationFn: async () => {
            if (!selectedRoleId || !addPermissionId) throw new Error('Select role and permission');
            return apiClient.admin.addPermissionToRole(selectedRoleId, addPermissionId);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['admin-role-permissions', selectedRoleId] });
            setAddPermissionId('');
            setMessage('Permission granted.'); setErrorMsg(null);
        },
        onError: (e) => setErrorMsg(getErrorMessage(e)),
    });

    const revokeMutation = useMutation({
        mutationFn: async (permissionId: string) => {
            if (!selectedRoleId) throw new Error('Select a role');
            return apiClient.admin.removePermissionFromRole(selectedRoleId, permissionId);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['admin-role-permissions', selectedRoleId] });
            setMessage('Permission revoked.'); setErrorMsg(null);
        },
        onError: (e) => setErrorMsg(getErrorMessage(e)),
    });

    return (
        <PageShell>
            <PageHeader
                eyebrow="Access control"
                title="Roles & Permissions"
                description="Manage roles, capabilities, and permissions."
            />

            {(message || errorMsg) && (
                <Notice message={errorMsg ?? message ?? ''} variant={errorMsg ? 'destructive' : 'success'} />
            )}

            <StatGrid>
                <StatCard label="Roles" value={roles.length} hint={`${activeRoles} active`} icon={Shield} />
                <StatCard label="Permissions" value={allPermissions.length} hint={`${permGroups.size} groups`} icon={KeyRound} tone="info" />
                <StatCard label="Selected role" value={selectedRole?.name ?? '—'} hint={selectedRole ? `${rolePermissions.length} permissions assigned` : 'Select a role'} icon={ShieldCheck} tone="warning" />
                <StatCard label="Exclusive roles" value={roles.filter((r: any) => r.isExclusive).length} hint="Cannot be combined" icon={Users} />
            </StatGrid>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-6">
                    <TabsTrigger value="roles">Roles</TabsTrigger>
                    <TabsTrigger value="permissions">All Permissions</TabsTrigger>
                </TabsList>

                {/* ═══ TAB 1: Roles ═══ */}
                <TabsContent value="roles">
                    <WorkspaceGrid
                        main={
                            <SectionCard
                                title="Role catalog"
                                description="Select a role to manage its permissions."
                                action={<SearchField value={search} onChange={setSearch} placeholder="Search roles" />}
                            >
                                <DataTable headers={['Role', 'Slug', 'Flags', 'Created']}>
                                    {rolesLoading && <DataTableEmpty colSpan={4} label="Loading roles..." />}
                                    {!rolesLoading && filteredRoles.length === 0 && <DataTableEmpty colSpan={4} label="No roles found." />}
                                    {filteredRoles.map((r: any) => (
                                        <tr key={r.id}
                                            className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40 ${r.id === selectedRoleId ? 'bg-primary/5' : ''}`}
                                            onClick={() => setSelectedRoleId(r.id)}>
                                            <td className="p-4">
                                                <EntityCell title={r.name} subtitle={r.description || 'No description'} />
                                            </td>
                                            <td className="p-4">
                                                <Badge variant={familyBadge(r.slug)}>{r.slug}</Badge>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-1.5">
                                                    <Badge variant={r.isActive ? 'success' : 'destructive'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
                                                    {r.isExclusive && <Badge variant="warning">Exclusive</Badge>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-muted-foreground">{formatDate(r.createdAt)}</td>
                                        </tr>
                                    ))}
                                </DataTable>
                            </SectionCard>
                        }
                        side={
                            selectedRole ? (
                                <SectionCard
                                    title={`Permissions for ${selectedRole.name}`}
                                    description={`${rolePermissions.length} permissions assigned to this role.`}
                                >
                                    <div className="space-y-5">
                                        {/* Assigned permissions */}
                                        {rolePermissions.length === 0 ? (
                                            <EmptyBlock title="No permissions" description="Grant permissions from the catalog below." />
                                        ) : (
                                            <div className="space-y-2">
                                                {rolePermissions.map((rp: any) => (
                                                    <div key={rp.permissionId} className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-3">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-xs font-semibold text-foreground">{rp.code}</span>
                                                                <Badge variant={groupColor(rp.group)} className="text-[10px]">{rp.group}</Badge>
                                                            </div>
                                                            <div className="mt-0.5 text-xs text-muted-foreground">{rp.name}</div>
                                                        </div>
                                                        <Button variant="ghost" size="sm" onClick={() => void revokeMutation.mutateAsync(rp.permissionId)} loading={revokeMutation.isPending}>
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Grant new permission */}
                                        {unassignedPermissions.length > 0 && (
                                            <div className="space-y-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
                                                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Grant permission</div>
                                                <Field label="Permission">
                                                    <Select value={addPermissionId || '__none'} onValueChange={(v) => setAddPermissionId(v === '__none' ? '' : v)}>
                                                        <SelectTrigger><SelectValue placeholder="Select permission" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="__none">Select permission</SelectItem>
                                                            {unassignedPermissions.map((p: any) => (
                                                                <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </Field>
                                                <Button variant="outline" size="sm" disabled={!addPermissionId} onClick={() => void grantMutation.mutateAsync()} loading={grantMutation.isPending}>
                                                    Grant
                                                </Button>
                                            </div>
                                        )}

                                        <InfoGrid>
                                            <InfoCard label="Slug" value={selectedRole.slug} />
                                            <InfoCard label="Exclusive" value={selectedRole.isExclusive ? 'Yes' : 'No'} />
                                            <InfoCard label="Status" value={selectedRole.isActive ? 'Active' : 'Inactive'} />
                                            <InfoCard label="Created" value={formatDate(selectedRole.createdAt)} />
                                        </InfoGrid>
                                    </div>
                                </SectionCard>
                            ) : (
                                <SectionCard title="Role detail" description="Select a role from the catalog to manage permissions.">
                                    <EmptyBlock title="No role selected" description="Click a role to see details and permissions." />
                                </SectionCard>
                            )
                        }
                    />
                </TabsContent>

                {/* ═══ TAB 2: All Permissions ═══ */}
                <TabsContent value="permissions">
                    <SectionCard
                        title="Permission catalog"
                        description="All capabilities grouped by functional area."
                        action={<SearchField value={search} onChange={setSearch} placeholder="Search permissions" />}
                    >
                        <DataTable headers={['Permission', 'Code', 'Group', 'Description']}>
                            {permsLoading && <DataTableEmpty colSpan={4} label="Loading permissions..." />}
                            {!permsLoading && filteredPermissions.length === 0 && <DataTableEmpty colSpan={4} label="No permissions found." />}
                            {filteredPermissions.map((p: any) => (
                                <tr key={p.id} className="border-b border-border/60">
                                    <td className="p-4">
                                        <div className="text-sm font-semibold text-foreground">{p.name}</div>
                                    </td>
                                    <td className="p-4 font-mono text-xs text-muted-foreground">{p.code}</td>
                                    <td className="p-4"><Badge variant={groupColor(p.group)}>{p.group}</Badge></td>
                                    <td className="p-4 text-sm text-muted-foreground">{p.description || '—'}</td>
                                </tr>
                            ))}
                        </DataTable>
                    </SectionCard>
                </TabsContent>
            </Tabs>
        </PageShell>
    );
}
