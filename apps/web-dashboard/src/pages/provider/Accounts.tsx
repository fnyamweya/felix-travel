import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCallbackSubscriptionSchema, createPayoutAccountSchema, updateProviderSchema } from '@felix-travel/validation';
import { useAuth } from '../../lib/auth-context.js';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, getErrorMessage, titleizeToken, toOptionalTrimmed } from '../../lib/admin-utils.js';

type ProviderProfileForm = {
  name: string;
  slug: string;
  description: string;
  email: string;
  phone: string;
  countryCode: string;
  currencyCode: string;
  websiteUrl: string;
};

type ProviderSettingsForm = {
  settlementDelayDays: string;
  commissionBps: string;
  autoApprovePayout: boolean;
  notifyOnBooking: boolean;
  notifyOnPayout: boolean;
};

type PayoutAccountForm = {
  accountType: 'mobile_money' | 'bank_account' | 'remittance';
  accountNumber: string;
  accountName: string;
  networkCode: string;
  countryCode: string;
  currencyCode: string;
  isDefault: boolean;
};

type SubscriptionForm = {
  url: string;
  events: string[];
  maxRetries: string;
  timeoutMs: string;
};

const CALLBACK_EVENTS = [
  'booking.created',
  'booking.updated',
  'booking.confirmed',
  'booking.cancelled',
  'payment.succeeded',
  'payment.failed',
  'refund.initiated',
  'refund.succeeded',
  'payout.pending',
  'payout.processing',
  'payout.completed',
  'payout.failed',
] as const;

const EMPTY_PROFILE_FORM: ProviderProfileForm = {
  name: '',
  slug: '',
  description: '',
  email: '',
  phone: '',
  countryCode: 'KE',
  currencyCode: 'KES',
  websiteUrl: '',
};

const EMPTY_SETTINGS_FORM: ProviderSettingsForm = {
  settlementDelayDays: '0',
  commissionBps: '1000',
  autoApprovePayout: false,
  notifyOnBooking: true,
  notifyOnPayout: true,
};

const EMPTY_PAYOUT_ACCOUNT_FORM: PayoutAccountForm = {
  accountType: 'mobile_money',
  accountNumber: '',
  accountName: '',
  networkCode: '',
  countryCode: 'KE',
  currencyCode: 'KES',
  isDefault: true,
};

const EMPTY_SUBSCRIPTION_FORM: SubscriptionForm = {
  url: '',
  events: ['booking.created', 'payment.succeeded', 'payout.completed'],
  maxRetries: '5',
  timeoutMs: '10000',
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

export function ProviderAccounts() {
  const { user } = useAuth();
  const providerId = user?.providerId;
  const queryClient = useQueryClient();
  const [profileForm, setProfileForm] = useState<ProviderProfileForm>(EMPTY_PROFILE_FORM);
  const [settingsForm, setSettingsForm] = useState<ProviderSettingsForm>(EMPTY_SETTINGS_FORM);
  const [payoutAccountForm, setPayoutAccountForm] = useState<PayoutAccountForm>(EMPTY_PAYOUT_ACCOUNT_FORM);
  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionForm>(EMPTY_SUBSCRIPTION_FORM);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const enabled = Boolean(providerId);

  const { data: provider } = useQuery({
    queryKey: ['provider-profile', providerId],
    queryFn: () => apiClient.providers.get(providerId!),
    enabled,
  });

  const { data: settings } = useQuery({
    queryKey: ['provider-settings', providerId],
    queryFn: () => apiClient.providers.getSettings(providerId!),
    enabled,
  });

  const { data: payoutAccounts = [] } = useQuery({
    queryKey: ['provider-payout-accounts', providerId],
    queryFn: () => apiClient.providers.getPayoutAccounts(providerId!),
    enabled,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['provider-webhook-subscriptions', providerId],
    queryFn: () => apiClient.providers.getCallbackSubscriptions(providerId!),
    enabled,
  });

  useEffect(() => {
    if (!provider) return;
    setProfileForm({
      name: provider.name,
      slug: provider.slug,
      description: provider.description ?? '',
      email: provider.email,
      phone: provider.phone ?? '',
      countryCode: provider.countryCode,
      currencyCode: provider.currencyCode,
      websiteUrl: provider.websiteUrl ?? '',
    });
  }, [provider]);

  useEffect(() => {
    if (!settings) return;
    const value = settings as {
      settlementDelayDays?: number | null;
      commissionBps?: number;
      autoApprovePayout?: boolean;
      notifyOnBooking?: boolean;
      notifyOnPayout?: boolean;
    };
    setSettingsForm({
      settlementDelayDays: String(value.settlementDelayDays ?? 0),
      commissionBps: String(value.commissionBps ?? 1000),
      autoApprovePayout: Boolean(value.autoApprovePayout),
      notifyOnBooking: value.notifyOnBooking !== false,
      notifyOnPayout: value.notifyOnPayout !== false,
    });
  }, [settings]);

  if (!providerId) {
    return <div className="empty-panel">No provider context is attached to this account.</div>;
  }

  const profileMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: profileForm.name.trim(),
        slug: profileForm.slug.trim(),
        description: toOptionalTrimmed(profileForm.description),
        email: profileForm.email.trim(),
        phone: toOptionalTrimmed(profileForm.phone),
        countryCode: profileForm.countryCode.trim().toUpperCase(),
        currencyCode: profileForm.currencyCode.trim().toUpperCase(),
        websiteUrl: toOptionalTrimmed(profileForm.websiteUrl),
      };
      const parsed = updateProviderSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid provider profile');
      return apiClient.http.patch(`/v1/providers/${providerId}`, parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider-profile', providerId] });
      setMessage('Provider profile updated.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const settingsMutation = useMutation({
    mutationFn: async () => apiClient.providers.updateSettings(providerId, {
      settlementDelayDays: Number(settingsForm.settlementDelayDays),
      commissionBps: Number(settingsForm.commissionBps),
      autoApprovePayout: settingsForm.autoApprovePayout,
      notifyOnBooking: settingsForm.notifyOnBooking,
      notifyOnPayout: settingsForm.notifyOnPayout,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider-settings', providerId] });
      setMessage('Provider settings updated.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const payoutAccountMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        accountType: payoutAccountForm.accountType,
        accountNumber: payoutAccountForm.accountNumber.trim(),
        accountName: payoutAccountForm.accountName.trim(),
        networkCode: payoutAccountForm.networkCode.trim(),
        countryCode: payoutAccountForm.countryCode.trim().toUpperCase(),
        currencyCode: payoutAccountForm.currencyCode.trim().toUpperCase(),
        isDefault: payoutAccountForm.isDefault,
      };
      const parsed = createPayoutAccountSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid payout account');
      return apiClient.providers.createPayoutAccount(providerId, parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider-payout-accounts', providerId] });
      setPayoutAccountForm(EMPTY_PAYOUT_ACCOUNT_FORM);
      setMessage('Payout account added.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const subscriptionMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        url: subscriptionForm.url.trim(),
        events: subscriptionForm.events as unknown as Array<typeof CALLBACK_EVENTS[number]>,
        maxRetries: Number(subscriptionForm.maxRetries),
        timeoutMs: Number(subscriptionForm.timeoutMs),
      };
      const parsed = createCallbackSubscriptionSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid webhook subscription');
      return apiClient.providers.createCallbackSubscription(providerId, parsed.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider-webhook-subscriptions', providerId] });
      setSubscriptionForm(EMPTY_SUBSCRIPTION_FORM);
      setMessage('Webhook subscription created.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const toggleSubscriptionMutation = useMutation({
    mutationFn: async ({ subscriptionId, isActive }: { subscriptionId: string; isActive: boolean }) =>
      apiClient.providers.updateCallbackSubscription(providerId, subscriptionId, { isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider-webhook-subscriptions', providerId] });
      setMessage('Webhook subscription updated.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  return (
    <div className="domain-page">
      <div className="domain-page-header">
        <div>
          <span className="eyebrow">Provider accounts</span>
          <h1 className="page-title">Accounts and integrations</h1>
          <p className="page-subtitle">
            Keep your provider profile accurate, configure payout destinations, and manage outbound webhook integrations in one secure area.
          </p>
        </div>
      </div>

      <div className="dashboard-stat-grid">
        <StatCard label="Payout accounts" value={payoutAccounts.length} hint="Registered settlement destinations" />
        <StatCard label="Default route" value={payoutAccounts.some((account: any) => account.isDefault) ? 'Ready' : 'Missing'} hint="A default account is required for payout requests" />
        <StatCard label="Webhook subscriptions" value={subscriptions.length} hint="Outbound integration endpoints" />
        <StatCard label="Reserve balance" value={provider ? titleizeToken(provider.isVerified ? 'verified' : 'pending') : 'Pending'} hint="Provider verification and reserve context" />
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
              <h2 className="section-title">Provider profile</h2>
              <p className="section-copy">Public-facing and operational contact details.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="field">
              <span>Slug</span>
              <input value={profileForm.slug} onChange={(event) => setProfileForm((current) => ({ ...current, slug: event.target.value }))} />
            </label>
            <label className="field">
              <span>Email</span>
              <input value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
            </label>
            <label className="field">
              <span>Country</span>
              <input value={profileForm.countryCode} maxLength={2} onChange={(event) => setProfileForm((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} />
            </label>
            <label className="field">
              <span>Currency</span>
              <input value={profileForm.currencyCode} maxLength={3} onChange={(event) => setProfileForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} />
            </label>
            <label className="field field-span-2">
              <span>Website</span>
              <input value={profileForm.websiteUrl} onChange={(event) => setProfileForm((current) => ({ ...current, websiteUrl: event.target.value }))} />
            </label>
            <label className="field field-span-2">
              <span>Description</span>
              <textarea value={profileForm.description} rows={4} onChange={(event) => setProfileForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
          </div>
          <button className="btn-primary" onClick={() => void profileMutation.mutateAsync()} disabled={profileMutation.isPending}>
            {profileMutation.isPending ? 'Saving...' : 'Save profile'}
          </button>
        </section>

        <section className="workspace-panel workspace-panel-sticky">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Settlement settings</h2>
              <p className="section-copy">Configure how payout operations should behave.</p>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Settlement delay days</span>
              <input value={settingsForm.settlementDelayDays} type="number" onChange={(event) => setSettingsForm((current) => ({ ...current, settlementDelayDays: event.target.value }))} />
            </label>
            <label className="field">
              <span>Commission bps</span>
              <input value={settingsForm.commissionBps} type="number" onChange={(event) => setSettingsForm((current) => ({ ...current, commissionBps: event.target.value }))} />
            </label>
          </div>
          <div className="toggle-grid">
            <label className="toggle-card">
              <input type="checkbox" checked={settingsForm.autoApprovePayout} onChange={(event) => setSettingsForm((current) => ({ ...current, autoApprovePayout: event.target.checked }))} />
              <span>Auto-approve payouts</span>
            </label>
            <label className="toggle-card">
              <input type="checkbox" checked={settingsForm.notifyOnBooking} onChange={(event) => setSettingsForm((current) => ({ ...current, notifyOnBooking: event.target.checked }))} />
              <span>Notify on booking</span>
            </label>
            <label className="toggle-card">
              <input type="checkbox" checked={settingsForm.notifyOnPayout} onChange={(event) => setSettingsForm((current) => ({ ...current, notifyOnPayout: event.target.checked }))} />
              <span>Notify on payout</span>
            </label>
          </div>
          <button className="btn-primary" onClick={() => void settingsMutation.mutateAsync()} disabled={settingsMutation.isPending}>
            {settingsMutation.isPending ? 'Saving...' : 'Save settings'}
          </button>
        </section>
      </div>

      <div className="workspace-triptych">
        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Payout accounts</h2>
              <p className="section-copy">Add settlement destinations for disbursements.</p>
            </div>
          </div>
          <div className="list-stack">
            {(payoutAccounts as any[]).map((account) => (
              <div key={account.id} className="list-card static">
                <strong>{titleizeToken(account.accountType)} ending {account.accountNumber.slice(-4)}</strong>
                <span>{account.accountName} / {account.isDefault ? 'Default' : 'Secondary'} / {account.isVerified ? 'Verified' : 'Pending verification'}</span>
              </div>
            ))}
            {(payoutAccounts as any[]).length === 0 && <div className="empty-panel">No payout accounts configured.</div>}
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Account type</span>
              <select value={payoutAccountForm.accountType} onChange={(event) => setPayoutAccountForm((current) => ({ ...current, accountType: event.target.value as PayoutAccountForm['accountType'] }))}>
                <option value="mobile_money">Mobile money</option>
                <option value="bank_account">Bank account</option>
                <option value="remittance">Remittance</option>
              </select>
            </label>
            <label className="field">
              <span>Network code</span>
              <input value={payoutAccountForm.networkCode} onChange={(event) => setPayoutAccountForm((current) => ({ ...current, networkCode: event.target.value }))} placeholder="MPESA" />
            </label>
            <label className="field">
              <span>Account number</span>
              <input value={payoutAccountForm.accountNumber} onChange={(event) => setPayoutAccountForm((current) => ({ ...current, accountNumber: event.target.value }))} />
            </label>
            <label className="field">
              <span>Account name</span>
              <input value={payoutAccountForm.accountName} onChange={(event) => setPayoutAccountForm((current) => ({ ...current, accountName: event.target.value }))} />
            </label>
          </div>
          <label className="toggle-card" style={{ marginBottom: '1rem' }}>
            <input type="checkbox" checked={payoutAccountForm.isDefault} onChange={(event) => setPayoutAccountForm((current) => ({ ...current, isDefault: event.target.checked }))} />
            <span>Use as default payout route</span>
          </label>
          <button className="btn-secondary" onClick={() => void payoutAccountMutation.mutateAsync()} disabled={payoutAccountMutation.isPending}>
            {payoutAccountMutation.isPending ? 'Adding...' : 'Add payout account'}
          </button>
        </section>

        <section className="workspace-panel" style={{ gridColumn: 'span 2' }}>
          <div className="workspace-panel-header">
            <div>
              <h2 className="section-title">Webhooks and integrations</h2>
              <p className="section-copy">Configure outbound callbacks for operational events.</p>
            </div>
          </div>

          <div className="list-stack">
            {(subscriptions as any[]).map((subscription) => (
              <div key={subscription.id} className="list-card static">
                <strong>{subscription.url}</strong>
                <span>{subscription.events.join(', ')} / secret ending {subscription.secretHint} / updated {formatDate(subscription.updatedAt)}</span>
                <div className="action-row">
                  <button className="btn-secondary" onClick={() => void toggleSubscriptionMutation.mutateAsync({ subscriptionId: subscription.id, isActive: !subscription.isActive })}>
                    {subscription.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button className="btn-secondary" onClick={() => void apiClient.providers.testCallbackSubscription(providerId, subscription.id)}>
                    Test delivery
                  </button>
                </div>
              </div>
            ))}
            {(subscriptions as any[]).length === 0 && <div className="empty-panel">No webhook subscriptions configured.</div>}
          </div>

          <div className="form-grid">
            <label className="field field-span-2">
              <span>Callback URL</span>
              <input value={subscriptionForm.url} onChange={(event) => setSubscriptionForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://partner.example/webhooks/felix" />
            </label>
            <label className="field">
              <span>Max retries</span>
              <input value={subscriptionForm.maxRetries} type="number" onChange={(event) => setSubscriptionForm((current) => ({ ...current, maxRetries: event.target.value }))} />
            </label>
            <label className="field">
              <span>Timeout (ms)</span>
              <input value={subscriptionForm.timeoutMs} type="number" onChange={(event) => setSubscriptionForm((current) => ({ ...current, timeoutMs: event.target.value }))} />
            </label>
            <label className="field field-span-2">
              <span>Subscribed events</span>
              <div className="tag-picker">
                {CALLBACK_EVENTS.map((eventName) => (
                  <label key={eventName} className="choice-chip">
                    <input
                      type="checkbox"
                      checked={subscriptionForm.events.includes(eventName)}
                      onChange={(event) => {
                        setSubscriptionForm((current) => ({
                          ...current,
                          events: event.target.checked
                            ? [...current.events, eventName]
                            : current.events.filter((item) => item !== eventName),
                        }));
                      }}
                    />
                    <span>{eventName}</span>
                  </label>
                ))}
              </div>
            </label>
          </div>
          <button className="btn-secondary" onClick={() => void subscriptionMutation.mutateAsync()} disabled={subscriptionMutation.isPending}>
            {subscriptionMutation.isPending ? 'Creating...' : 'Create webhook subscription'}
          </button>
        </section>
      </div>
    </div>
  );
}
