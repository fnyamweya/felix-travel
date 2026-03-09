import type { FelixApiClient } from '../client.js';
import type { Payment, Refund } from '@felix-travel/types';

export function paymentEndpoints(client: FelixApiClient) {
  return {
    initiateCheckout: (body: { bookingId: string; MSISDN?: string; paymentOptionCode?: string }, idempotencyKey: string) =>
      client.post<Payment>('/v1/payments/checkout', body, idempotencyKey),

    initiateCharge: (body: { paymentId: string; MSISDN: string; paymentOptionCode: string }, idempotencyKey: string) =>
      client.post<Payment>('/v1/payments/charge', body, idempotencyKey),

    getStatus: (paymentId: string) =>
      client.get<Payment>(`/v1/payments/${paymentId}`),

    refund: (paymentId: string, body: { amount: number; reason: string; items?: unknown[] }, idempotencyKey: string) =>
      client.post<Refund>(`/v1/payments/${paymentId}/refund`, body, idempotencyKey),

    approveRefund: (refundId: string) =>
      client.post<Refund>(`/v1/admin/refunds/${refundId}/approve`),

    rejectRefund: (refundId: string, body: { reason: string }) =>
      client.post<Refund>(`/v1/admin/refunds/${refundId}/reject`, body),
  };
}
