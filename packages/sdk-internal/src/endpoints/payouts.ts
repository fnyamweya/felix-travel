import type { FelixApiClient } from '../client.js';
import type { Payout } from '@felix-travel/types';
import type { PaginationMeta } from '@felix-travel/types';

export function payoutEndpoints(client: FelixApiClient) {
  return {
    list: (params?: { status?: string; page?: number; pageSize?: number }) =>
      client.get<{ payouts: Payout[]; meta: PaginationMeta }>('/v1/payouts', params),

    get: (id: string) =>
      client.get<Payout>(`/v1/payouts/${id}`),

    runPayout: (providerId: string, body: { periodEnd?: string }, idempotencyKey: string) =>
      client.post<Payout>('/v1/payouts', { providerId, ...body }, idempotencyKey),

    approve: (id: string) =>
      client.post<Payout>(`/v1/admin/payouts/${id}/approve`),
  };
}
