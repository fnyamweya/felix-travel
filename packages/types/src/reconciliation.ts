import type { DateTimeString, MinorCurrencyAmount } from './common.js';

export type ReconciliationDiscrepancyType =
  | 'missing_tingg_record'
  | 'amount_mismatch'
  | 'status_mismatch'
  | 'unmatched_payout'
  | 'duplicate_payment';

export interface ReconciliationRun {
  id: string;
  startedAt: DateTimeString;
  completedAt: DateTimeString | null;
  status: 'running' | 'completed' | 'failed';
  reconciliationType: 'payments' | 'payouts';
  recordsChecked: number;
  discrepanciesFound: number;
  errorMessage: string | null;
}

export interface ReconciliationDiscrepancy {
  id: string;
  runId: string;
  type: ReconciliationDiscrepancyType;
  entityType: 'payment' | 'payout';
  entityId: string;
  internalAmount: MinorCurrencyAmount | null;
  externalAmount: MinorCurrencyAmount | null;
  internalStatus: string | null;
  externalStatus: string | null;
  notes: string | null;
  resolvedBy: string | null;
  resolvedAt: DateTimeString | null;
  resolution: string | null;
  createdAt: DateTimeString;
}
