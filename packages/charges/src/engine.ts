import type {
  ChargeCalculationContext,
  ChargeBreakdown,
  ChargeLineResult,
  ChargeDefinitionRow,
  ChargeRuleSetRow,
  ChargeRuleRow,
  ChargeDependencyRow,
  TieredRateConfig,
  RuleCondition,
  CustomerBreakdown,
  ProviderBreakdown,
  PlatformBreakdown,
  RefundBehavior,
} from './types.js';
import { resolveCalculationOrder } from './dependency-resolver.js';
import { selectBestRuleSet, isDefinitionApplicable } from './jurisdiction.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function applyTiered(amount: number, config: TieredRateConfig): number {
  let total = 0;
  for (const tier of config.tiers) {
    if (amount <= tier.from) break;
    const upper = tier.to ?? Infinity;
    const applicable = Math.min(amount, upper) - tier.from;
    total += Math.round((applicable * tier.rateBps) / 10_000);
  }
  return total;
}

function evalCondition(cond: RuleCondition, ctx: ChargeCalculationContext): boolean {
  let actual: string | number | undefined;
  switch (cond.field) {
    case 'booking_amount':
      actual = ctx.bookingSubtotal ?? ctx.paymentAmount ?? ctx.payoutAmount;
      break;
    case 'provider_id':
      actual = ctx.providerId;
      break;
    case 'listing_category':
      actual = ctx.listingCategory;
      break;
    case 'country':
      actual = ctx.jurisdictionCountry;
      break;
    case 'region':
      actual = ctx.jurisdictionRegion;
      break;
    case 'guest_count':
      actual = ctx.guestCount;
      break;
    case 'service_date_day_of_week':
      actual = ctx.serviceDate ? new Date(ctx.serviceDate).getDay().toString() : undefined;
      break;
    default:
      return false;
  }

  if (actual === undefined || actual === null) return false;

  switch (cond.op) {
    case 'eq': return actual == cond.value;
    case 'neq': return actual != cond.value;
    case 'gt': return (actual as number) > (cond.value as number);
    case 'gte': return (actual as number) >= (cond.value as number);
    case 'lt': return (actual as number) < (cond.value as number);
    case 'lte': return (actual as number) <= (cond.value as number);
    case 'in': return Array.isArray(cond.value) && (cond.value as string[]).includes(String(actual));
    case 'not_in': return Array.isArray(cond.value) && !(cond.value as string[]).includes(String(actual));
    default: return false;
  }
}

function ruleConditionsMet(rule: ChargeRuleRow, ctx: ChargeCalculationContext): boolean {
  if (!rule.conditions) return true;
  try {
    const conditions = JSON.parse(rule.conditions) as RuleCondition[];
    return conditions.every((c) => evalCondition(c, ctx));
  } catch {
    return true;
  }
}

function selectApplicableRule(rules: ChargeRuleRow[], ctx: ChargeCalculationContext, referenceDate: string): ChargeRuleRow | null {
  const active = rules.filter((r) => {
    if (!r.isActive) return false;
    if (r.effectiveFrom > referenceDate) return false;
    if (r.effectiveTo !== null && r.effectiveTo < referenceDate) return false;
    return ruleConditionsMet(r, ctx);
  });
  // Return the rule with the highest version (most recent)
  if (active.length === 0) return null;
  return active.reduce((best, r) => (r.version > best.version ? r : best));
}

function computeBaseAmount(
  def: ChargeDefinitionRow,
  ctx: ChargeCalculationContext,
  computedAmounts: Map<string, number>,
): number {
  switch (def.baseType) {
    case 'booking_subtotal': return ctx.bookingSubtotal ?? 0;
    case 'item_subtotal': return ctx.itemSubtotal ?? 0;
    case 'commission_amount': return ctx.commissionAmount ?? computedAmounts.get('PLATFORM_COMMISSION') ?? 0;
    case 'payout_amount': return ctx.payoutAmount ?? 0;
    case 'payment_amount': return ctx.paymentAmount ?? 0;
    case 'manual': return ctx.manualAmount ?? 0;
    case 'another_charge': return 0; // resolved via baseOf map in caller
    default: return 0;
  }
}

function applyRule(base: number, rule: ChargeRuleRow): number {
  let amount: number;

  switch (rule.calcMethod) {
    case 'fixed':
      amount = rule.fixedAmount ?? 0;
      break;

    case 'percentage':
    case 'exclusive_tax':
      amount = Math.round((base * (rule.rateBps ?? 0)) / 10_000);
      break;

    case 'inclusive_tax': {
      // For inclusive tax: the base already includes the tax.
      // tax = base - base / (1 + rate). Simplify: tax = base * rate / (10000 + rate)
      const r = rule.rateBps ?? 0;
      amount = Math.round((base * r) / (10_000 + r));
      break;
    }

    case 'percentage_of_charge':
      amount = Math.round((base * (rule.rateBps ?? 0)) / 10_000);
      break;

    case 'tiered_percentage': {
      if (rule.tieredConfig) {
        try {
          amount = applyTiered(base, JSON.parse(rule.tieredConfig) as TieredRateConfig);
        } catch {
          amount = 0;
        }
      } else {
        amount = 0;
      }
      break;
    }

    case 'minimum_capped':
      amount = Math.max(
        rule.minAmount ?? 0,
        Math.round((base * (rule.rateBps ?? 0)) / 10_000),
      );
      break;

    case 'maximum_capped':
      amount = Math.min(
        rule.maxAmount ?? Number.MAX_SAFE_INTEGER,
        Math.round((base * (rule.rateBps ?? 0)) / 10_000),
      );
      break;

    case 'formula':
      // Sandboxed formula eval not available in Workers; fall back to fixed amount
      amount = rule.fixedAmount ?? 0;
      break;

    default:
      amount = 0;
  }

  // Apply floor/ceiling caps (separate from tiered/minimum_capped/maximum_capped)
  if (rule.minAmount !== null && rule.minAmount !== undefined && amount < rule.minAmount) {
    amount = rule.minAmount;
  }
  if (rule.maxAmount !== null && rule.maxAmount !== undefined && amount > rule.maxAmount) {
    amount = rule.maxAmount;
  }

  return amount;
}

function categorizeSide(def: ChargeDefinitionRow): { customer: boolean; provider: boolean } {
  // Customer pays taxes, duties, levies, surcharges, fees added on top, discounts
  const customerCategories = new Set(['tax', 'duty', 'levy', 'surcharge', 'fee', 'discount']);
  // Provider-side: commission, withholding, fx, some fees
  const providerCategories = new Set(['commission', 'withholding', 'fx']);
  // Adjustment can be both
  const customer = customerCategories.has(def.category) || def.payer === 'customer';
  const provider = providerCategories.has(def.category) || def.payer === 'provider';
  return { customer, provider };
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export interface EngineInput {
  context: ChargeCalculationContext;
  definitions: ChargeDefinitionRow[];
  ruleSets: ChargeRuleSetRow[];
  /** All rules for the above rule sets */
  rules: ChargeRuleRow[];
  dependencies: ChargeDependencyRow[];
  /** Reference date for effectiveFrom/To checks (ISO 8601 date, defaults to today) */
  referenceDate?: string;
}

/**
 * Calculates all applicable charges for the given context.
 *
 * Processing steps:
 *  1. Filter definitions by enabled + effective + scope
 *  2. Resolve calculation order via topological sort
 *  3. For each definition (in order):
 *     a. Select best-matching rule set
 *     b. Select applicable rule within set
 *     c. Resolve base amount (handling 'another_charge' base type via baseOf map)
 *     d. Compute charge amount
 *     e. Record line result
 *  4. Build customer / provider / platform breakdowns
 */
export function calculateCharges(input: EngineInput): {
  breakdown: ChargeBreakdown;
  appliedRules: Array<{ chargeCode: string; ruleSetId: string; ruleId: string; matchedConditions: string[] }>;
} {
  const refDate = input.referenceDate ?? today();

  // Step 1: Filter enabled + effective definitions for this scope
  const applicable = input.definitions.filter((d) =>
    isDefinitionApplicable(d, input.context, refDate)
  );

  // Step 2: Topological sort
  const { orderedDefinitions, baseOf, excluded } = resolveCalculationOrder(applicable, input.dependencies);

  // Index rule sets and rules by definition
  const ruleSetsByDef = new Map<string, ChargeRuleSetRow[]>();
  for (const rs of input.ruleSets) {
    const arr = ruleSetsByDef.get(rs.chargeDefinitionId) ?? [];
    arr.push(rs);
    ruleSetsByDef.set(rs.chargeDefinitionId, arr);
  }
  const rulesBySet = new Map<string, ChargeRuleRow[]>();
  for (const rule of input.rules) {
    const arr = rulesBySet.get(rule.ruleSetId) ?? [];
    arr.push(rule);
    rulesBySet.set(rule.ruleSetId, arr);
  }

  const lines: ChargeLineResult[] = [];
  const computedAmounts = new Map<string, number>(); // chargeDefinitionId → computedAmount
  const appliedRules: Array<{ chargeCode: string; ruleSetId: string; ruleId: string; matchedConditions: string[] }> = [];

  // Step 3: Calculate each definition in order
  for (const def of orderedDefinitions) {
    if (excluded.has(def.id)) continue;

    // Select rule set
    const candidateRuleSets = ruleSetsByDef.get(def.id) ?? [];
    const bestRuleSet = selectBestRuleSet(candidateRuleSets, input.context);
    if (!bestRuleSet) continue; // no applicable rule set → skip this charge

    // Select rule within set
    const setRules = rulesBySet.get(bestRuleSet.id) ?? [];
    const rule = selectApplicableRule(setRules, input.context, refDate);
    if (!rule) continue; // no active rule → skip

    // Resolve base amount
    let baseAmount: number;
    const baseOfId = baseOf.get(def.id);
    if (baseOfId) {
      // Use the computed amount from the charge this depends on
      baseAmount = computedAmounts.get(baseOfId) ?? 0;
    } else {
      baseAmount = computeBaseAmount(def, input.context, computedAmounts);
    }

    // Compute the charge amount
    const chargeAmount = applyRule(baseAmount, rule);
    computedAmounts.set(def.id, chargeAmount);

    // Determine which sides this charge applies to
    const { customer, provider } = categorizeSide(def);

    const line: ChargeLineResult = {
      chargeDefinitionId: def.id,
      chargeCode: def.code,
      chargeName: def.name,
      category: def.category,
      scope: def.scope,
      payer: def.payer,
      beneficiary: def.beneficiary,
      baseAmount,
      ...(rule.rateBps !== null && rule.rateBps !== undefined && { rateBps: rule.rateBps }),
      ...(rule.fixedAmount !== null && rule.fixedAmount !== undefined && { fixedAmount: rule.fixedAmount }),
      chargeAmount,
      currencyCode: input.context.currencyCode,
      isInclusive: rule.isInclusive,
      timing: input.context.timing,
      refundBehavior: def.refundBehavior,
      appliesCustomerSide: customer,
      appliesProviderSide: provider,
      ...(def.ledgerDebitAccountCode !== null && def.ledgerDebitAccountCode !== undefined && { ledgerDebitAccountCode: def.ledgerDebitAccountCode }),
      ...(def.ledgerCreditAccountCode !== null && def.ledgerCreditAccountCode !== undefined && { ledgerCreditAccountCode: def.ledgerCreditAccountCode }),
      ruleSetId: bestRuleSet.id,
      ruleId: rule.id,
    };

    lines.push(line);

    // Track conditions that were matched (for simulation output)
    const matchedConditions: string[] = [];
    if (rule.conditions) {
      try {
        const conds = JSON.parse(rule.conditions) as RuleCondition[];
        for (const c of conds) {
          if (evalCondition(c, input.context)) {
            matchedConditions.push(`${c.field} ${c.op} ${JSON.stringify(c.value)}`);
          }
        }
      } catch { /* ignore */ }
    }
    appliedRules.push({ chargeCode: def.code, ruleSetId: bestRuleSet.id, ruleId: rule.id, matchedConditions });
  }

  // Step 4: Build breakdowns
  const breakdown = buildBreakdown(lines, input.context);
  return { breakdown, appliedRules };
}

function buildBreakdown(lines: ChargeLineResult[], ctx: ChargeCalculationContext): ChargeBreakdown {
  const currency = ctx.currencyCode;
  const subtotal = ctx.bookingSubtotal ?? ctx.paymentAmount ?? ctx.payoutAmount ?? 0;

  // Customer breakdown
  const customerLines = lines.filter((l) => l.appliesCustomerSide);
  const taxLines = customerLines.filter((l) => l.category === 'tax');
  const dutyLines = customerLines.filter((l) => l.category === 'duty');
  const levyLines = customerLines.filter((l) => l.category === 'levy');
  const feeLines = customerLines.filter((l) => l.category === 'fee' && l.payer === 'customer');
  const surchargeLines = customerLines.filter((l) => l.category === 'surcharge');
  const discountLines = customerLines.filter((l) => l.category === 'discount');

  // Discounts reduce the total; charges add to it
  const discountTotal = discountLines.reduce((s, l) => s + l.chargeAmount, 0);
  const exclusiveTaxSum = [...taxLines, ...dutyLines, ...levyLines, ...feeLines, ...surchargeLines]
    .filter((l) => !l.isInclusive)
    .reduce((s, l) => s + l.chargeAmount, 0);
  const chargesTotal = exclusiveTaxSum;
  const customerTotal = subtotal + chargesTotal - discountTotal;

  const customer: CustomerBreakdown = {
    subtotal,
    taxLines,
    dutyLines,
    levyLines,
    feeLines,
    surchargeLines,
    discountLines,
    discountTotal,
    chargesTotal,
    total: customerTotal,
    currencyCode: currency,
  };

  // Provider breakdown
  const providerLines = lines.filter((l) => l.appliesProviderSide);
  const commissionLines = providerLines.filter((l) => l.category === 'commission');
  const taxOnCommissionLines = providerLines.filter((l) => l.category === 'tax' && l.appliesProviderSide);
  const withholdingLines = providerLines.filter((l) => l.category === 'withholding');
  const fxLines = providerLines.filter((l) => l.category === 'fx');
  const providerFeeLines = providerLines.filter((l) => l.category === 'fee' && l.payer === 'provider');

  const gross = ctx.bookingSubtotal ?? ctx.payoutAmount ?? 0;
  const totalDeductions = [...commissionLines, ...taxOnCommissionLines, ...withholdingLines, ...fxLines, ...providerFeeLines]
    .reduce((s, l) => s + l.chargeAmount, 0);

  const provider: ProviderBreakdown = {
    grossBookingValue: gross,
    commissionLines,
    taxOnCommissionLines,
    withholdingLines,
    fxLines,
    feeLines: providerFeeLines,
    totalDeductions,
    netPayable: gross - totalDeductions,
    currencyCode: currency,
  };

  // Platform breakdown
  const totalRevenue = commissionLines.reduce((s, l) => s + l.chargeAmount, 0);
  const taxLiability = taxLines.reduce((s, l) => s + l.chargeAmount, 0);
  const withholdingLiability = withholdingLines.reduce((s, l) => s + l.chargeAmount, 0);
  const levyLiability = levyLines.reduce((s, l) => s + l.chargeAmount, 0);

  const platform: PlatformBreakdown = {
    totalRevenue,
    taxLiability,
    withholdingLiability,
    levyLiability,
    currencyCode: currency,
  };

  return { lines, customer, provider, platform };
}

/**
 * Calculates how much of each booking charge line should be refunded,
 * given a refund ratio (refundAmount / originalPaymentAmount).
 */
export function allocateRefundCharges(
  bookingChargeLines: Array<{
    id: string;
    chargeCode: string;
    chargeAmount: number;
    refundBehavior: RefundBehavior;
    currencyCode: string;
  }>,
  opts: {
    refundRatio: number; // 0..1, fraction of the booking being refunded
    isBeforePayout: boolean;
    isBeforeServiceDate: boolean;
  },
): Array<{
  bookingChargeLineId: string;
  chargeCode: string;
  originalChargeAmount: number;
  refundedChargeAmount: number;
  nonRefundableAmount: number;
  refundBehavior: RefundBehavior;
  requiresManualReview: boolean;
}> {
  return bookingChargeLines.map((line) => {
    let refundedAmount = 0;
    let requiresManualReview = false;
    const original = line.chargeAmount;

    switch (line.refundBehavior) {
      case 'fully_refundable':
        refundedAmount = Math.round(original * opts.refundRatio);
        break;

      case 'proportionally_refundable':
        refundedAmount = Math.round(original * opts.refundRatio);
        break;

      case 'non_refundable':
        refundedAmount = 0;
        break;

      case 'refundable_before_service_only':
        refundedAmount = opts.isBeforeServiceDate
          ? Math.round(original * opts.refundRatio)
          : 0;
        break;

      case 'refundable_before_payout_only':
        refundedAmount = opts.isBeforePayout
          ? Math.round(original * opts.refundRatio)
          : 0;
        break;

      case 'manual_review_required':
        refundedAmount = 0;
        requiresManualReview = true;
        break;

      default:
        refundedAmount = 0;
    }

    return {
      bookingChargeLineId: line.id,
      chargeCode: line.chargeCode,
      originalChargeAmount: original,
      refundedChargeAmount: refundedAmount,
      nonRefundableAmount: original - refundedAmount,
      refundBehavior: line.refundBehavior,
      requiresManualReview,
    };
  });
}
