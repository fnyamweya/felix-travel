import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { serviceProviders } from './providers.js';
import { users } from './users.js';

export const ledgerAccounts = sqliteTable(
  'ledger_accounts',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: text('type', { enum: ['asset', 'liability', 'equity', 'revenue', 'expense'] }).notNull(),
    providerId: text('provider_id').references(() => serviceProviders.id),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    codeProviderIdx: uniqueIndex('ledger_accounts_code_provider_idx').on(t.code, t.providerId),
  })
);

// Immutable journal entries — NEVER mutate, only create reversal entries
export const ledgerEntries = sqliteTable(
  'ledger_entries',
  {
    id: text('id').primaryKey(),
    type: text('type', {
      enum: ['booking_payment', 'commission_recognition', 'provider_payable_recognition', 'payout_issuance', 'payout_failure_unwind', 'refund_issuance', 'refund_provider_deduction', 'reversal', 'manual_adjustment', 'fx_gain_loss'],
    }).notNull(),
    referenceType: text('reference_type', { enum: ['booking', 'payment', 'refund', 'payout', 'manual'] }).notNull(),
    referenceId: text('reference_id').notNull(),
    description: text('description').notNull(),
    effectiveDate: text('effective_date').notNull(),
    createdBy: text('created_by').notNull().references(() => users.id),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    referenceIdx: index('ledger_entries_reference_idx').on(t.referenceType, t.referenceId),
    effectiveDateIdx: index('ledger_entries_effective_date_idx').on(t.effectiveDate),
  })
);

export const ledgerEntryLines = sqliteTable(
  'ledger_entry_lines',
  {
    id: text('id').primaryKey(),
    entryId: text('entry_id').notNull().references(() => ledgerEntries.id),
    accountId: text('account_id').notNull().references(() => ledgerAccounts.id),
    debitAmount: integer('debit_amount').notNull().default(0),
    creditAmount: integer('credit_amount').notNull().default(0),
    currencyCode: text('currency_code').notNull(),
    memo: text('memo'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    entryIdx: index('ledger_entry_lines_entry_idx').on(t.entryId),
    accountIdx: index('ledger_entry_lines_account_idx').on(t.accountId),
  })
);

export const commissions = sqliteTable(
  'commissions',
  {
    id: text('id').primaryKey(),
    bookingId: text('booking_id').notNull(),
    bookingItemId: text('booking_item_id'),
    providerId: text('provider_id').notNull().references(() => serviceProviders.id),
    rateBps: integer('rate_bps').notNull(),
    baseAmount: integer('base_amount').notNull(),
    commissionAmount: integer('commission_amount').notNull(),
    currencyCode: text('currency_code').notNull(),
    status: text('status', { enum: ['pending', 'earned', 'reversed'] }).notNull().default('pending'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ bookingIdx: index('commissions_booking_idx').on(t.bookingId) })
);
