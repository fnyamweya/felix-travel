import type { PaymentStatus, PayoutStatus } from '@felix-travel/types';

/**
 * Maps Tingg requestStatusCode values to internal platform statuses.
 * See Tingg API docs section 4.1 for full status code reference.
 */
export const TINGG_PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  // Terminal success
  '178': 'succeeded',    // Payment successful
  // Pending states
  '188': 'pending_customer_action', // Awaiting customer action (e.g. STK push pending)
  '183': 'processing',   // Payment processing
  // Terminal failure
  '180': 'failed',       // Payment failed
  '179': 'failed',       // Insufficient funds
  '189': 'failed',       // Transaction timeout
  '200': 'failed',       // General failure
};

export const TINGG_PAYOUT_STATUS_MAP: Record<string, PayoutStatus> = {
  '178': 'succeeded',    // Payout successful
  '188': 'processing',   // Payout processing
  '183': 'processing',   // In progress
  '180': 'failed',       // Payout failed
  '200': 'failed',       // General failure
};

export function mapTinggPaymentStatus(statusCode: string): PaymentStatus {
  return TINGG_PAYMENT_STATUS_MAP[statusCode] ?? 'processing';
}

export function mapTinggPayoutStatus(statusCode: string): PayoutStatus {
  return TINGG_PAYOUT_STATUS_MAP[statusCode] ?? 'processing';
}

/** Whether we should acknowledge this payment based on status */
export function shouldAcknowledgePayment(statusCode: string): boolean {
  return statusCode === '178'; // Only acknowledge successful payments
}
