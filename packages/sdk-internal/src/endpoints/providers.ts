import type { FelixApiClient } from '../client.js';
import type { ServiceProvider, ProviderPayoutAccount, ProviderCallbackSubscription } from '@felix-travel/types';
import type { PaginationMeta } from '@felix-travel/types';

export function providerEndpoints(client: FelixApiClient) {
  return {
    list: (params?: { page?: number; pageSize?: number }) =>
      client.get<ServiceProvider[]>('/v1/admin/providers', params),

    create: (body: unknown) =>
      client.post<ServiceProvider>('/v1/admin/providers', body),

    update: (id: string, body: unknown) =>
      client.patch<ServiceProvider | null>(`/v1/admin/providers/${id}`, body),

    get: (id: string) => client.get<ServiceProvider>(`/v1/providers/${id}`),

    getSettings: (id: string) =>
      client.get<unknown>(`/v1/providers/${id}/settings`),

    updateSettings: (id: string, body: unknown) =>
      client.patch<unknown>(`/v1/providers/${id}/settings`, body),

    getBookings: (providerId: string, params?: { page?: number; pageSize?: number }) =>
      client.get<{ bookings: unknown[]; meta: PaginationMeta }>(`/v1/providers/${providerId}/bookings`, params),

    getListings: (providerId: string) =>
      client.get<unknown[]>(`/v1/providers/${providerId}/listings`),

    createListing: (providerId: string, body: unknown) =>
      client.post<unknown>(`/v1/providers/${providerId}/listings`, body),

    updateListing: (providerId: string, listingId: string, body: unknown) =>
      client.patch<unknown>(`/v1/providers/${providerId}/listings/${listingId}`, body),

    getListingManagement: (providerId: string, listingId: string) =>
      client.get<{
        listing: unknown;
        pricingRules: unknown[];
        blackouts: unknown[];
        inventory: unknown[];
      }>(`/v1/providers/${providerId}/listings/${listingId}/management`),

    createPricingRule: (providerId: string, listingId: string, body: unknown) =>
      client.post<unknown>(`/v1/providers/${providerId}/listings/${listingId}/pricing-rules`, body),

    createBlackoutDate: (providerId: string, listingId: string, body: unknown) =>
      client.post<unknown>(`/v1/providers/${providerId}/listings/${listingId}/blackout-dates`, body),

    updateInventory: (providerId: string, listingId: string, body: unknown) =>
      client.post<unknown>(`/v1/providers/${providerId}/listings/${listingId}/inventory`, body),

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

    // Booking actions
    acceptBooking: (providerId: string, bookingId: string, notes?: string) =>
      client.post<unknown>(`/v1/providers/${providerId}/bookings/${bookingId}/accept`, notes ? { notes } : {}),

    holdBooking: (providerId: string, bookingId: string, reason: string) =>
      client.post<unknown>(`/v1/providers/${providerId}/bookings/${bookingId}/hold`, { reason }),

    rejectBooking: (providerId: string, bookingId: string, reason: string) =>
      client.post<unknown>(`/v1/providers/${providerId}/bookings/${bookingId}/reject`, { reason }),
  };
}
