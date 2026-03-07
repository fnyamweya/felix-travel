import type { FelixApiClient } from '../client.js';
import type { ServiceProvider, ProviderPayoutAccount, ProviderCallbackSubscription } from '@felix-travel/types';
import type { PaginationMeta } from '@felix-travel/types';

export function providerEndpoints(client: FelixApiClient) {
  return {
    get: (id: string) => client.get<ServiceProvider>(`/v1/providers/${id}`),

    updateSettings: (id: string, body: unknown) =>
      client.patch<ServiceProvider>(`/v1/providers/${id}/settings`, body),

    getPayoutAccounts: (providerId: string) =>
      client.get<ProviderPayoutAccount[]>(`/v1/providers/${providerId}/payout-accounts`),

    createPayoutAccount: (providerId: string, body: unknown) =>
      client.post<ProviderPayoutAccount>(`/v1/providers/${providerId}/payout-accounts`, body),

    getCallbackSubscriptions: (providerId: string) =>
      client.get<ProviderCallbackSubscription[]>(`/v1/providers/${providerId}/webhook-subscriptions`),

    createCallbackSubscription: (providerId: string, body: unknown) =>
      client.post<ProviderCallbackSubscription>(`/v1/providers/${providerId}/webhook-subscriptions`, body),

    updateCallbackSubscription: (providerId: string, subId: string, body: unknown) =>
      client.patch<ProviderCallbackSubscription>(`/v1/providers/${providerId}/webhook-subscriptions/${subId}`, body),

    testCallbackSubscription: (providerId: string, subId: string) =>
      client.post<void>(`/v1/providers/${providerId}/webhook-subscriptions/${subId}/test`),

    getPayouts: (providerId: string, params?: { page?: number; pageSize?: number }) =>
      client.get<{ payouts: unknown[]; meta: PaginationMeta }>(`/v1/providers/${providerId}/payouts`, params),
  };
}
