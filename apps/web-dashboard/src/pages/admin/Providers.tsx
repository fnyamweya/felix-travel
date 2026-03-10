import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Globe2, Landmark, ShieldCheck } from 'lucide-react';
import { createProviderSchema, updateProviderSchema } from '@felix-travel/validation';
import type { ServiceProvider } from '@felix-travel/types';
import { Badge, Button } from '@felix-travel/ui';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, getErrorMessage, toOptionalTrimmed } from '../../lib/admin-utils.js';
import {
  DataTable,
  DataTableEmpty,
  EmptyBlock,
  EntityCell,
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
  TextareaField,
  WorkspaceGrid,
} from '../../components/workspace-ui.js';

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
    if (!firstProvider || isCreating) return;
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
    <PageShell>
      <PageHeader
        eyebrow="Provider domain"
        title="Provider management"
        description="Create and manage provider records, reserves, and coverage."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreating(true);
                setSelectedProviderId(null);
                setForm(EMPTY_FORM);
                setNotice('Ready to add a new provider.');
                setFormError(null);
              }}
            >
              New provider
            </Button>
            <Button onClick={() => void (selectedProvider && !isCreating ? updateProvider.mutateAsync() : createProvider.mutateAsync())} loading={busy}>
              {selectedProvider && !isCreating ? 'Save changes' : 'Create provider'}
            </Button>
          </>
        }
      />

      {(notice || formError) ? (
        <Notice message={formError ?? notice ?? ''} variant={formError ? 'destructive' : 'success'} />
      ) : null}

      <StatGrid>
        <StatCard label="Total providers" value={providers.length} hint={`${activeProviders} active in the marketplace`} icon={Building2} />
        <StatCard label="Verified" value={verifiedProviders} hint="Verified and active" icon={ShieldCheck} tone="success" />
        <StatCard label="Reserve exposure" value={formatMoney(reserveExposure)} hint="Total outstanding reserves" icon={Landmark} tone="warning" />
        <StatCard label="Country coverage" value={coverage} hint="Distinct countries served" icon={Globe2} tone="info" />
      </StatGrid>

      <WorkspaceGrid
        main={
          <SectionCard
            title="Provider directory"
            description="Search and select a provider to manage."
            action={<SearchField value={search} onChange={setSearch} placeholder="Search providers" />}
          >
            <DataTable headers={['Provider', 'Market', 'Status', 'Reserve', 'Updated']}>
              {isLoading && <DataTableEmpty colSpan={5} label="Loading providers..." />}
              {!isLoading && filteredProviders.length === 0 && <DataTableEmpty colSpan={5} label="No providers match your search." />}
              {filteredProviders.map((provider: ServiceProvider) => (
                <tr
                  key={provider.id}
                  className={provider.id === selectedProviderId ? 'border-b border-border/60 bg-primary/5' : 'border-b border-border/60'}
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedProviderId(provider.id);
                  }}
                >
                  <td className="cursor-pointer p-4">
                    <EntityCell title={provider.name} subtitle={provider.email} />
                  </td>
                  <td className="p-4">
                    <EntityCell title={provider.countryCode} subtitle={provider.currencyCode} />
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={provider.isActive ? 'success' : 'secondary'}>{provider.isActive ? 'Active' : 'Inactive'}</Badge>
                      <Badge variant={provider.isVerified ? 'info' : 'warning'}>{provider.isVerified ? 'Verified' : 'Pending'}</Badge>
                    </div>
                  </td>
                  <td className="p-4 text-sm font-medium text-foreground">{formatMoney(provider.reserveBalanceAmount, provider.currencyCode)}</td>
                  <td className="p-4 text-sm text-muted-foreground">{formatDate(provider.updatedAt)}</td>
                </tr>
              ))}
            </DataTable>
          </SectionCard>
        }
        side={
          <SectionCard
            title={selectedProvider && !isCreating ? 'Edit provider' : 'Create provider'}
            description="Fields are validated before saving."
          >
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Savannah Air Safaris" />
                <TextField label="Slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="savannah-air-safaris" />
                <TextField label="Email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="ops@provider.com" />
                <TextField label="Phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+254700000000" />
                <TextField label="Country code" value={form.countryCode} maxLength={2} onChange={(event) => setForm((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} placeholder="KE" />
                <TextField label="Currency" value={form.currencyCode} maxLength={3} onChange={(event) => setForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} placeholder="KES" />
                <TextField label="Website" className="md:col-span-2" value={form.websiteUrl} onChange={(event) => setForm((current) => ({ ...current, websiteUrl: event.target.value }))} placeholder="https://provider.example" />
                <TextareaField
                  label="Description"
                  className="md:col-span-2"
                  rows={5}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Notes about the provider's inventory, market focus, or operational requirements."
                />
              </div>

              {selectedProvider && !isCreating ? (
                <InfoGrid>
                  <InfoCard label="Created" value={formatDate(selectedProvider.createdAt)} />
                  <InfoCard label="Last updated" value={formatDate(selectedProvider.updatedAt)} />
                  <InfoCard label="Reserve balance" value={formatMoney(selectedProvider.reserveBalanceAmount, selectedProvider.currencyCode)} />
                  <InfoCard label="Operational status" value={selectedProvider.isActive ? 'Accepting business' : 'Inactive'} />
                </InfoGrid>
              ) : (
                <EmptyBlock
                  title="Create a new provider"
                  description="Fill in the details and create the provider."
                />
              )}
            </div>
          </SectionCard>
        }
      />
    </PageShell>
  );
}
