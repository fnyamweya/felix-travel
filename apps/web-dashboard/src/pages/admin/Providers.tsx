import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createProviderSchema, updateProviderSchema } from '@felix-travel/validation';
import type { ServiceProvider } from '@felix-travel/types';
import { apiClient } from '../../lib/api-client.js';
import { formatMoney, formatDate, getErrorMessage, toOptionalTrimmed } from '../../lib/admin-utils.js';

type ProviderFormState = {
  name: string;
  slug: string;
  description: string;
  email: string;
  phone: string;
  countryCode: string;
  currencyCode: string;
  websiteUrl: string;
};

const EMPTY_FORM: ProviderFormState = {
  name: '',
  slug: '',
  description: '',
  email: '',
  phone: '',
  countryCode: 'KE',
  currencyCode: 'KES',
  websiteUrl: '',
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

function buildCreatePayload(form: ProviderFormState) {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: toOptionalTrimmed(form.description),
    email: form.email.trim(),
    phone: toOptionalTrimmed(form.phone),
    countryCode: form.countryCode.trim().toUpperCase(),
    currencyCode: form.currencyCode.trim().toUpperCase(),
    websiteUrl: toOptionalTrimmed(form.websiteUrl),
  };
}

function buildUpdatePayload(form: ProviderFormState) {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: toOptionalTrimmed(form.description),
    email: form.email.trim(),
    phone: toOptionalTrimmed(form.phone),
    countryCode: form.countryCode.trim().toUpperCase(),
    currencyCode: form.currencyCode.trim().toUpperCase(),
    websiteUrl: toOptionalTrimmed(form.websiteUrl),
  };
}

function formFromProvider(provider: ServiceProvider): ProviderFormState {
  return {
    name: provider.name,
    slug: provider.slug,
    description: provider.description ?? '',
    email: provider.email,
    phone: provider.phone ?? '',
    countryCode: provider.countryCode,
    currencyCode: provider.currencyCode,
    websiteUrl: provider.websiteUrl ?? '',
  };
}

export function AdminProviders() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<ProviderFormState>(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['admin-providers'],
    queryFn: () => apiClient.providers.list(),
  });

  const firstProvider = providers[0] ?? null;
  const selectedProvider = providers.find((provider: ServiceProvider) => provider.id === selectedProviderId) ?? null;

  useEffect(() => {
    if (!firstProvider) return;
    if (isCreating) return;

    if (!selectedProviderId) {
      setSelectedProviderId(firstProvider.id);
      return;
    }

    if (!selectedProvider) {
      setSelectedProviderId(firstProvider.id);
    }
  }, [firstProvider, selectedProviderId, selectedProvider, isCreating]);

  useEffect(() => {
    if (selectedProvider) {
      setForm(formFromProvider(selectedProvider));
      setFormError(null);
      return;
    }

    setForm(EMPTY_FORM);
  }, [selectedProvider, isCreating]);

  const filteredProviders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return providers;
    return providers.filter((provider: ServiceProvider) =>
      [provider.name, provider.slug, provider.email, provider.countryCode, provider.currencyCode]
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [providers, search]);

  const activeProviders = providers.filter((provider: ServiceProvider) => provider.isActive).length;
  const verifiedProviders = providers.filter((provider: ServiceProvider) => provider.isVerified).length;
  const reserveExposure = providers.reduce((sum: number, provider: ServiceProvider) => sum + provider.reserveBalanceAmount, 0);
  const coverage = new Set(providers.map((provider: ServiceProvider) => provider.countryCode)).size;

  const createProvider = useMutation({
    mutationFn: async () => {
      const payload = buildCreatePayload(form);
      const parsed = createProviderSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid provider input');
      return apiClient.providers.create(parsed.data);
    },
    onSuccess: async (provider) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-providers'] });
      setIsCreating(false);
      setSelectedProviderId(provider.id);
      setNotice(`Created ${provider.name}.`);
      setFormError(null);
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  const updateProvider = useMutation({
    mutationFn: async () => {
      if (!selectedProviderId) throw new Error('Select a provider first.');
      const payload = buildUpdatePayload(form);
      const parsed = updateProviderSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid provider update');
      return apiClient.providers.update(selectedProviderId, parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-providers'] });
      setNotice(`Updated ${form.name}.`);
      setFormError(null);
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  const busy = createProvider.isPending || updateProvider.isPending;

  return (
    <div className="domain-page">
      <div className="domain-page-header">
        <div>
          <span className="eyebrow">Provider domain</span>
          <h1 className="page-title">Provider management</h1>
          <p className="page-subtitle">
            Create provider records, keep commercial details current, and track which markets are active before payouts and bookings hit production.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn-secondary"
            onClick={() => {
              setIsCreating(true);
              setSelectedProviderId(null);
              setForm(EMPTY_FORM);
              setNotice('Ready to add a new provider.');
              setFormError(null);
            }}
          >
            New provider
          </button>
          <button className="btn-primary" onClick={() => void (selectedProvider && !isCreating ? updateProvider.mutateAsync() : createProvider.mutateAsync())} disabled={busy}>
            {busy ? 'Saving...' : selectedProvider && !isCreating ? 'Save changes' : 'Create provider'}
          </button>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <StatCard label="Total providers" value={providers.length} hint={`${activeProviders} active in the marketplace`} />
        <StatCard label="Verified" value={verifiedProviders} hint="Operational providers with verified status" />
        <StatCard label="Reserve exposure" value={formatMoney(reserveExposure)} hint="Outstanding reserve balances across providers" />
        <StatCard label="Country coverage" value={coverage} hint="Distinct country codes in the provider base" />
      </div>

      {(notice || formError) && (
        <div className={formError ? 'alert-error' : 'alert-success'} style={{ marginBottom: '1rem' }}>
          {formError ?? notice}
        </div>
      )}

      <div className="domain-grid">
        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Provider directory</h2>
              <p className="section-copy">Search by name, slug, email, or market. Select a row to edit its core profile.</p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search providers"
              className="search-input"
            />
          </div>

          <div className="table-container domain-table">
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Market</th>
                  <th>Status</th>
                  <th>Reserve</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="table-empty">Loading providers...</td>
                  </tr>
                )}
                {!isLoading && filteredProviders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-empty">No providers match your search.</td>
                  </tr>
                )}
                {filteredProviders.map((provider: ServiceProvider) => (
                  <tr
                    key={provider.id}
                    className={provider.id === selectedProviderId ? 'table-row-selected' : ''}
                    onClick={() => {
                      setIsCreating(false);
                      setSelectedProviderId(provider.id);
                    }}
                  >
                    <td>
                      <div className="entity-cell">
                        <strong>{provider.name}</strong>
                        <span>{provider.email}</span>
                      </div>
                    </td>
                    <td>
                      <div className="entity-cell">
                        <strong>{provider.countryCode}</strong>
                        <span>{provider.currencyCode}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack-inline">
                        <span className={`badge ${provider.isActive ? 'badge-success' : 'badge-neutral'}`}>
                          {provider.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span className={`badge ${provider.isVerified ? 'badge-info' : 'badge-warning'}`}>
                          {provider.isVerified ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    </td>
                    <td>{formatMoney(provider.reserveBalanceAmount, provider.currencyCode)}</td>
                    <td>{formatDate(provider.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="workspace-panel workspace-panel-sticky">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">{selectedProvider && !isCreating ? 'Edit provider' : 'Create provider'}</h2>
              <p className="section-copy">
                Core details are validated against the provider schema before they are sent to the API.
              </p>
            </div>
            {selectedProvider && !isCreating && (
              <span className="badge badge-neutral">ID {selectedProvider.id.slice(-8)}</span>
            )}
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Savannah Air Safaris" />
            </label>
            <label className="field">
              <span>Slug</span>
              <input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="savannah-air-safaris" />
            </label>
            <label className="field">
              <span>Email</span>
              <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="ops@provider.com" />
            </label>
            <label className="field">
              <span>Phone</span>
              <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+254700000000" />
            </label>
            <label className="field">
              <span>Country code</span>
              <input value={form.countryCode} maxLength={2} onChange={(event) => setForm((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} placeholder="KE" />
            </label>
            <label className="field">
              <span>Currency</span>
              <input value={form.currencyCode} maxLength={3} onChange={(event) => setForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} placeholder="KES" />
            </label>
            <label className="field field-span-2">
              <span>Website</span>
              <input value={form.websiteUrl} onChange={(event) => setForm((current) => ({ ...current, websiteUrl: event.target.value }))} placeholder="https://provider.example" />
            </label>
            <label className="field field-span-2">
              <span>Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={5}
                placeholder="Notes about the provider's inventory, market focus, or operational requirements."
              />
            </label>
          </div>

          {selectedProvider && !isCreating && (
            <div className="detail-grid">
              <div className="detail-card">
                <span className="detail-label">Created</span>
                <strong>{formatDate(selectedProvider.createdAt)}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Last updated</span>
                <strong>{formatDate(selectedProvider.updatedAt)}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Reserve balance</span>
                <strong>{formatMoney(selectedProvider.reserveBalanceAmount, selectedProvider.currencyCode)}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">Operational status</span>
                <strong>{selectedProvider.isActive ? 'Accepting business' : 'Inactive'}</strong>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
