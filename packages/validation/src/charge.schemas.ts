import { z } from 'zod';

// ── Enum schemas ──────────────────────────────────────────────────────────────

export const chargeCategorySchema = z.enum([
  'commission', 'tax', 'duty', 'fee', 'levy', 'surcharge', 'discount', 'withholding', 'fx', 'adjustment',
]);

export const chargeScopeSchema = z.enum([
  'booking_level', 'booking_item_level', 'payment_level', 'refund_level',
  'payout_level', 'commission_level', 'settlement_level',
]);

export const chargeBaseTypeSchema = z.enum([
  'booking_subtotal', 'item_subtotal', 'commission_amount', 'payout_amount',
  'payment_amount', 'another_charge', 'manual',
]);

export const calcMethodSchema = z.enum([
  'fixed', 'percentage', 'percentage_of_charge', 'tiered_percentage', 'formula',
  'minimum_capped', 'maximum_capped', 'inclusive_tax', 'exclusive_tax',
]);

export const chargeTimingSchema = z.enum([
  'booking_quote', 'booking_confirm', 'payment_capture', 'refund', 'payout', 'reconciliation',
]);

export const refundBehaviorSchema = z.enum([
  'fully_refundable', 'proportionally_refundable', 'non_refundable',
  'refundable_before_service_only', 'refundable_before_payout_only', 'manual_review_required',
]);

export const chargePayerSchema = z.enum(['customer', 'provider', 'platform']);
export const chargeBeneficiarySchema = z.enum(['platform', 'government', 'provider', 'customer']);
export const dependencyTypeSchema = z.enum(['base_of', 'after', 'exclusive']);

// ── Tier config ───────────────────────────────────────────────────────────────

export const tieredRateConfigSchema = z.object({
  tiers: z.array(z.object({
    from: z.number().int().nonnegative(),
    to: z.number().int().positive().nullable(),
    rateBps: z.number().int().min(0).max(100_000),
  })).min(1),
});

export const ruleConditionSchema = z.object({
  field: z.enum(['booking_amount', 'provider_id', 'listing_category', 'country', 'region', 'service_date_day_of_week', 'guest_count']),
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in']),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

// ── Charge Definition CRUD ────────────────────────────────────────────────────

export const createChargeDefinitionSchema = z.object({
  code: z.string().min(1).max(64).regex(/^[A-Z0-9_]+$/, 'Code must be UPPER_SNAKE_CASE'),
  name: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
  category: chargeCategorySchema,
  scope: chargeScopeSchema,
  payer: chargePayerSchema,
  beneficiary: chargeBeneficiarySchema,
  baseType: chargeBaseTypeSchema,
  calcMethod: calcMethodSchema,
  calcPriority: z.number().int().min(1).max(999).default(100),
  isTaxable: z.boolean().default(false),
  isRecoverable: z.boolean().default(false),
  refundBehavior: refundBehaviorSchema.default('fully_refundable'),
  ledgerDebitAccountCode: z.string().max(20).optional(),
  ledgerCreditAccountCode: z.string().max(20).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  jurisdictionMetadata: z.record(z.unknown()).optional(),
  requiresApproval: z.boolean().default(false),
});

export const updateChargeDefinitionSchema = createChargeDefinitionSchema
  .partial()
  .extend({ isEnabled: z.boolean().optional() });

// ── Rule Set CRUD ─────────────────────────────────────────────────────────────

export const createChargeRuleSetSchema = z.object({
  chargeDefinitionId: z.string().min(1),
  name: z.string().min(1).max(128),
  jurisdictionCountry: z.string().length(2).toUpperCase().optional(),
  jurisdictionRegion: z.string().max(64).optional(),
  providerId: z.string().optional(),
  listingCategory: z.string().max(64).optional(),
  minBookingAmount: z.number().int().nonnegative().optional(),
  maxBookingAmount: z.number().int().positive().optional(),
  priority: z.number().int().min(0).max(1000).default(0),
});

// ── Rule CRUD ─────────────────────────────────────────────────────────────────

export const createChargeRuleSchema = z.object({
  ruleSetId: z.string().min(1),
  calcMethod: calcMethodSchema,
  rateBps: z.number().int().min(0).max(100_000).optional(),
  fixedAmount: z.number().int().nonnegative().optional(),
  currencyCode: z.string().length(3).toUpperCase().optional(),
  minAmount: z.number().int().nonnegative().optional(),
  maxAmount: z.number().int().positive().optional(),
  formula: z.string().max(1024).optional(),
  tieredConfig: tieredRateConfigSchema.optional(),
  conditions: z.array(ruleConditionSchema).optional(),
  isInclusive: z.boolean().default(false),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).superRefine((data, ctx) => {
  if (data.calcMethod === 'fixed' && data.fixedAmount === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'fixedAmount is required for fixed calc method', path: ['fixedAmount'] });
  }
  if (['percentage', 'percentage_of_charge', 'inclusive_tax', 'exclusive_tax', 'minimum_capped', 'maximum_capped'].includes(data.calcMethod) && data.rateBps === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'rateBps is required for percentage-based calc methods', path: ['rateBps'] });
  }
  if (data.calcMethod === 'tiered_percentage' && !data.tieredConfig) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'tieredConfig is required for tiered_percentage calc method', path: ['tieredConfig'] });
  }
});

export const updateChargeRuleSchema = z.object({
  rateBps: z.number().int().min(0).max(100_000).optional(),
  fixedAmount: z.number().int().nonnegative().optional(),
  minAmount: z.number().int().nonnegative().optional(),
  maxAmount: z.number().int().positive().optional(),
  tieredConfig: tieredRateConfigSchema.optional(),
  conditions: z.array(ruleConditionSchema).optional(),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isActive: z.boolean().optional(),
  changeReason: z.string().min(1).max(512),
});

// ── Charge Dependencies ───────────────────────────────────────────────────────

export const createChargeDependencySchema = z.object({
  dependentChargeId: z.string().min(1),
  dependsOnChargeId: z.string().min(1),
  dependencyType: dependencyTypeSchema,
}).superRefine((data, ctx) => {
  if (data.dependentChargeId === data.dependsOnChargeId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A charge cannot depend on itself', path: ['dependsOnChargeId'] });
  }
});

// ── Simulation ────────────────────────────────────────────────────────────────

export const chargeSimulationSchema = z.object({
  scope: chargeScopeSchema,
  timing: chargeTimingSchema,
  jurisdictionCountry: z.string().length(2).toUpperCase(),
  jurisdictionRegion: z.string().max(64).optional(),
  currencyCode: z.string().length(3).toUpperCase(),
  bookingSubtotal: z.number().int().nonnegative().optional(),
  itemSubtotal: z.number().int().nonnegative().optional(),
  commissionAmount: z.number().int().nonnegative().optional(),
  payoutAmount: z.number().int().nonnegative().optional(),
  paymentAmount: z.number().int().nonnegative().optional(),
  manualAmount: z.number().int().optional(),
  providerId: z.string().optional(),
  listingCategory: z.string().max(64).optional(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guestCount: z.number().int().positive().optional(),
  chargeDefinitionIds: z.array(z.string()).optional(),
});

// ── Jurisdiction Profiles ─────────────────────────────────────────────────────

export const upsertJurisdictionProfileSchema = z.object({
  countryCode: z.string().length(2).toUpperCase(),
  region: z.string().max(64).optional(),
  name: z.string().min(1).max(128),
  currencyCode: z.string().length(3).toUpperCase(),
  withholdingTaxBps: z.number().int().min(0).max(10_000).optional(),
  stampDutyBps: z.number().int().min(0).max(10_000).optional(),
  tourismLevyBps: z.number().int().min(0).max(10_000).optional(),
  applicableTaxCodes: z.array(z.string()).optional(),
  applicableChargeDefinitions: z.array(z.string()).optional(),
});

// ── Tax Codes ─────────────────────────────────────────────────────────────────

export const createTaxCodeSchema = z.object({
  code: z.string().min(1).max(32).regex(/^[A-Z0-9_]+$/),
  name: z.string().min(1).max(128),
  jurisdictionCountry: z.string().length(2).toUpperCase(),
  jurisdictionRegion: z.string().max(64).optional(),
  rateBps: z.number().int().min(0).max(10_000),
  appliesTo: z.enum(['commission', 'booking', 'service', 'all']),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
