import type { FelixApiClient } from '../client.js';
import type { ReconciliationDiscrepancy, AuditLog, Booking, Payout, Refund } from '@felix-travel/types';
import type { PaginationMeta } from '@felix-travel/types';

export function adminEndpoints(client: FelixApiClient) {
  return {
    listBookings: (params?: { status?: string; page?: number; pageSize?: number }) =>
      client.get<{ bookings: Booking[]; meta: PaginationMeta }>('/v1/admin/bookings', params),

    listPayouts: (params?: { status?: string; page?: number; pageSize?: number }) =>
      client.get<{ payouts: Payout[]; meta: PaginationMeta }>('/v1/admin/payouts', params),

    listRefunds: (params?: { status?: string; page?: number; pageSize?: number }) =>
      client.get<{ refunds: Refund[]; meta: PaginationMeta }>('/v1/admin/refunds', params),

    listUsers: (params?: { role?: string; page?: number; pageSize?: number }) =>
      client.get<{ users: unknown[]; meta: PaginationMeta }>('/v1/admin/users', params),

    /** Alias matching dashboard page call convention */
    getAuditLog: (params?: { entityType?: string; entityId?: string; page?: number }) =>
      client.get<{ logs: AuditLog[]; meta: PaginationMeta }>('/v1/admin/audit-logs', params),

    getReconciliationDiscrepancies: (params?: { page?: number; resolved?: boolean }) =>
      client.get<{ discrepancies: ReconciliationDiscrepancy[]; meta: PaginationMeta }>(
        '/v1/admin/reconciliation/discrepancies',
        params
      ),

    resolveDiscrepancy: (id: string, body: { resolution: string }) =>
      client.post<ReconciliationDiscrepancy>(`/v1/admin/reconciliation/discrepancies/${id}/resolve`, body),

    getAuditLogs: (params?: { entityType?: string; entityId?: string; page?: number }) =>
      client.get<{ logs: AuditLog[]; meta: PaginationMeta }>('/v1/admin/audit-logs', params),

    manualLedgerAdjustment: (body: unknown, idempotencyKey: string) =>
      client.post<unknown>('/v1/admin/ledger/manual-adjustment', body, idempotencyKey),

    listLedgerAccounts: () =>
      client.get<unknown[]>('/v1/admin/ledger/accounts'),

    approveRefund: (refundId: string) =>
      client.post<unknown>(`/v1/admin/refunds/${refundId}/approve`),

    approvePayout: (payoutId: string) =>
      client.post<unknown>(`/v1/admin/payouts/${payoutId}/approve`),

    runReconciliation: (body: { fromDate: string; toDate: string }) =>
      client.post<unknown>('/v1/payments/reconcile', body),
  };
}
