import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { serviceProviders } from './providers.js';
import { users } from './users.js';
import { bookings, bookingItems } from './bookings.js';
import { refunds } from './payments.js';
import { payouts } from './payouts.js';
import { ledgerEntries } from './ledger.js';

// ── Charge Definitions ────────────────────────────────────────────────────────
// A charge definition is the canonical description of a charge type: what it is,
// how it's calculated, who pays/benefits, and how it maps to the ledger.
export const chargeDefinitions = sqliteTable(
  'charge_definitions',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category', {
      enum: ['commission', 'tax', 'duty', 'fee', 'levy', 'surcharge', 'discount', 'withholding', 'fx', 'adjustment'],
    }).notNull(),
    scope: text('scope', {
      enum: ['booking_level', 'booking_item_level', 'payment_level', 'refund_level', 'payout_level', 'commission_level', 'settlement_level'],
    }).notNull(),
    payer: text('payer', { enum: ['customer', 'provider', 'platform'] }).notNull(),
    beneficiary: text('beneficiary', { enum: ['platform', 'government', 'provider', 'customer'] }).notNull(),
    baseType: text('base_type', {
      enum: ['booking_subtotal', 'item_subtotal', 'commission_amount', 'payout_amount', 'payment_amount', 'another_charge', 'manual'],
    }).notNull(),
    calcMethod: text('calc_method', {
      enum: ['fixed', 'percentage', 'percentage_of_charge', 'tiered_percentage', 'formula', 'minimum_capped', 'maximum_capped', 'inclusive_tax', 'exclusive_tax'],
    }).notNull(),
    calcPriority: integer('calc_priority').notNull().default(100),
    isTaxable: integer('is_taxable', { mode: 'boolean' }).notNull().default(false),
    isRecoverable: integer('is_recoverable', { mode: 'boolean' }).notNull().default(false),
    refundBehavior: text('refund_behavior', {
      enum: ['fully_refundable', 'proportionally_refundable', 'non_refundable', 'refundable_before_service_only', 'refundable_before_payout_only', 'manual_review_required'],
    }).notNull().default('fully_refundable'),
    ledgerDebitAccountCode: text('ledger_debit_account_code'),
    ledgerCreditAccountCode: text('ledger_credit_account_code'),
    effectiveFrom: text('effective_from').notNull(),
    effectiveTo: text('effective_to'),
    jurisdictionMetadata: text('jurisdiction_metadata'),
    isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
    requiresApproval: integer('requires_approval', { mode: 'boolean' }).notNull().default(false),
    createdBy: text('created_by').notNull().references(() => users.id),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    codeIdx: uniqueIndex('charge_definitions_code_idx').on(t.code),
    categoryIdx: index('charge_definitions_category_idx').on(t.category),
    scopeIdx: index('charge_definitions_scope_idx').on(t.scope),
    enabledIdx: index('charge_definitions_enabled_idx').on(t.isEnabled),
  })
);

// ── Charge Rule Sets ──────────────────────────────────────────────────────────
// A rule set groups rules for a charge definition under a specific jurisdiction
// or provider/category context. Multiple rule sets can exist per definition;
// the engine picks the best matching one by jurisdiction specificity + priority.
export const chargeRuleSets = sqliteTable(
  'charge_rule_sets',
  {
    id: text('id').primaryKey(),
    chargeDefinitionId: text('charge_definition_id').notNull().references(() => chargeDefinitions.id),
    name: text('name').notNull(),
    jurisdictionCountry: text('jurisdiction_country'),
    jurisdictionRegion: text('jurisdiction_region'),
    providerId: text('provider_id').references(() => serviceProviders.id),
    listingCategory: text('listing_category'),
    minBookingAmount: integer('min_booking_amount'),
    maxBookingAmount: integer('max_booking_amount'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    priority: integer('priority').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    definitionIdx: index('charge_rule_sets_definition_idx').on(t.chargeDefinitionId),
    jurisdictionIdx: index('charge_rule_sets_jurisdiction_idx').on(t.jurisdictionCountry, t.jurisdictionRegion),
    providerIdx: index('charge_rule_sets_provider_idx').on(t.providerId),
  })
);

// ── Charge Rules ──────────────────────────────────────────────────────────────
// Individual rate/calculation rules within a rule set. Each rule carries
// optional conditions that must all pass for the rule to apply.
export const chargeRules = sqliteTable(
  'charge_rules',
  {
    id: text('id').primaryKey(),
    ruleSetId: text('rule_set_id').notNull().references(() => chargeRuleSets.id),
    calcMethod: text('calc_method', {
      enum: ['fixed', 'percentage', 'percentage_of_charge', 'tiered_percentage', 'formula', 'minimum_capped', 'maximum_capped', 'inclusive_tax', 'exclusive_tax'],
    }).notNull(),
    rateBps: integer('rate_bps'),
    fixedAmount: integer('fixed_amount'),
    currencyCode: text('currency_code'),
    minAmount: integer('min_amount'),
    maxAmount: integer('max_amount'),
    formula: text('formula'),
    tieredConfig: text('tiered_config'),
    conditions: text('conditions'),
    isInclusive: integer('is_inclusive', { mode: 'boolean' }).notNull().default(false),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    effectiveFrom: text('effective_from').notNull(),
    effectiveTo: text('effective_to'),
    version: integer('version').notNull().default(1),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    ruleSetIdx: index('charge_rules_rule_set_idx').on(t.ruleSetId),
    activeIdx: index('charge_rules_active_idx').on(t.isActive),
  })
);

// ── Charge Dependencies ───────────────────────────────────────────────────────
// Encodes the dependency graph between charge definitions.
// 'base_of'   — dependent charge uses depends_on's computed amount as its base
// 'after'     — dependent charge must be calculated after depends_on
// 'exclusive' — only one of dependent vs depends_on may apply in a context
export const chargeDependencies = sqliteTable(
  'charge_dependencies',
  {
    id: text('id').primaryKey(),
    dependentChargeId: text('dependent_charge_id').notNull().references(() => chargeDefinitions.id),
    dependsOnChargeId: text('depends_on_charge_id').notNull().references(() => chargeDefinitions.id),
    dependencyType: text('dependency_type', {
      enum: ['base_of', 'after', 'exclusive'],
    }).notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    uniqueDepIdx: uniqueIndex('charge_dependencies_unique_idx').on(t.dependentChargeId, t.dependsOnChargeId),
    dependentIdx: index('charge_dependencies_dependent_idx').on(t.dependentChargeId),
    dependsOnIdx: index('charge_dependencies_depends_on_idx').on(t.dependsOnChargeId),
  })
);

// ── Charge Rate Versions ──────────────────────────────────────────────────────
// Audit trail for every rate/amount change. Required for compliance and for
// reconstructing historical charges on archived bookings.
export const chargeRateVersions = sqliteTable(
  'charge_rate_versions',
  {
    id: text('id').primaryKey(),
    chargeRuleId: text('charge_rule_id').notNull().references(() => chargeRules.id),
    previousRateBps: integer('previous_rate_bps'),
    newRateBps: integer('new_rate_bps'),
    previousFixedAmount: integer('previous_fixed_amount'),
    newFixedAmount: integer('new_fixed_amount'),
    changedBy: text('changed_by').notNull().references(() => users.id),
    changeReason: text('change_reason'),
    approvalRecordId: text('approval_record_id'),
    effectiveFrom: text('effective_from').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    ruleIdx: index('charge_rate_versions_rule_idx').on(t.chargeRuleId),
    effectiveIdx: index('charge_rate_versions_effective_idx').on(t.effectiveFrom),
  })
);

// ── Tax Codes ─────────────────────────────────────────────────────────────────
// Reference table for tax codes by jurisdiction.
export const taxCodes = sqliteTable(
  'tax_codes',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    jurisdictionCountry: text('jurisdiction_country').notNull(),
    jurisdictionRegion: text('jurisdiction_region'),
    rateBps: integer('rate_bps').notNull(),
    appliesTo: text('applies_to', {
      enum: ['commission', 'booking', 'service', 'all'],
    }).notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    effectiveFrom: text('effective_from').notNull(),
    effectiveTo: text('effective_to'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    codeCountryIdx: uniqueIndex('tax_codes_code_country_idx').on(t.code, t.jurisdictionCountry),
    countryIdx: index('tax_codes_country_idx').on(t.jurisdictionCountry),
  })
);

// ── Jurisdiction Profiles ─────────────────────────────────────────────────────
// Per-country/region default charge settings. Used by the engine to determine
// which charge definitions and tax codes apply for a given booking location.
export const jurisdictionProfiles = sqliteTable(
  'jurisdiction_profiles',
  {
    id: text('id').primaryKey(),
    countryCode: text('country_code').notNull(),
    region: text('region'),
    name: text('name').notNull(),
    currencyCode: text('currency_code').notNull(),
    applicableTaxCodes: text('applicable_tax_codes'),
    applicableChargeDefinitions: text('applicable_charge_definitions'),
    withholdingTaxBps: integer('withholding_tax_bps'),
    stampDutyBps: integer('stamp_duty_bps'),
    tourismLevyBps: integer('tourism_levy_bps'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    countryRegionIdx: uniqueIndex('jurisdiction_profiles_country_region_idx').on(t.countryCode, t.region),
    activeIdx: index('jurisdiction_profiles_active_idx').on(t.isActive),
  })
);

// ── Booking Charge Lines ──────────────────────────────────────────────────────
// Persisted charge lines computed and applied to a specific booking (or item).
// These are immutable once created; void them by setting isVoid=true.
export const bookingChargeLines = sqliteTable(
  'booking_charge_lines',
  {
    id: text('id').primaryKey(),
    bookingId: text('booking_id').notNull().references(() => bookings.id),
    bookingItemId: text('booking_item_id').references(() => bookingItems.id),
    chargeDefinitionId: text('charge_definition_id').notNull().references(() => chargeDefinitions.id),
    chargeRuleId: text('charge_rule_id').references(() => chargeRules.id),
    jurisdictionCountry: text('jurisdiction_country'),
    scope: text('scope').notNull(),
    payer: text('payer').notNull(),
    beneficiary: text('beneficiary').notNull(),
    baseAmount: integer('base_amount').notNull(),
    rateBps: integer('rate_bps'),
    fixedAmount: integer('fixed_amount'),
    chargeAmount: integer('charge_amount').notNull(),
    currencyCode: text('currency_code').notNull(),
    isInclusive: integer('is_inclusive', { mode: 'boolean' }).notNull().default(false),
    isVoid: integer('is_void', { mode: 'boolean' }).notNull().default(false),
    timing: text('timing').notNull(),
    appliesCustomerSide: integer('applies_customer_side', { mode: 'boolean' }).notNull().default(false),
    appliesProviderSide: integer('applies_provider_side', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    bookingIdx: index('booking_charge_lines_booking_idx').on(t.bookingId),
    definitionIdx: index('booking_charge_lines_definition_idx').on(t.chargeDefinitionId),
    scopeIdx: index('booking_charge_lines_scope_idx').on(t.scope),
  })
);

// ── Refund Charge Lines ───────────────────────────────────────────────────────
// Tracks which portion (if any) of each booking charge is reversed on refund.
export const refundChargeLines = sqliteTable(
  'refund_charge_lines',
  {
    id: text('id').primaryKey(),
    refundId: text('refund_id').notNull().references(() => refunds.id),
    bookingChargeLineId: text('booking_charge_line_id').notNull().references(() => bookingChargeLines.id),
    originalChargeAmount: integer('original_charge_amount').notNull(),
    refundedChargeAmount: integer('refunded_charge_amount').notNull(),
    refundBehavior: text('refund_behavior').notNull(),
    currencyCode: text('currency_code').notNull(),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    refundIdx: index('refund_charge_lines_refund_idx').on(t.refundId),
    bookingChargeIdx: index('refund_charge_lines_booking_charge_idx').on(t.bookingChargeLineId),
  })
);

// ── Payout Charge Lines ───────────────────────────────────────────────────────
// Charges deducted from a provider payout (payout fees, FX markup, etc.).
export const payoutChargeLines = sqliteTable(
  'payout_charge_lines',
  {
    id: text('id').primaryKey(),
    payoutId: text('payout_id').notNull().references(() => payouts.id),
    bookingId: text('booking_id').references(() => bookings.id),
    chargeDefinitionId: text('charge_definition_id').notNull().references(() => chargeDefinitions.id),
    scope: text('scope').notNull(),
    description: text('description').notNull(),
    grossAmount: integer('gross_amount').notNull(),
    chargeAmount: integer('charge_amount').notNull(),
    netAmount: integer('net_amount').notNull(),
    currencyCode: text('currency_code').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    payoutIdx: index('payout_charge_lines_payout_idx').on(t.payoutId),
    definitionIdx: index('payout_charge_lines_definition_idx').on(t.chargeDefinitionId),
  })
);

// ── Invoice Charge Lines ──────────────────────────────────────────────────────
// Charge lines on provider settlement invoices/statements.
export const invoiceChargeLines = sqliteTable(
  'invoice_charge_lines',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id').notNull(),
    bookingId: text('booking_id').references(() => bookings.id),
    chargeDefinitionId: text('charge_definition_id').notNull().references(() => chargeDefinitions.id),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitAmount: integer('unit_amount').notNull(),
    totalAmount: integer('total_amount').notNull(),
    taxAmount: integer('tax_amount').notNull().default(0),
    currencyCode: text('currency_code').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    invoiceIdx: index('invoice_charge_lines_invoice_idx').on(t.invoiceId),
    bookingIdx: index('invoice_charge_lines_booking_idx').on(t.bookingId),
  })
);

// ── Charge Allocation Lines ───────────────────────────────────────────────────
// Bridges each charge line (booking/refund/payout) to specific ledger accounts.
// Created immediately when a charge is computed, posted when the ledger entry
// is written, reversed when the charge is voided.
export const chargeAllocationLines = sqliteTable(
  'charge_allocation_lines',
  {
    id: text('id').primaryKey(),
    chargeContextType: text('charge_context_type', {
      enum: ['booking_charge_line', 'payout_charge_line', 'refund_charge_line'],
    }).notNull(),
    chargeContextId: text('charge_context_id').notNull(),
    chargeDefinitionId: text('charge_definition_id').notNull().references(() => chargeDefinitions.id),
    amount: integer('amount').notNull(),
    currencyCode: text('currency_code').notNull(),
    debitAccountCode: text('debit_account_code').notNull(),
    creditAccountCode: text('credit_account_code').notNull(),
    ledgerEntryId: text('ledger_entry_id').references(() => ledgerEntries.id),
    status: text('status', { enum: ['pending', 'posted', 'reversed'] }).notNull().default('pending'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    contextIdx: index('charge_allocation_lines_context_idx').on(t.chargeContextType, t.chargeContextId),
    definitionIdx: index('charge_allocation_lines_definition_idx').on(t.chargeDefinitionId),
    statusIdx: index('charge_allocation_lines_status_idx').on(t.status),
    ledgerIdx: index('charge_allocation_lines_ledger_idx').on(t.ledgerEntryId),
  })
);
