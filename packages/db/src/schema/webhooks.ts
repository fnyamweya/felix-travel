import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { providerCallbackSubscriptions } from './providers.js';

export const webhookDeliveries = sqliteTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id').notNull().references(() => providerCallbackSubscriptions.id),
    event: text('event').notNull(),
    payload: text('payload').notNull(),
    status: text('status', { enum: ['pending', 'delivered', 'failed', 'retrying'] }).notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastAttemptAt: text('last_attempt_at'),
    nextRetryAt: text('next_retry_at'),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    errorMessage: text('error_message'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    subscriptionIdx: index('webhook_deliveries_subscription_idx').on(t.subscriptionId),
    statusIdx: index('webhook_deliveries_status_idx').on(t.status),
    nextRetryIdx: index('webhook_deliveries_next_retry_idx').on(t.nextRetryAt),
  })
);
