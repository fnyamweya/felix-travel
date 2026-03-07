import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const serviceProviders = sqliteTable(
  'service_providers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    email: text('email').notNull(),
    phone: text('phone'),
    countryCode: text('country_code').notNull().default('KE'),
    currencyCode: text('currency_code').notNull().default('KES'),
    logoUrl: text('logo_url'),
    websiteUrl: text('website_url'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
    reserveBalanceAmount: integer('reserve_balance_amount').notNull().default(0),
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    slugIdx: uniqueIndex('service_providers_slug_idx').on(t.slug),
    emailIdx: index('service_providers_email_idx').on(t.email),
  })
);

export const providerMemberships = sqliteTable(
  'provider_memberships',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id').notNull().references(() => serviceProviders.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    memberRole: text('member_role', { enum: ['owner', 'manager', 'staff'] }).notNull().default('staff'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    providerUserIdx: uniqueIndex('provider_memberships_prov_user_idx').on(t.providerId, t.userId),
  })
);

export const providerSettings = sqliteTable('provider_settings', {
  providerId: text('provider_id').primaryKey().references(() => serviceProviders.id, { onDelete: 'cascade' }),
  settlementDelayDays: integer('settlement_delay_days'),
  autoApprovePayout: integer('auto_approve_payout', { mode: 'boolean' }).notNull().default(false),
  commissionBps: integer('commission_bps').notNull().default(1000),
  notifyOnBooking: integer('notify_on_booking', { mode: 'boolean' }).notNull().default(true),
  notifyOnPayout: integer('notify_on_payout', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const providerPayoutAccounts = sqliteTable(
  'provider_payout_accounts',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id').notNull().references(() => serviceProviders.id, { onDelete: 'cascade' }),
    accountType: text('account_type', { enum: ['mobile_money', 'bank_account', 'remittance'] }).notNull(),
    accountNumber: text('account_number').notNull(),
    accountName: text('account_name').notNull(),
    networkCode: text('network_code').notNull(),
    countryCode: text('country_code').notNull(),
    currencyCode: text('currency_code').notNull(),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
    validationSnapshot: text('validation_snapshot'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    providerIdx: index('payout_accounts_provider_idx').on(t.providerId),
  })
);

export const providerCallbackSubscriptions = sqliteTable(
  'provider_callback_subscriptions',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id').notNull().references(() => serviceProviders.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    events: text('events').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    secretHash: text('secret_hash').notNull(),
    secretHint: text('secret_hint').notNull(),
    maxRetries: integer('max_retries').notNull().default(5),
    timeoutMs: integer('timeout_ms').notNull().default(10000),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    providerIdx: index('callback_subs_provider_idx').on(t.providerId),
  })
);
