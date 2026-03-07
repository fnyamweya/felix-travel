import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { serviceProviders, providerPayoutAccounts } from './providers.js';
import { bookings } from './bookings.js';

export const payoutBatches = sqliteTable(
  'payout_batches',
  {
    id: text('id').primaryKey(),
    status: text('status', { enum: ['draft', 'approved', 'processing', 'completed', 'failed'] }).notNull().default('draft'),
    totalAmount: integer('total_amount').notNull(),
    currencyCode: text('currency_code').notNull(),
    payoutCount: integer('payout_count').notNull().default(0),
    approvedBy: text('approved_by').references(() => users.id),
    approvedAt: text('approved_at'),
    processedAt: text('processed_at'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  }
);

export const payouts = sqliteTable(
  'payouts',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id').notNull().references(() => serviceProviders.id),
    payoutAccountId: text('payout_account_id').notNull().references(() => providerPayoutAccounts.id),
    batchId: text('batch_id').references(() => payoutBatches.id),
    status: text('status', {
      enum: ['pending', 'scheduled', 'processing', 'succeeded', 'failed', 'reversed', 'on_hold'],
    }).notNull().default('pending'),
    amount: integer('amount').notNull(),
    currencyCode: text('currency_code').notNull(),
    destinationAmount: integer('destination_amount'),
    destinationCurrency: text('destination_currency'),
    fxRateSnapshot: real('fx_rate_snapshot'),
    tinggPaymentRef: text('tingg_payment_ref'),
    tinggTransactionRef: text('tingg_transaction_ref'),
    idempotencyKey: text('idempotency_key').notNull(),
    holdReason: text('hold_reason'),
    failureReason: text('failure_reason'),
    approvedBy: text('approved_by').references(() => users.id),
    scheduledAt: text('scheduled_at'),
    processedAt: text('processed_at'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    providerIdx: index('payouts_provider_idx').on(t.providerId),
    statusIdx: index('payouts_status_idx').on(t.status),
    tinggPaymentIdx: uniqueIndex('payouts_tingg_payment_idx').on(t.tinggPaymentRef),
    idempotencyIdx: uniqueIndex('payouts_idempotency_idx').on(t.idempotencyKey),
  })
);

export const payoutBookingLinks = sqliteTable(
  'payout_booking_links',
  {
    id: text('id').primaryKey(),
    payoutId: text('payout_id').notNull().references(() => payouts.id, { onDelete: 'cascade' }),
    bookingId: text('booking_id').notNull().references(() => bookings.id),
    amount: integer('amount').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    payoutIdx: index('payout_booking_links_payout_idx').on(t.payoutId),
    unique: uniqueIndex('payout_booking_links_unique').on(t.payoutId, t.bookingId),
  })
);

export const payoutWebhooks = sqliteTable(
  'payout_webhooks',
  {
    id: text('id').primaryKey(),
    tinggEventId: text('tingg_event_id'),
    payoutId: text('payout_id').references(() => payouts.id),
    rawPayload: text('raw_payload').notNull(),
    processedStatus: text('processed_status', { enum: ['pending', 'processed', 'failed', 'duplicate'] }).notNull().default('pending'),
    processingError: text('processing_error'),
    receivedAt: text('received_at').notNull().default(sql`(datetime('now'))`),
    processedAt: text('processed_at'),
  },
  (t) => ({
    tinggEventIdx: index('payout_webhooks_tingg_event_idx').on(t.tinggEventId),
    payoutIdx: index('payout_webhooks_payout_idx').on(t.payoutId),
  })
);
