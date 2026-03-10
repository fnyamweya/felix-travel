import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, HandCoins, Landmark, ShieldAlert } from 'lucide-react';
import { Badge } from '@felix-travel/ui';
import { useAuth } from '../../lib/auth-context.js';
import { apiClient } from '../../lib/api-client.js';
import { formatDate, formatMoney, getErrorMessage, titleizeToken } from '../../lib/admin-utils.js';
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
  SectionCard,
  StatCard,
  StatGrid,
  WorkspaceGrid,
} from '../../components/workspace-ui.js';
import { Button } from '@felix-travel/ui';

export function ProviderPayouts() {
  const { user } = useAuth();
  const providerId = user?.providerId;
  const queryClient = useQueryClient();
  const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const enabled = Boolean(providerId);

  const { data: payouts } = useQuery({
    queryKey: ['provider-payouts', providerId],
    queryFn: () => apiClient.payouts.list({ pageSize: 100 }),
    enabled,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['provider-payout-accounts', providerId],
    queryFn: () => apiClient.providers.getPayoutAccounts(providerId!),
    enabled,
  });

  const { data: chargeLines } = useQuery({
    queryKey: ['provider-payout-charge-lines', selectedPayoutId],
    queryFn: () => apiClient.charges.getPayoutChargeLines(selectedPayoutId!),
    enabled: Boolean(selectedPayoutId),
  });

  const requestPayoutMutation = useMutation({
    mutationFn: async () => {
      if (!providerId) throw new Error('No provider context available.');
      return apiClient.payouts.runPayout(providerId, { idempotencyKey: crypto.randomUUID() });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider-payouts', providerId] });
      setMessage('Payout request submitted.');
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  if (!providerId) {
    return (
      <PageShell>
        <EmptyBlock
          title="No provider context is attached to this account."
          description="Assign a provider to use payout operations."
        />
      </PageShell>
    );
  }

  const payoutItems = payouts?.payouts ?? [];
  const pendingCount = payoutItems.filter((payout: any) => ['pending', 'processing', 'scheduled', 'on_hold'].includes(payout.status)).length;
  const settledValue = payoutItems.filter((payout: any) => payout.status === 'succeeded').reduce((sum: number, payout: any) => sum + payout.amount, 0);
  const heldCount = payoutItems.filter((payout: any) => payout.status === 'on_hold').length;
  const defaultAccount = accounts.find((account: any) => account.isDefault);
  const selectedPayout = payoutItems.find((payout: any) => payout.id === selectedPayoutId) ?? null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Provider payouts"
        title="Payouts and settlement requests"
        description="Review disbursements, deductions, and request new payouts."
        actions={
          <Button
            onClick={() => void requestPayoutMutation.mutateAsync()}
            loading={requestPayoutMutation.isPending}
            disabled={!defaultAccount}
          >
            Request payout
          </Button>
        }
      />

      {(message || errorMessage) ? (
        <Notice message={errorMessage ?? message ?? ''} variant={errorMessage ? 'destructive' : 'success'} />
      ) : null}

      <StatGrid>
        <StatCard label="Pending batches" value={pendingCount} hint="In approval or processing" icon={Clock3} tone="warning" />
        <StatCard label="Settled value" value={formatMoney(settledValue, payoutItems[0]?.currencyCode ?? 'KES')} hint="Completed payout volume" icon={HandCoins} tone="success" />
        <StatCard label="On hold" value={heldCount} hint="Batches awaiting manual approval" icon={ShieldAlert} tone="warning" />
        <StatCard
          label="Payout route"
          value={defaultAccount ? 'Ready' : 'Missing'}
          hint={defaultAccount ? `${defaultAccount.accountType.replace(/_/g, ' ')} ending ${defaultAccount.accountNumber.slice(-4)}` : 'Add a default payout account first'}
          icon={Landmark}
        />
      </StatGrid>

      <WorkspaceGrid
        main={
          <SectionCard
            title="Payout history"
            description="Select a batch to review status and deductions."
          >
            <DataTable headers={['Batch', 'Amount', 'Status', 'Processed', 'Reference']}>
              {payoutItems.map((payout: any) => (
                <tr
                  key={payout.id}
                  className={selectedPayoutId === payout.id ? 'border-b border-border/60 bg-primary/5' : 'border-b border-border/60'}
                  onClick={() => setSelectedPayoutId(payout.id)}
                >
                  <td className="cursor-pointer p-4">
                    <EntityCell title={payout.id.slice(-8)} subtitle={payout.payoutAccountId.slice(-8)} />
                  </td>
                  <td className="p-4 text-sm font-medium text-foreground">{formatMoney(payout.amount, payout.currencyCode)}</td>
                  <td className="p-4">
                    <Badge variant={payout.status === 'succeeded' ? 'success' : payout.status === 'failed' ? 'destructive' : 'warning'}>
                      {titleizeToken(payout.status)}
                    </Badge>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{formatDate(payout.processedAt ?? payout.createdAt)}</td>
                  <td className="p-4 text-sm text-muted-foreground">{payout.tinggPaymentRef ?? 'Pending'}</td>
                </tr>
              ))}
              {payoutItems.length === 0 && <DataTableEmpty colSpan={5} label="No payouts have been created yet." />}
            </DataTable>
          </SectionCard>
        }
        side={
          <SectionCard
            title="Selected payout"
            description="Processing details for the selected batch."
          >
            {!selectedPayout ? (
              <EmptyBlock
                title="Select a payout"
                description="Choose a batch to inspect details."
              />
            ) : (
              <div className="space-y-5">
                <InfoGrid>
                  <InfoCard label="Amount" value={formatMoney(selectedPayout.amount, selectedPayout.currencyCode)} />
                  <InfoCard label="Status" value={titleizeToken(selectedPayout.status)} />
                  <InfoCard label="Processed" value={formatDate(selectedPayout.processedAt ?? selectedPayout.createdAt)} />
                  <InfoCard label="Reference" value={selectedPayout.tinggPaymentRef ?? 'Pending dispatch'} />
                </InfoGrid>

                <div className="space-y-3">
                  {(chargeLines ?? []).map((line: any) => (
                    <div key={line.id} className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{line.description}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{titleizeToken(line.scope)}</div>
                        </div>
                        <div className="text-sm font-medium text-foreground">{formatMoney(line.chargeAmount, line.currencyCode)}</div>
                      </div>
                    </div>
                  ))}
                  {(chargeLines ?? []).length === 0 && (
                    <EmptyBlock
                      title="No payout deductions recorded"
                      description="No charge lines attached to this batch."
                    />
                  )}
                </div>
              </div>
            )}
          </SectionCard>
        }
      />
    </PageShell>
  );
}
