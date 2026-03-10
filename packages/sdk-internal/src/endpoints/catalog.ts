import type { FelixApiClient } from '../client.js';
import type { Destination, Listing, AvailabilitySlot, ListingCategory } from '@felix-travel/types';
import type { PaginationMeta } from '@felix-travel/types';

export function catalogEndpoints(client: FelixApiClient) {
  return {
    getDestinations: () =>
      client.get<Destination[]>('/v1/catalog/destinations'),

    getListingCategories: () =>
      client.get<ListingCategory[]>('/v1/catalog/listing-categories'),

    getListings: (params?: { destinationId?: string; type?: string; page?: number; pageSize?: number }) =>
      client.get<{ listings: Listing[]; meta: PaginationMeta }>('/v1/catalog/listings', params),

    getListing: (id: string) =>
      client.get<Listing>(`/v1/catalog/listings/${id}`),

    getAvailability: (listingId: string, params?: { from?: string; to?: string }) =>
      client.get<AvailabilitySlot[]>(`/v1/availability/${listingId}`, params),

    search: (params: { q: string; destinationId?: string; type?: string; from?: string; to?: string; guests?: number; page?: number }) =>
      client.get<{ listings: Listing[]; meta: PaginationMeta }>('/v1/catalog/listings', params),
  };
}
