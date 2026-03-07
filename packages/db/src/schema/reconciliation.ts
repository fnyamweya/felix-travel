import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const reconciliationRuns = sqliteTable('reconciliation_runs', {
  id: text('id').primaryKey(),
  startedAt: text('started_at').notNull().default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
  status: text('status', { enum: ['running', 'completed', 'failed'] }).notNull().default('running'),
  reconciliationType: text('reconciliation_type', { enum: ['payments', 'payouts'] }).notNull(),
  recordsChecked: integer('records_checked').notNull().default(0),
  discrepanciesFound: integer('discrepancies_found').notNull().default(0),
  errorMessage: text('error_message'),
});

export const reconciliationDiscrepancies = sqliteTable(
  'reconciliation_discrepancies',
  {
    id: text('id').primaryKey(),
    runId: text('run_id').notNull().references(() => reconciliationRuns.id),
    type: text('type', {
      enum: ['missing_tingg_record', 'amount_mismatch', 'status_mismatch', 'unmatched_payout', 'duplicate_payment'],
    }).notNull(),
    entityType: text('entity_type', { enum: ['payment', 'payout'] }).notNull(),
    entityId: text('entity_id').notNull(),
    internalAmount: integer('internal_amount'),
    externalAmount: integer('external_amount'),
    internalStatus: text('internal_status'),
    externalStatus: text('external_status'),
    notes: text('notes'),
    resolvedBy: text('resolved_by').references(() => users.id),
    resolvedAt: text('resolved_at'),
    resolution: text('resolution'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ runIdx: index('recon_discrepancies_run_idx').on(t.runId) })
);
