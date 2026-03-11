import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    MoreHorizontal,
    Plus,
    Shield,
    UserCog,
    UserPlus,
    Users,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, titleizeToken, getErrorMessage } from '../../lib/admin-utils.js';
import {
    DataTable,
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
} from '../../components/workspace-ui.js';
import {
    ActionMenu,
    FilterChips,
    SidePanel,
    TableSkeleton,
} from '../../components/interaction-framework.js';

/* ─── helpers ─── */

function roleVariant(role: string): 'info' | 'warning' | 'success' | 'secondary' | 'destructive' {
    switch (role) {
        case 'admin': return 'destructive';
        case 'agent': return 'warning';
        case 'service_provider': return 'info';
        case 'customer': return 'success';
        default: return 'secondary';
    }
}

/* ─── Component ─── */

export function AdminUsers() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('__all');
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [assignRoleSlug, setAssignRoleSlug] = useState('');

    /* ─ queries ─ */
    const { data: usersRaw = [], isLoading: usersLoading } = useQuery({
        queryKey: ['admin-users'],
        queryFn: () => apiClient.admin.listUsers(),
    });
    const users = (Array.isArray(usersRaw) ? usersRaw : (usersRaw as any)?.data ?? []) as any[];

    const { data: rolesRaw = [] } = useQuery({
        queryKey: ['admin-roles'],
        queryFn: () => apiClient.admin.listRoles(),
    });
    const roles = (Array.isArray(rolesRaw) ? rolesRaw : (rolesRaw as any)?.data ?? []) as any[];

    const { data: userRolesRaw = [] } = useQuery({
        queryKey: ['admin-user-roles', selectedUser?.id],
        queryFn: () => apiClient.admin.getUserRoles(selectedUser!.id),
        enabled: Boolean(selectedUser),
    });
    const userRoles = (Array.isArray(userRolesRaw) ? userRolesRaw : (userRolesRaw as any)?.data ?? []) as any[];

    const assignRole = useMutation({
        mutationFn: ({ userId, roleSlug }: { userId: string; roleSlug: string }) =>
            apiClient.admin.assignUserRole(userId, roleSlug),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-user-roles', selectedUser?.id] });
            setAssignRoleSlug('');
        },
    });

    /* ─ derived ─ */
    const filteredUsers = useMemo(() => {
        let list = users;
        if (roleFilter !== '__all') {
            list = list.filter((u: any) => u.role === roleFilter);
        }
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((u: any) =>
                [u.email, u.phone, u.role, u.profile?.firstName, u.profile?.lastName, u.profile?.displayName]
                    .some((v) => v && String(v).toLowerCase().includes(q))
            );
        }
        return list;
    }, [users, roleFilter, search]);

    const countByRole = useMemo(() => {
        const map = new Map<string, number>();
        for (const u of users) {
            map.set(u.role, (map.get(u.role) ?? 0) + 1);
        }
        return map;
    }, [users]);

    const roleFilterOptions = [
        { value: '__all', label: `All (${users.length})` },
        { value: 'admin', label: `Admin (${countByRole.get('admin') ?? 0})` },
        { value: 'agent', label: `Agent (${countByRole.get('agent') ?? 0})` },
        { value: 'service_provider', label: `Provider (${countByRole.get('service_provider') ?? 0})` },
        { value: 'customer', label: `Customer (${countByRole.get('customer') ?? 0})` },
    ];

    function openUserPanel(user: any) {
        setSelectedUser(user);
        setPanelOpen(true);
    }

    const displayName = (u: any) => {
        if (u.profile?.displayName) return u.profile.displayName;
        if (u.profile?.firstName) return `${u.profile.firstName} ${u.profile.lastName ?? ''}`.trim();
        return u.email?.split('@')[0] ?? 'Unknown';
    };

    return (
        <PageShell>
            <PageHeader
                eyebrow="Settings"
                title="Users"
                description="Manage platform users, roles, and permissions."
            />

            <StatGrid>
                <StatCard label="Total Users" value={users.length} icon={Users} />
                <StatCard label="Admins" value={countByRole.get('admin') ?? 0} icon={Shield} tone="warning" />
                <StatCard label="Providers" value={countByRole.get('service_provider') ?? 0} icon={UserCog} tone="info" />
                <StatCard label="Customers" value={countByRole.get('customer') ?? 0} icon={UserPlus} tone="success" />
            </StatGrid>

            <SectionCard
                title="All Users"
                description={`${filteredUsers.length} user${filteredUsers.length !== 1 ? 's' : ''}`}
                action={
                    <SearchField value={search} onChange={setSearch} placeholder="Search users..." />
                }
            >
                <div className="mb-4">
                    <FilterChips options={roleFilterOptions} value={roleFilter} onChange={setRoleFilter} />
                </div>

                {usersLoading ? (
                    <TableSkeleton rows={8} cols={6} />
                ) : filteredUsers.length === 0 ? (
                    <EmptyBlock title="No users found" description="Adjust your search or filters." />
                ) : (
                    <DataTable headers={['User', 'Email', 'Phone', 'Role', 'Status', 'Joined', '']}>
                        {filteredUsers.map((u: any) => (
                            <tr
                                key={u.id}
                                className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40"
                                onClick={() => openUserPanel(u)}
                            >
                                <td className="p-4">
                                    <EntityCell
                                        title={displayName(u)}
                                        subtitle={u.id.slice(-8)}
                                    />
                                </td>
                                <td className="p-4 text-sm">{u.email}</td>
                                <td className="p-4 text-sm text-muted-foreground">{u.phone ?? '—'}</td>
                                <td className="p-4">
                                    <Badge variant={roleVariant(u.role)}>{titleizeToken(u.role)}</Badge>
                                </td>
                                <td className="p-4">
                                    <Badge variant={u.isActive ? 'success' : 'secondary'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                                </td>
                                <td className="p-4 text-sm text-muted-foreground">{formatDate(u.createdAt)}</td>
                                <td className="p-4">
                                    <ActionMenu
                                        trigger={
                                            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        }
                                        items={[
                                            { label: 'View Details', onClick: () => openUserPanel(u) },
                                            { label: 'Manage Roles', onClick: () => openUserPanel(u) },
                                        ]}
                                    />
                                </td>
                            </tr>
                        ))}
                    </DataTable>
                )}
            </SectionCard>

            {/* ─── User Detail Side Panel ─── */}
            <SidePanel
                open={panelOpen}
                onOpenChange={setPanelOpen}
                title={selectedUser ? displayName(selectedUser) : 'User Details'}
                description={selectedUser?.email ?? ''}
            >
                {selectedUser && (
                    <div className="space-y-6">
                        {/* User info */}
                        <SectionCard title="Profile">
                            <InfoGrid>
                                <InfoCard label="Name" value={displayName(selectedUser)} />
                                <InfoCard label="Email" value={selectedUser.email} />
                                <InfoCard label="Phone" value={selectedUser.phone ?? 'Not set'} />
                                <InfoCard label="Role" value={titleizeToken(selectedUser.role)} />
                                <InfoCard label="Status" value={selectedUser.isActive ? 'Active' : 'Inactive'} />
                                <InfoCard label="Joined" value={formatDate(selectedUser.createdAt)} />
                                {selectedUser.profile?.nationality && (
                                    <InfoCard label="Nationality" value={selectedUser.profile.nationality} />
                                )}
                            </InfoGrid>
                        </SectionCard>

                        {/* Assigned roles */}
                        <SectionCard title="Assigned Roles" description="RBAC roles granted to this user">
                            {userRoles.length === 0 ? (
                                <div className="py-3 text-sm text-muted-foreground">No additional roles assigned.</div>
                            ) : (
                                <div className="space-y-2">
                                    {userRoles.map((r: any) => (
                                        <div key={r.id ?? r.roleId} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <Shield className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm font-medium">{r.roleSlug ?? r.role?.slug ?? 'Unknown'}</span>
                                            </div>
                                            {r.providerId && (
                                                <Badge variant="secondary" className="text-[10px]">Provider: {r.providerId.slice(-8)}</Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Assign new role */}
                            <div className="mt-4 flex items-end gap-2">
                                <div className="flex-1">
                                    <Field label="Add role">
                                        <Select value={assignRoleSlug || '__none'} onValueChange={(v) => setAssignRoleSlug(v === '__none' ? '' : v)}>
                                            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none">Select role</SelectItem>
                                                {roles.map((r: any) => (
                                                    <SelectItem key={r.id} value={r.slug}>{r.slug}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                </div>
                                <Button
                                    size="sm"
                                    disabled={!assignRoleSlug || assignRole.isPending}
                                    onClick={() => {
                                        if (assignRoleSlug && selectedUser) {
                                            assignRole.mutate({ userId: selectedUser.id, roleSlug: assignRoleSlug });
                                        }
                                    }}
                                >
                                    <Plus className="mr-1 h-3.5 w-3.5" /> Assign
                                </Button>
                            </div>
                            {assignRole.error && (
                                <div className="mt-2 text-sm text-destructive">
                                    {getErrorMessage(assignRole.error)}
                                </div>
                            )}
                        </SectionCard>
                    </div>
                )}
            </SidePanel>
        </PageShell>
    );
}
