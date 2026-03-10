import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { bookings, bookingItems } from './bookings.js';

export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    bookingId: text('booking_id').notNull().references(() => bookings.id),
    customerId: text('customer_id').notNull().references(() => users.id),
    status: text('status', {
      enum: ['initiated', 'pending_customer_action', 'pending_provider', 'processing', 'succeeded', 'partially_refunded', 'refunded', 'failed', 'reversed'],
    }).notNull().default('initiated'),
    method: text('method'),
    amount: integer('amount').notNull(),
    currencyCode: text('currency_code').notNull(),
    tinggCheckoutRequestId: text('tingg_checkout_request_id'),
    tinggMerchantTxId: text('tingg_merchant_tx_id'),
    tinggTransactionRef: text('tingg_transaction_ref'),
    checkoutUrl: text('checkout_url'),
    idempotencyKey: text('idempotency_key').notNull(),
    paidAt: text('paid_at'),
    failureReason: text('failure_reason'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    bookingIdx: index('payments_booking_idx').on(t.bookingId),
    statusIdx: index('payments_status_idx').on(t.status),
    tinggCheckoutIdx: index('payments_tingg_checkout_idx').on(t.tinggCheckoutRequestId),
    merchantIdx: uniqueIndex('payments_tingg_merchant_idx').on(t.tinggMerchantTxId),
  })
);

export const paymentAttempts = sqliteTable(
  'payment_attempts',
  {
    id: text('id').primaryKey(),
    paymentId: text('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
    idempotencyKey: text('idempotency_key').notNull(),
    tinggRequestId: text('tingg_request_id'),
    status: text('status', { enum: ['pending', 'succeeded', 'failed'] }).notNull(),
    requestPayload: text('request_payload').notNull(),
    responsePayload: text('response_payload'),
    errorMessage: text('error_message'),
    attemptedAt: text('attempted_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    paymentIdx: index('payment_attempts_payment_idx').on(t.paymentId),
    idempotencyIdx: uniqueIndex('payment_attempts_idempotency_idx').on(t.idempotencyKey),
  })
);

export const paymentWebhooks = sqliteTable(
  'payment_webhooks',
  {
    id: text('id').primaryKey(),
    tinggEventId: text('tingg_event_id'),
    paymentId: text('payment_id').references(() => payments.id),
    rawPayload: text('raw_payload').notNull(),
    processedStatus: text('processed_status', {
      enum: ['pending', 'processed', 'failed', 'duplicate'],
    }).notNull().default('pending'),
    processingError: text('processing_error'),
    receivedAt: text('received_at').notNull().default(sql`(datetime('now'))`),
    processedAt: text('processed_at'),
  },
  (t) => ({
    tinggEventIdx: index('payment_webhooks_tingg_event_idx').on(t.tinggEventId),
    paymentIdx: index('payment_webhooks_payment_idx').on(t.paymentId),
  })
);

export const refunds = sqliteTable(
  'refunds',
  {
    id: text('id').primaryKey(),
    paymentId: text('payment_id').notNull().references(() => payments.id),
    bookingId: text('booking_id').notNull().references(() => bookings.id),
    requestedBy: text('requested_by').notNull().references(() => users.id),
    approvedBy: text('approved_by').references(() => users.id),
    status: text('status', {
      enum: ['pending_approval', 'approved', 'processing', 'succeeded', 'failed', 'rejected'],
    }).notNull().default('pending_approval'),
    reason: text('reason').notNull(),
    amount: integer('amount').notNull(),
    currencyCode: text('currency_code').notNull(),
    tinggRefundRef: text('tingg_refund_ref'),
    idempotencyKey: text('idempotency_key').notNull(),
    refundedAt: text('refunded_at'),
    rejectedAt: text('rejected_at'),
    rejectionReason: text('rejection_reason'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    paymentIdx: index('refunds_payment_idx').on(t.paymentId),
    bookingIdx: index('refunds_booking_idx').on(t.bookingId),
    statusIdx: index('refunds_status_idx').on(t.status),
  })
);

export const refundItems = sqliteTable(
  'refund_items',
  {
    id: text('id').primaryKey(),
    refundId: text('refund_id').notNull().references(() => refunds.id, { onDelete: 'cascade' }),
    bookingItemId: text('booking_item_id').notNull().references(() => bookingItems.id),
    amount: integer('amount').notNull(),
    providerDeduction: integer('provider_deduction').notNull(),
    platformDeduction: integer('platform_deduction').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ refundIdx: index('refund_items_refund_idx').on(t.refundId) })
);

// ── Payment Splits ────────────────────────────────────────────────────────────
// Supports split payments: a single booking can be paid via multiple methods.
// Each split is a separate Tingg checkout that contributes to the total.
export const paymentSplits = sqliteTable(
  'payment_splits',
  {
    id: text('id').primaryKey(),
    paymentId: text('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
    splitIndex: integer('split_index').notNull(),
    method: text('method', {
      enum: ['mpesa', 'card', 'bank_transfer', 'ussd', 'wallet'],
    }).notNull(),
    amount: integer('amount').notNull(),
    currencyCode: text('currency_code').notNull(),
    status: text('status', {
      enum: ['pending', 'processing', 'succeeded', 'failed'],
    }).notNull().default('pending'),
    tinggCheckoutRequestId: text('tingg_checkout_request_id'),
    tinggMerchantTxId: text('tingg_merchant_tx_id'),
    accountNumber: text('account_number').notNull(),
    paidAt: text('paid_at'),
    failureReason: text('failure_reason'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    paymentIdx: index('payment_splits_payment_idx').on(t.paymentId),
    statusIdx: index('payment_splits_status_idx').on(t.status),
    merchantIdx: uniqueIndex('payment_splits_merchant_idx').on(t.tinggMerchantTxId),
  })
);
