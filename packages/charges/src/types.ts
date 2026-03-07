// ─── Enums (as const arrays + type unions) ────────────────────────────────────

export const CHARGE_CATEGORIES = [
  'commission', 'tax', 'duty', 'fee', 'levy', 'surcharge', 'discount', 'withholding', 'fx', 'adjustment',
] as const;
export type ChargeCategory = (typeof CHARGE_CATEGORIES)[number];

export const CHARGE_SCOPES = [
  'booking_level', 'booking_item_level', 'payment_level', 'refund_level',
  'payout_level', 'commission_level', 'settlement_level',
] as const;
export type ChargeScope = (typeof CHARGE_SCOPES)[number];

export const CHARGE_BASE_TYPES = [
  'booking_subtotal', 'item_subtotal', 'commission_amount', 'payout_amount',
  'payment_amount', 'another_charge', 'manual',
] as const;
export type ChargeBaseType = (typeof CHARGE_BASE_TYPES)[number];

export const CALC_METHODS = [
  'fixed', 'percentage', 'percentage_of_charge', 'tiered_percentage', 'formula',
  'minimum_capped', 'maximum_capped', 'inclusive_tax', 'exclusive_tax',
] as const;
export type CalcMethod = (typeof CALC_METHODS)[number];

export const CHARGE_TIMINGS = [
  'booking_quote', 'booking_confirm', 'payment_capture', 'refund', 'payout', 'reconciliation',
] as const;
export type ChargeTiming = (typeof CHARGE_TIMINGS)[number];

export const REFUND_BEHAVIORS = [
  'fully_refundable', 'proportionally_refundable', 'non_refundable',
  'refundable_before_service_only', 'refundable_before_payout_only', 'manual_review_required',
] as const;
export type RefundBehavior = (typeof REFUND_BEHAVIORS)[number];

export const CHARGE_PAYERS = ['customer', 'provider', 'platform'] as const;
export type ChargePayer = (typeof CHARGE_PAYERS)[number];

export const CHARGE_BENEFICIARIES = ['platform', 'government', 'provider', 'customer'] as const;
export type ChargeBeneficiary = (typeof CHARGE_BENEFICIARIES)[number];

export const DEPENDENCY_TYPES = ['base_of', 'after', 'exclusive'] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

// ─── Engine I/O ───────────────────────────────────────────────────────────────

export interface TieredRateConfig {
  tiers: Array<{ from: number; to: number | null; rateBps: number }>;
}

export interface RuleCondition {
  field:
  | 'booking_amount'
  | 'provider_id'
  | 'listing_category'
  | 'country'
  | 'region'
  | 'service_date_day_of_week'
  | 'guest_count';
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in';
  value: string | number | string[];
}

/** Input context provided to the charge engine for a single calculation pass. */
export interface ChargeCalculationContext {
  scope: ChargeScope;
  timing: ChargeTiming;
  jurisdictionCountry: string;   // ISO 3166-1 alpha-2
  jurisdictionRegion?: string;
  currencyCode: string;
  // Base amounts — all in minor currency units (integer cents)
  bookingSubtotal?: number;
  itemSubtotal?: number;
  commissionAmount?: number;
  payoutAmount?: number;
  paymentAmount?: number;
  manualAmount?: number;
  // Entity references for conditions
  bookingId?: string;
  bookingItemId?: string;
  paymentId?: string;
  refundId?: string;
  payoutId?: string;
  providerId?: string;
  listingCategory?: string;
  serviceDate?: string;
  guestCount?: number;
}

/** A single computed charge line from the engine. */
export interface ChargeLineResult {
  chargeDefinitionId: string;
  chargeCode: string;
  chargeName: string;
  category: ChargeCategory;
  scope: ChargeScope;
  payer: ChargePayer;
  beneficiary: ChargeBeneficiary;
  baseAmount: number;       // what the rate/formula was applied to
  rateBps?: number;         // effective rate in basis points (if percentage-based)
  fixedAmount?: number;     // effective fixed amount (if fixed)
  chargeAmount: number;     // final calculated charge (minor units)
  currencyCode: string;
  isInclusive: boolean;     // true = included in base price, false = added on top
  timing: ChargeTiming;
  refundBehavior: RefundBehavior;
  appliesCustomerSide: boolean;
  appliesProviderSide: boolean;
  ledgerDebitAccountCode?: string;
  ledgerCreditAccountCode?: string;
  ruleSetId?: string;
  ruleId?: string;
}

export interface CustomerBreakdown {
  subtotal: number;
  taxLines: ChargeLineResult[];
  dutyLines: ChargeLineResult[];
  levyLines: ChargeLineResult[];
  feeLines: ChargeLineResult[];
  surchargeLines: ChargeLineResult[];
  discountLines: ChargeLineResult[];
  discountTotal: number;
  chargesTotal: number;     // sum of all additive customer-side charges
  total: number;            // subtotal + chargesTotal - discountTotal
  currencyCode: string;
}

export interface ProviderBreakdown {
  grossBookingValue: number;
  commissionLines: ChargeLineResult[];
  taxOnCommissionLines: ChargeLineResult[];
  withholdingLines: ChargeLineResult[];
  fxLines: ChargeLineResult[];
  feeLines: ChargeLineResult[];
  totalDeductions: number;
  netPayable: number;       // grossBookingValue - totalDeductions
  currencyCode: string;
}

export interface PlatformBreakdown {
  totalRevenue: number;     // sum of commission lines
  taxLiability: number;     // VAT/GST/sales tax collected
  withholdingLiability: number; // withholding tax held before remittance
  levyLiability: number;    // tourism levies, etc.
  currencyCode: string;
}

/** Full breakdown output from the charge engine. */
export interface ChargeBreakdown {
  lines: ChargeLineResult[];
  customer: CustomerBreakdown;
  provider: ProviderBreakdown;
  platform: PlatformBreakdown;
}

/** Per-line refund analysis. */
export interface RefundChargeAllocation {
  bookingChargeLineId: string;
  chargeCode: string;
  originalChargeAmount: number;
  refundedChargeAmount: number;
  nonRefundableAmount: number;
  refundBehavior: RefundBehavior;
  requiresManualReview: boolean;
}

/** Input to charge simulation (admin preview). */
export interface ChargeSimulationRequest {
  context: ChargeCalculationContext;
  chargeDefinitionIds?: string[]; // restrict to specific definitions; undefined = all
}

/** Output from charge simulation. */
export interface ChargeSimulationResponse {
  breakdown: ChargeBreakdown;
  appliedRules: Array<{
    chargeCode: string;
    ruleSetId: string;
    ruleId: string;
    matchedConditions: string[];
  }>;
}

// ─── Repository row types (mirror Drizzle inference for use outside db package) ─

export interface ChargeDefinitionRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: ChargeCategory;
  scope: ChargeScope;
  payer: ChargePayer;
  beneficiary: ChargeBeneficiary;
  baseType: ChargeBaseType;
  calcMethod: CalcMethod;
  calcPriority: number;
  isTaxable: boolean;
  isRecoverable: boolean;
  refundBehavior: RefundBehavior;
  ledgerDebitAccountCode: string | null;
  ledgerCreditAccountCode: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  jurisdictionMetadata: string | null;
  isEnabled: boolean;
  requiresApproval: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChargeRuleSetRow {
  id: string;
  chargeDefinitionId: string;
  name: string;
  jurisdictionCountry: string | null;
  jurisdictionRegion: string | null;
  providerId: string | null;
  listingCategory: string | null;
  minBookingAmount: number | null;
  maxBookingAmount: number | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChargeRuleRow {
  id: string;
  ruleSetId: string;
  calcMethod: CalcMethod;
  rateBps: number | null;
  fixedAmount: number | null;
  currencyCode: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  formula: string | null;
  tieredConfig: string | null;  // JSON-encoded TieredRateConfig
  conditions: string | null;    // JSON-encoded RuleCondition[]
  isInclusive: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  createdAt: string;
}

export interface ChargeDependencyRow {
  id: string;
  dependentChargeId: string;
  dependsOnChargeId: string;
  dependencyType: DependencyType;
  createdAt: string;
}

export interface BookingChargeLineRow {
  id: string;
  bookingId: string;
  bookingItemId: string | null;
  chargeDefinitionId: string;
  chargeRuleId: string | null;
  jurisdictionCountry: string | null;
  scope: string;
  payer: string;
  beneficiary: string;
  baseAmount: number;
  rateBps: number | null;
  fixedAmount: number | null;
  chargeAmount: number;
  currencyCode: string;
  isInclusive: boolean;
  isVoid: boolean;
  timing: string;
  appliesCustomerSide: boolean;
  appliesProviderSide: boolean;
  createdAt: string;
}
