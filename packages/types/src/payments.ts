import type { DateTimeString, MinorCurrencyAmount } from './common.js';

export type PaymentStatus =
  | 'initiated'
  | 'pending_customer_action'
  | 'pending_provider'
  | 'processing'
  | 'succeeded'
  | 'partially_refunded'
  | 'refunded'
  | 'failed'
  | 'reversed';

export type PaymentMethod = 'mpesa' | 'card' | 'bank_transfer' | 'ussd' | 'wallet';

export interface Payment {
  id: string;
  bookingId: string;
  customerId: string;
  status: PaymentStatus;
  method: PaymentMethod | null;
  amount: MinorCurrencyAmount;
  currencyCode: string;
  tinggCheckoutRequestId: string | null;
  tinggMerchantTxId: string | null;
  tinggTransactionRef: string | null;
  checkoutUrl: string | null;
  idempotencyKey: string;
  paidAt: DateTimeString | null;
  failureReason: string | null;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}

export interface PaymentAttempt {
  id: string;
  paymentId: string;
  idempotencyKey: string;
  tinggRequestId: string | null;
  status: 'pending' | 'succeeded' | 'failed';
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown> | null;
  errorMessage: string | null;
  attemptedAt: DateTimeString;
}

export interface Refund {
  id: string;
  paymentId: string;
  bookingId: string;
  requestedBy: string;
  approvedBy: string | null;
  status: RefundStatus;
  reason: string;
  amount: MinorCurrencyAmount;
  currencyCode: string;
  tinggRefundRef: string | null;
  refundedAt: DateTimeString | null;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
  items: RefundItem[];
}

export type RefundStatus =
  | 'pending_approval'
  | 'approved'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'rejected';

export interface RefundItem {
  id: string;
  refundId: string;
  bookingItemId: string;
  amount: MinorCurrencyAmount;
  /** Amount deducted from provider payable (pre-payout refund path) */
  providerDeduction: MinorCurrencyAmount;
  /** Amount absorbed from platform commission */
  platformDeduction: MinorCurrencyAmount;
}

// ── Payment Splits ──────────────────────────────────────────────────────────

export type PaymentSplitStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

export interface PaymentSplit {
  id: string;
  paymentId: string;
  splitIndex: number;
  method: PaymentMethod;
  amount: MinorCurrencyAmount;
  currencyCode: string;
  status: PaymentSplitStatus;
  tinggCheckoutRequestId: string | null;
  tinggMerchantTxId: string | null;
  accountNumber: string | null;
  paidAt: DateTimeString | null;
  failureReason: string | null;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}
