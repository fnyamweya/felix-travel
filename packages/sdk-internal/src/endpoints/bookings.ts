import type { FelixApiClient } from '../client.js';
import type { Booking, BookingQuote } from '@felix-travel/types';
import type { PaginationMeta } from '@felix-travel/types';

export function bookingEndpoints(client: FelixApiClient) {
  return {
    getQuote: (body: { listingId: string; serviceDate: string; guestCount: number; items: { pricingRuleId: string; quantity: number }[] }) =>
      client.post<BookingQuote>('/v1/pricing/quote', body),

    createDraft: (body: { listingId: string; serviceDate: string; guestCount: number; travelers: unknown[]; specialRequests?: string }) =>
      client.post<Booking>('/v1/bookings', body),

    updateDraft: (id: string, body: Partial<{ guestCount: number; serviceDate: string; travelers: unknown[] }>) =>
      client.patch<Booking>(`/v1/bookings/${id}`, body),

    confirm: (id: string, idempotencyKey: string) =>
      client.post<Booking>(`/v1/bookings/${id}/confirm`, {}, idempotencyKey),

    get: (id: string) => client.get<Booking>(`/v1/bookings/${id}`),

    getByReference: (reference: string) =>
      client.get<Booking>(`/v1/bookings/ref/${reference}`),

    myBookings: (params?: { page?: number; pageSize?: number }) =>
      client.get<{ bookings: Booking[]; meta: PaginationMeta }>('/v1/bookings', params),

    /** Alias used by customer app list view */
    list: (params?: { page?: number; pageSize?: number }) =>
      client.get<{ bookings: Booking[]; meta: PaginationMeta }>('/v1/bookings', params),

    cancel: (id: string, reason: string) =>
      client.post<Booking>(`/v1/bookings/${id}/cancel`, { reason }),
  };
}
