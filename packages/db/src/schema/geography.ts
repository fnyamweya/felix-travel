import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ── Countries ─────────────────────────────────────────────────────────────────
export const countries = sqliteTable(
  'countries',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),           // ISO 3166-1 alpha-2
    code3: text('code3'),                   // ISO 3166-1 alpha-3
    numericCode: text('numeric_code'),      // ISO 3166-1 numeric
    name: text('name').notNull(),
    officialName: text('official_name'),
    continent: text('continent', {
      enum: ['africa', 'asia', 'europe', 'north_america', 'south_america', 'oceania', 'antarctica'],
    }),
    capitalCity: text('capital_city'),
    phoneCode: text('phone_code'),          // e.g. "+254"
    defaultCurrencyCode: text('default_currency_code'),
    flagEmoji: text('flag_emoji'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    codeIdx: uniqueIndex('countries_code_idx').on(t.code),
    nameIdx: index('countries_name_idx').on(t.name),
    activeIdx: index('countries_active_idx').on(t.isActive),
  })
);

// ── Currencies ────────────────────────────────────────────────────────────────
export const currencies = sqliteTable(
  'currencies',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),           // ISO 4217 alpha-3 (KES, USD, EUR)
    numericCode: text('numeric_code'),      // ISO 4217 numeric
    name: text('name').notNull(),
    symbol: text('symbol').notNull(),       // e.g. "KSh", "$", "€"
    symbolNative: text('symbol_native'),
    decimalDigits: integer('decimal_digits').notNull().default(2),
    rounding: integer('rounding').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    codeIdx: uniqueIndex('currencies_code_idx').on(t.code),
    activeIdx: index('currencies_active_idx').on(t.isActive),
  })
);

// ── Country-Currency mapping ──────────────────────────────────────────────────
export const countryCurrencies = sqliteTable(
  'country_currencies',
  {
    id: text('id').primaryKey(),
    countryCode: text('country_code').notNull(),
    currencyCode: text('currency_code').notNull(),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    uniqueIdx: uniqueIndex('country_currencies_unique_idx').on(t.countryCode, t.currencyCode),
    countryIdx: index('country_currencies_country_idx').on(t.countryCode),
    currencyIdx: index('country_currencies_currency_idx').on(t.currencyCode),
  })
);

// ── Regions ───────────────────────────────────────────────────────────────────
export const regions = sqliteTable(
  'regions',
  {
    id: text('id').primaryKey(),
    countryCode: text('country_code').notNull(),
    name: text('name').notNull(),
    code: text('code'),                     // e.g. "KE-30" for Nairobi
    parentId: text('parent_id'),            // self-reference for hierarchy
    level: integer('level').notNull().default(1), // 1 = province/state, 2 = county, 3 = subcounty
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    countryIdx: index('regions_country_idx').on(t.countryCode),
    parentIdx: index('regions_parent_idx').on(t.parentId),
    nameIdx: index('regions_name_idx').on(t.countryCode, t.name),
    codeIdx: index('regions_code_idx').on(t.code),
  })
);

// ── Region Closure Table ──────────────────────────────────────────────────────
// Stores transitive closure of parent-child relationships for efficient
// ancestor/descendant queries. Each region has a self-referencing row (depth=0).
export const regionClosure = sqliteTable(
  'region_closure',
  {
    id: text('id').primaryKey(),
    ancestorId: text('ancestor_id').notNull(),
    descendantId: text('descendant_id').notNull(),
    depth: integer('depth').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    ancestorIdx: index('region_closure_ancestor_idx').on(t.ancestorId),
    descendantIdx: index('region_closure_descendant_idx').on(t.descendantId),
    uniqueIdx: uniqueIndex('region_closure_unique_idx').on(t.ancestorId, t.descendantId),
  })
);
