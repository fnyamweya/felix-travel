import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldOff, ShieldPlus, Users } from 'lucide-react';
import { inviteCreateSchema } from '@felix-travel/validation';
import { Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@felix-travel/ui';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, getErrorMessage, titleizeToken } from '../../lib/admin-utils.js';
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
  TextField,
  WorkspaceGrid,
} from '../../components/workspace-ui.js';

type AccessFormState = {
  inviteEmail: string;
  inviteRole: 'agent' | 'service_provider';
  inviteProviderId: string;
  assignRole: 'agent' | 'service_provider';
  assignProviderId: string;
};

type AdminUser = {
  id: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
};

const INITIAL_FORM: AccessFormState = {
  inviteEmail: '',
  inviteRole: 'agent',
  inviteProviderId: '',
  assignRole: 'agent',
  assignProviderId: '',
};

export function AdminCustomers() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [form, setForm] = useState<AccessFormState>(INITIAL_FORM);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.admin.listUsers({ pageSize: 100 }),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['admin-providers'],
    queryFn: () => apiClient.providers.list(),
  });

  const users = (usersData?.users ?? []) as AdminUser[];
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  const filteredUsers = useMemo(() => {
    const search = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = !search || [user.email, user.phone ?? '', user.role, user.id].some((value) => value.toLowerCase().includes(search));
      const matchesStatus = status === 'all' || (status === 'active' ? user.isActive : !user.isActive);
      return matchesQuery && matchesStatus;
    });
  }, [users, query, status]);

  const accessUsers = users.filter((user) => user.role === 'agent' || user.role === 'service_provider').length;
  const disabledUsers = users.filter((user) => !user.isActive).length;
  const providerUsers = users.filter((user) => user.role === 'service_provider').length;

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        email: form.inviteEmail.trim(),
        role: form.inviteRole,
        providerId: form.inviteRole === 'service_provider' ? form.inviteProviderId || undefined : undefined,
      };
      const parsed = inviteCreateSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid invite');
      return apiClient.http.post('/v1/admin/invites', parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setForm((current) => ({ ...current, inviteEmail: '', inviteProviderId: '' }));
      setMessage('Invite sent successfully.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const roleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) throw new Error('Select a user first.');
      if (form.assignRole === 'service_provider' && !form.assignProviderId) {
        throw new Error('A provider assignment is required for service provider access.');
      }
      return apiClient.http.post(`/v1/admin/users/${selectedUserId}/roles`, {
        roleSlug: form.assignRole,
        providerId: form.assignRole === 'service_provider' ? form.assignProviderId : undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setMessage('Role assigned successfully.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const accountMutation = useMutation({
    mutationFn: async (nextState: 'enable' | 'disable') => {
      if (!selectedUserId) throw new Error('Select a user first.');
      return apiClient.http.post(`/v1/admin/users/${selectedUserId}/${nextState}`);
    },
    onSuccess: async (_, nextState) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setMessage(nextState === 'enable' ? 'User enabled.' : 'User disabled.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Access domain"
        title="Access management"
        description="Invite, manage, and suspend user accounts."
      />

      {(message || errorMessage) ? (
        <Notice message={errorMessage ?? message ?? ''} variant={errorMessage ? 'destructive' : 'success'} />
      ) : null}

      <StatGrid>
        <StatCard label="Users" value={users.length} hint={`${accessUsers} with operational roles`} icon={Users} />
        <StatCard label="Disabled" value={disabledUsers} hint="Blocked from sign-in" icon={ShieldOff} tone="warning" />
        <StatCard label="Provider users" value={providerUsers} hint="Linked to a provider" icon={ShieldPlus} tone="info" />
        <StatCard label="Providers" value={providers.length} hint="Available for assignment" icon={KeyRound} />
      </StatGrid>

      <WorkspaceGrid
        main={
          <SectionCard
            title="User roster"
            description="Filter accounts by state, then select one to manage."
            action={
              <div className="flex flex-wrap gap-3">
                <SearchField value={query} onChange={setQuery} placeholder="Search email, role, phone, or ID" />
                <div className="min-w-[180px]">
                  <Select value={status} onValueChange={(value) => setStatus(value as 'all' | 'active' | 'disabled')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            }
          >
            <DataTable headers={['User', 'Role', 'Contact', 'Status', 'Joined']}>
              {isLoading && <DataTableEmpty colSpan={5} label="Loading users..." />}
              {!isLoading && filteredUsers.length === 0 && <DataTableEmpty colSpan={5} label="No users match the current filters." />}
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className={user.id === selectedUserId ? 'border-b border-border/60 bg-primary/5' : 'border-b border-border/60'}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <td className="cursor-pointer p-4">
                    <EntityCell title={user.email} subtitle={user.id.slice(-8)} />
                  </td>
                  <td className="p-4"><Badge variant="secondary">{titleizeToken(user.role)}</Badge></td>
                  <td className="p-4 text-sm text-muted-foreground">{user.phone ?? 'No phone set'}</td>
                  <td className="p-4">
                    <Badge variant={user.isActive ? 'success' : 'destructive'}>
                      {user.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </DataTable>
          </SectionCard>
        }
        side={
          <div className="space-y-6">
            <SectionCard
              title="Invite operator"
              description="Send access invites for agents or provider-side teammates."
              action={
                <Button onClick={() => void inviteMutation.mutateAsync()} loading={inviteMutation.isPending}>
                  Send invite
                </Button>
              }
            >
              <div className="grid gap-4">
                <TextField
                  label="Email"
                  value={form.inviteEmail}
                  onChange={(event) => setForm((current) => ({ ...current, inviteEmail: event.target.value }))}
                  placeholder="teammate@felix.travel"
                />
                <Field label="Role">
                  <Select value={form.inviteRole} onValueChange={(value) => setForm((current) => ({ ...current, inviteRole: value as 'agent' | 'service_provider' }))}>
                    <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="service_provider">Service provider</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Provider context">
                  <Select
                    value={form.inviteProviderId || '__none'}
                    onValueChange={(value) => setForm((current) => ({ ...current, inviteProviderId: value === '__none' ? '' : value }))}
                    disabled={form.inviteRole !== 'service_provider'}
                  >
                    <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Select provider</SelectItem>
                      {providers.map((provider: any) => (
                        <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              title="Selected user"
              description="Manage role or account state for the selected user."
              action={selectedUser ? <Badge variant="info">{titleizeToken(selectedUser.role)}</Badge> : null}
            >
              {!selectedUser ? (
                <EmptyBlock title="Pick a user from the roster" description="Select a user to manage roles and account state." />
              ) : (
                <div className="space-y-5">
                  <InfoGrid>
                    <InfoCard label="Email" value={selectedUser.email} />
                    <InfoCard label="Role" value={titleizeToken(selectedUser.role)} />
                    <InfoCard label="Phone" value={selectedUser.phone ?? 'Not set'} />
                    <InfoCard label="Joined" value={formatDate(selectedUser.createdAt)} />
                  </InfoGrid>

                  <div className="grid gap-4">
                    <Field label="Assign role">
                      <Select value={form.assignRole} onValueChange={(value) => setForm((current) => ({ ...current, assignRole: value as 'agent' | 'service_provider' }))}>
                        <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agent">Agent</SelectItem>
                          <SelectItem value="service_provider">Service provider</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Provider context">
                      <Select
                        value={form.assignProviderId || '__none'}
                        onValueChange={(value) => setForm((current) => ({ ...current, assignProviderId: value === '__none' ? '' : value }))}
                        disabled={form.assignRole !== 'service_provider'}
                      >
                        <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Select provider</SelectItem>
                          {providers.map((provider: any) => (
                            <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={() => void roleMutation.mutateAsync()} loading={roleMutation.isPending}>
                      Assign role
                    </Button>
                    <Button
                      variant={selectedUser.isActive ? 'destructive' : 'default'}
                      onClick={() => void accountMutation.mutateAsync(selectedUser.isActive ? 'disable' : 'enable')}
                      loading={accountMutation.isPending}
                    >
                      {selectedUser.isActive ? 'Disable account' : 'Enable account'}
                    </Button>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        }
      />
    </PageShell>
  );
}
