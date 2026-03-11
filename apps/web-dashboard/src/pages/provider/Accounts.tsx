import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Landmark,
  MailCheck,
  Pause,
  Play,
  Plus,
  Send,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import { createCallbackSubscriptionSchema, createPayoutAccountSchema, updateProviderSchema } from '@felix-travel/validation';
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@felix-travel/ui';
import { useAuth } from '../../lib/auth-context.js';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, getErrorMessage, titleizeToken, toOptionalTrimmed } from '../../lib/admin-utils.js';
import {
  CheckboxChip,
  EmptyBlock,
  Field,
  FieldGrid,
  FormSection,
  Notice,
  PageHeader,
  PageShell,
  SectionCard,
  StatCard,
  StatGrid,
  SwitchField,
  TextField,
  TextareaField,
} from '../../components/workspace-ui.js';
import {
  ActionMenu,
  ConfirmDialog,
  SidePanel,
  StatusBadge,
  type ActionItem,
} from '../../components/interaction-framework.js';

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

  /* --- Panel / dialog state --- */
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addWebhookOpen, setAddWebhookOpen] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<{ id: string; url: string; isActive: boolean } | null>(null);

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
    return (
      <PageShell>
        <EmptyBlock
          title="No provider context is attached to this account."
          description="Assign a provider to manage settings and integrations."
        />
      </PageShell>
    );
  }

  /* --- Mutations --- */

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
      setAddAccountOpen(false);
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
      setAddWebhookOpen(false);
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
      setConfirmToggle(null);
      setMessage('Webhook subscription updated.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  /* --- Row action builders --- */

  function webhookActions(sub: any): ActionItem[] {
    return [
      {
        label: sub.isActive ? 'Disable' : 'Enable',
        icon: sub.isActive ? Pause : Play,
        onClick: () => setConfirmToggle({ id: sub.id, url: sub.url, isActive: sub.isActive }),
      },
      {
        label: 'Test delivery',
        icon: Send,
        onClick: () => void apiClient.providers.testCallbackSubscription(providerId!, sub.id),
      },
    ];
  }

  /* --- Render --- */

  return (
    <PageShell>
      <PageHeader
        eyebrow="Provider accounts"
        title="Accounts and integrations"
        description="Manage provider details, settlement preferences, and webhooks."
      />

      {(message || errorMessage) ? (
        <Notice message={errorMessage ?? message ?? ''} variant={errorMessage ? 'destructive' : 'success'} />
      ) : null}

      <StatGrid>
        <StatCard label="Payout accounts" value={payoutAccounts.length} hint="Registered settlement destinations" icon={Landmark} />
        <StatCard label="Default route" value={payoutAccounts.some((account: any) => account.isDefault) ? 'Ready' : 'Missing'} hint="Default account required for payouts" icon={ShieldCheck} tone="warning" />
        <StatCard label="Webhook subscriptions" value={subscriptions.length} hint="Outbound operational integrations" icon={Webhook} tone="info" />
        <StatCard label="Verification" value={provider ? titleizeToken(provider.isVerified ? 'verified' : 'pending') : 'Pending'} hint="Provider verification status" icon={MailCheck} />
      </StatGrid>

      <Tabs defaultValue="profile" className="space-y-5">
        <TabsList className="w-full justify-start overflow-auto">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
          <TabsTrigger value="payouts">Payout accounts</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        {/* ======= Profile tab ======= */}
        <TabsContent value="profile">
          <SectionCard
            title="Provider profile"
            description="Public contact details for partner management."
            action={
              <Button onClick={() => void profileMutation.mutateAsync()} loading={profileMutation.isPending}>
                Save profile
              </Button>
            }
          >
            <FormSection title="Core identity" description="How the provider appears across the platform.">
              <FieldGrid>
                <TextField label="Name" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} />
                <TextField label="Slug" value={profileForm.slug} onChange={(event) => setProfileForm((current) => ({ ...current, slug: event.target.value }))} />
                <TextField label="Email" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} />
                <TextField label="Phone" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
                <TextField label="Country" value={profileForm.countryCode} maxLength={2} onChange={(event) => setProfileForm((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} />
                <TextField label="Currency" value={profileForm.currencyCode} maxLength={3} onChange={(event) => setProfileForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} />
                <TextField label="Website" className="md:col-span-2" value={profileForm.websiteUrl} onChange={(event) => setProfileForm((current) => ({ ...current, websiteUrl: event.target.value }))} />
                <TextareaField label="Description" className="md:col-span-2" rows={5} value={profileForm.description} onChange={(event) => setProfileForm((current) => ({ ...current, description: event.target.value }))} />
              </FieldGrid>
            </FormSection>
          </SectionCard>
        </TabsContent>

        {/* ======= Settlement tab ======= */}
        <TabsContent value="settlement">
          <SectionCard
            title="Settlement settings"
            description="Configure payouts and notification preferences."
            action={
              <Button onClick={() => void settingsMutation.mutateAsync()} loading={settingsMutation.isPending}>
                Save settings
              </Button>
            }
          >
            <div className="space-y-6">
              <FormSection title="Commercial settings" description="Controls settlement and payout automation.">
                <FieldGrid>
                  <TextField label="Settlement delay days" type="number" value={settingsForm.settlementDelayDays} onChange={(event) => setSettingsForm((current) => ({ ...current, settlementDelayDays: event.target.value }))} />
                  <TextField label="Commission bps" type="number" value={settingsForm.commissionBps} onChange={(event) => setSettingsForm((current) => ({ ...current, commissionBps: event.target.value }))} />
                </FieldGrid>
              </FormSection>

              <div className="grid gap-4 lg:grid-cols-3">
                <SwitchField label="Auto-approve payouts" description="Skip manual approval for eligible payouts." checked={settingsForm.autoApprovePayout} onCheckedChange={(value) => setSettingsForm((current) => ({ ...current, autoApprovePayout: value }))} />
                <SwitchField label="Notify on booking" description="Notify on booking create/update." checked={settingsForm.notifyOnBooking} onCheckedChange={(value) => setSettingsForm((current) => ({ ...current, notifyOnBooking: value }))} />
                <SwitchField label="Notify on payout" description="Notify on payout status changes." checked={settingsForm.notifyOnPayout} onCheckedChange={(value) => setSettingsForm((current) => ({ ...current, notifyOnPayout: value }))} />
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ======= Payout accounts tab ======= */}
        <TabsContent value="payouts">
          <SectionCard
            title="Payout accounts"
            description="Register payout destinations for settlements."
            action={
              <Button onClick={() => { setPayoutAccountForm(EMPTY_PAYOUT_ACCOUNT_FORM); setAddAccountOpen(true); }}>
                <Plus className="mr-1.5 h-4 w-4" /> Add account
              </Button>
            }
          >
            <div className="grid gap-3">
              {(payoutAccounts as any[]).map((account) => (
                <div key={account.id} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background">
                        <Landmark className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {titleizeToken(account.accountType)} ending {account.accountNumber.slice(-4)}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {account.accountName} \u00b7 {account.networkCode}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.isDefault && <Badge variant="info">Default</Badge>}
                      <StatusBadge status={account.isVerified ? 'verified' : 'pending'} />
                    </div>
                  </div>
                </div>
              ))}
              {(payoutAccounts as any[]).length === 0 && (
                <EmptyBlock
                  title="No payout accounts configured"
                  description="Add a payout destination to enable settlements."
                  action={
                    <Button size="sm" onClick={() => { setPayoutAccountForm(EMPTY_PAYOUT_ACCOUNT_FORM); setAddAccountOpen(true); }}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add account
                    </Button>
                  }
                />
              )}
            </div>
          </SectionCard>
        </TabsContent>

        {/* ======= Webhooks tab ======= */}
        <TabsContent value="webhooks">
          <SectionCard
            title="Webhooks and integrations"
            description="Manage outbound event callbacks."
            action={
              <Button onClick={() => { setSubscriptionForm(EMPTY_SUBSCRIPTION_FORM); setAddWebhookOpen(true); }}>
                <Plus className="mr-1.5 h-4 w-4" /> Create subscription
              </Button>
            }
          >
            <div className="grid gap-3">
              {(subscriptions as any[]).map((subscription) => (
                <div key={subscription.id} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-semibold text-foreground">{subscription.url}</div>
                          <StatusBadge status={subscription.isActive ? 'active' : 'disabled'} />
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          secret ending {subscription.secretHint} \u00b7 updated {formatDate(subscription.updatedAt)}
                        </div>
                      </div>
                      <ActionMenu items={webhookActions(subscription)} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {subscription.events.map((eventName: string) => (
                        <span key={eventName} className="rounded-full border border-border/60 bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground">
                          {eventName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {(subscriptions as any[]).length === 0 && (
                <EmptyBlock
                  title="No webhook subscriptions configured"
                  description="Create a subscription to push events to your systems."
                  action={
                    <Button size="sm" onClick={() => { setSubscriptionForm(EMPTY_SUBSCRIPTION_FORM); setAddWebhookOpen(true); }}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Create subscription
                    </Button>
                  }
                />
              )}
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* ======= ADD PAYOUT ACCOUNT PANEL ======= */}
      <SidePanel
        open={addAccountOpen}
        onOpenChange={setAddAccountOpen}
        title="Add payout account"
        description="Register a new settlement destination for payouts."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddAccountOpen(false)}>Cancel</Button>
            <Button loading={payoutAccountMutation.isPending} onClick={() => void payoutAccountMutation.mutateAsync()}>
              Add account
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <FormSection title="Account details" description="Destination details for your payout processor.">
            <FieldGrid>
              <Field label="Account type">
                <Select value={payoutAccountForm.accountType} onValueChange={(value) => setPayoutAccountForm((current) => ({ ...current, accountType: value as PayoutAccountForm['accountType'] }))}>
                  <SelectTrigger><SelectValue placeholder="Select account type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mobile_money">Mobile money</SelectItem>
                    <SelectItem value="bank_account">Bank account</SelectItem>
                    <SelectItem value="remittance">Remittance</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <TextField label="Network code" value={payoutAccountForm.networkCode} onChange={(event) => setPayoutAccountForm((current) => ({ ...current, networkCode: event.target.value }))} placeholder="MPESA" />
              <TextField label="Account number" value={payoutAccountForm.accountNumber} onChange={(event) => setPayoutAccountForm((current) => ({ ...current, accountNumber: event.target.value }))} />
              <TextField label="Account name" value={payoutAccountForm.accountName} onChange={(event) => setPayoutAccountForm((current) => ({ ...current, accountName: event.target.value }))} />
              <TextField label="Country" value={payoutAccountForm.countryCode} onChange={(event) => setPayoutAccountForm((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} />
              <TextField label="Currency" value={payoutAccountForm.currencyCode} onChange={(event) => setPayoutAccountForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} />
            </FieldGrid>
            <SwitchField label="Use as default payout route" description="Use as default payout destination." checked={payoutAccountForm.isDefault} onCheckedChange={(value) => setPayoutAccountForm((current) => ({ ...current, isDefault: value }))} />
          </FormSection>
        </div>
      </SidePanel>

      {/* ======= ADD WEBHOOK PANEL ======= */}
      <SidePanel
        open={addWebhookOpen}
        onOpenChange={setAddWebhookOpen}
        title="Create webhook subscription"
        description="Set callback URL and event coverage."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddWebhookOpen(false)}>Cancel</Button>
            <Button loading={subscriptionMutation.isPending} onClick={() => void subscriptionMutation.mutateAsync()}>
              Create subscription
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <FormSection title="Endpoint" description="The URL that will receive event POST requests.">
            <TextField label="Callback URL" value={subscriptionForm.url} onChange={(event) => setSubscriptionForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://partner.example/webhooks/felix" />
            <FieldGrid>
              <TextField label="Max retries" type="number" value={subscriptionForm.maxRetries} onChange={(event) => setSubscriptionForm((current) => ({ ...current, maxRetries: event.target.value }))} />
              <TextField label="Timeout (ms)" type="number" value={subscriptionForm.timeoutMs} onChange={(event) => setSubscriptionForm((current) => ({ ...current, timeoutMs: event.target.value }))} />
            </FieldGrid>
          </FormSection>

          <FormSection title="Events" description="Select which events trigger a callback.">
            <div className="flex flex-wrap gap-2">
              {CALLBACK_EVENTS.map((eventName) => (
                <CheckboxChip
                  key={eventName}
                  checked={subscriptionForm.events.includes(eventName)}
                  onCheckedChange={(checked) => {
                    setSubscriptionForm((current) => ({
                      ...current,
                      events: checked
                        ? [...current.events, eventName]
                        : current.events.filter((item) => item !== eventName),
                    }));
                  }}
                  label={eventName}
                />
              ))}
            </div>
          </FormSection>
        </div>
      </SidePanel>

      {/* ======= CONFIRM TOGGLE WEBHOOK ======= */}
      <ConfirmDialog
        open={Boolean(confirmToggle)}
        onOpenChange={(open) => { if (!open) setConfirmToggle(null); }}
        title={confirmToggle?.isActive ? 'Disable webhook?' : 'Enable webhook?'}
        description={
          confirmToggle?.isActive
            ? `Disabling this subscription will stop delivering events to ${confirmToggle.url}`
            : `Enabling this subscription will resume delivering events to ${confirmToggle?.url ?? 'the endpoint'}`
        }
        variant={confirmToggle?.isActive ? 'warning' : 'default'}
        confirmLabel={confirmToggle?.isActive ? 'Disable' : 'Enable'}
        loading={toggleSubscriptionMutation.isPending}
        onConfirm={() => {
          if (confirmToggle) toggleSubscriptionMutation.mutate({ subscriptionId: confirmToggle.id, isActive: !confirmToggle.isActive });
        }}
      />
    </PageShell>
  );
}
