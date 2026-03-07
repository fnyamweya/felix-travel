import type { DateTimeString, MinorCurrencyAmount } from './common.js';

export type PayoutStatus =
  | 'pending'
  | 'scheduled'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'reversed'
  | 'on_hold';

export interface Payout {
  id: string;
  providerId: string;
  payoutAccountId: string;
  batchId: string | null;
  status: PayoutStatus;
  amount: MinorCurrencyAmount;
  currencyCode: string;
  destinationAmount: MinorCurrencyAmount | null;
  destinationCurrency: string | null;
  /** FX rate snapshot at initiation — immutable after creation */
  fxRateSnapshot: number | null;
  tinggPaymentRef: string | null;
  tinggTransactionRef: string | null;
  idempotencyKey: string;
  scheduledAt: DateTimeString | null;
  processedAt: DateTimeString | null;
  failureReason: string | null;
  holdReason: string | null;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}

export interface PayoutBatch {
  id: string;
  status: 'draft' | 'approved' | 'processing' | 'completed' | 'failed';
  totalAmount: MinorCurrencyAmount;
  currencyCode: string;
  payoutCount: number;
  approvedBy: string | null;
  processedAt: DateTimeString | null;
  createdAt: DateTimeString;
}
