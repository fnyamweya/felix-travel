import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inviteCreateSchema } from '@felix-travel/validation';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, getErrorMessage, titleizeToken } from '../../lib/admin-utils.js';

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

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="dashboard-stat-card">
      <span className="dashboard-stat-label">{label}</span>
      <strong className="dashboard-stat-value">{value}</strong>
      <span className="dashboard-stat-hint">{hint}</span>
    </div>
  );
}

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
    <div className="domain-page">
      <div className="domain-page-header">
        <div>
          <span className="eyebrow">Access domain</span>
          <h1 className="page-title">Access management</h1>
          <p className="page-subtitle">
            Manage operational users from one place: invite new teammates, attach provider access, and suspend accounts that should not transact.
          </p>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <StatCard label="Users" value={users.length} hint={`${accessUsers} operational users across admin, agent, and provider roles`} />
        <StatCard label="Disabled" value={disabledUsers} hint="Accounts currently blocked from signing in" />
        <StatCard label="Provider users" value={providerUsers} hint="Users attached to provider-side operations" />
        <StatCard label="Providers" value={providers.length} hint="Available provider contexts for assignments and invites" />
      </div>

      {(message || errorMessage) && (
        <div className={errorMessage ? 'alert-error' : 'alert-success'} style={{ marginBottom: '1rem' }}>
          {errorMessage ?? message}
        </div>
      )}

      <div className="domain-grid">
        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">User roster</h2>
              <p className="section-copy">Filter accounts by state, then select one to assign access or suspend activity.</p>
            </div>
            <div className="toolbar-inline">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search email, role, phone, or ID"
                className="search-input"
              />
              <select value={status} onChange={(event) => setStatus(event.target.value as 'all' | 'active' | 'disabled')} className="compact-select">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>

          <div className="table-container domain-table">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="table-empty">Loading users...</td>
                  </tr>
                )}
                {!isLoading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-empty">No users match the current filters.</td>
                  </tr>
                )}
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className={user.id === selectedUserId ? 'table-row-selected' : ''}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <td>
                      <div className="entity-cell">
                        <strong>{user.email}</strong>
                        <span>{user.id.slice(-8)}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{titleizeToken(user.role)}</span>
                    </td>
                    <td>{user.phone ?? 'No phone set'}</td>
                    <td>
                      <span className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {user.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="workspace-panel workspace-panel-sticky">
          <div className="stack-panel">
            <div className="panel-block">
              <div className="workspace-panel-header">
                <div>
                  <h2 className="section-title">Invite operator</h2>
                  <p className="section-copy">Send access invites for agents or provider-side teammates.</p>
                </div>
              </div>
              <div className="form-grid">
                <label className="field field-span-2">
                  <span>Email</span>
                  <input
                    value={form.inviteEmail}
                    onChange={(event) => setForm((current) => ({ ...current, inviteEmail: event.target.value }))}
                    placeholder="teammate@felix.travel"
                  />
                </label>
                <label className="field">
                  <span>Role</span>
                  <select
                    value={form.inviteRole}
                    onChange={(event) => setForm((current) => ({ ...current, inviteRole: event.target.value as 'agent' | 'service_provider' }))}
                  >
                    <option value="agent">Agent</option>
                    <option value="service_provider">Service provider</option>
                  </select>
                </label>
                <label className="field">
                  <span>Provider</span>
                  <select
                    value={form.inviteProviderId}
                    onChange={(event) => setForm((current) => ({ ...current, inviteProviderId: event.target.value }))}
                    disabled={form.inviteRole !== 'service_provider'}
                  >
                    <option value="">Select provider</option>
                    {providers.map((provider: any) => (
                      <option key={provider.id} value={provider.id}>{provider.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="btn-primary" onClick={() => void inviteMutation.mutateAsync()} disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? 'Sending...' : 'Send invite'}
              </button>
            </div>

            <div className="panel-block">
              <div className="workspace-panel-header">
                <div>
                  <h2 className="section-title">Selected user</h2>
                  <p className="section-copy">Assign another operational role or change account state for the selected user.</p>
                </div>
                {selectedUser && <span className="badge badge-info">{titleizeToken(selectedUser.role)}</span>}
              </div>

              {!selectedUser ? (
                <div className="empty-panel">
                  Pick a user from the roster to manage their access.
                </div>
              ) : (
                <>
                  <div className="detail-grid">
                    <div className="detail-card">
                      <span className="detail-label">Email</span>
                      <strong>{selectedUser.email}</strong>
                    </div>
                    <div className="detail-card">
                      <span className="detail-label">Role</span>
                      <strong>{titleizeToken(selectedUser.role)}</strong>
                    </div>
                    <div className="detail-card">
                      <span className="detail-label">Phone</span>
                      <strong>{selectedUser.phone ?? 'Not set'}</strong>
                    </div>
                    <div className="detail-card">
                      <span className="detail-label">Joined</span>
                      <strong>{formatDate(selectedUser.createdAt)}</strong>
                    </div>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>Assign role</span>
                      <select
                        value={form.assignRole}
                        onChange={(event) => setForm((current) => ({ ...current, assignRole: event.target.value as 'agent' | 'service_provider' }))}
                      >
                        <option value="agent">Agent</option>
                        <option value="service_provider">Service provider</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Provider context</span>
                      <select
                        value={form.assignProviderId}
                        onChange={(event) => setForm((current) => ({ ...current, assignProviderId: event.target.value }))}
                        disabled={form.assignRole !== 'service_provider'}
                      >
                        <option value="">Select provider</option>
                        {providers.map((provider: any) => (
                          <option key={provider.id} value={provider.id}>{provider.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="action-row">
                    <button className="btn-secondary" onClick={() => void roleMutation.mutateAsync()} disabled={roleMutation.isPending}>
                      {roleMutation.isPending ? 'Assigning...' : 'Assign role'}
                    </button>
                    <button
                      className={selectedUser.isActive ? 'btn-danger' : 'btn-primary'}
                      onClick={() => void accountMutation.mutateAsync(selectedUser.isActive ? 'disable' : 'enable')}
                      disabled={accountMutation.isPending}
                    >
                      {accountMutation.isPending ? 'Updating...' : selectedUser.isActive ? 'Disable account' : 'Enable account'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
