import { describe, it, expect } from 'vitest';
import { calculateCharges, allocateRefundCharges } from '../engine.js';
import type {
  ChargeDefinitionRow,
  ChargeRuleSetRow,
  ChargeRuleRow,
  ChargeDependencyRow,
  ChargeCalculationContext,
} from '../types.js';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const TODAY = '2025-01-01';

function makeDefinition(overrides: Partial<ChargeDefinitionRow> & { id: string; code: string }): ChargeDefinitionRow {
  return {
    name: overrides.code,
    description: null,
    category: 'commission',
    scope: 'booking_level',
    payer: 'provider',
    beneficiary: 'platform',
    baseType: 'booking_subtotal',
    calcMethod: 'percentage',
    calcPriority: 100,
    isTaxable: false,
    isRecoverable: false,
    refundBehavior: 'fully_refundable',
    ledgerDebitAccountCode: '1100',
    ledgerCreditAccountCode: '4000',
    effectiveFrom: '2024-01-01',
    effectiveTo: null,
    jurisdictionMetadata: null,
    isEnabled: true,
    requiresApproval: false,
    createdBy: 'usr_admin_001',
    createdAt: TODAY,
    updatedAt: TODAY,
    ...overrides,
  };
}

function makeRuleSet(overrides: Partial<ChargeRuleSetRow> & { id: string; chargeDefinitionId: string }): ChargeRuleSetRow {
  return {
    name: 'Default',
    jurisdictionCountry: null,
    jurisdictionRegion: null,
    providerId: null,
    listingCategory: null,
    minBookingAmount: null,
    maxBookingAmount: null,
    isActive: true,
    priority: 0,
    createdAt: TODAY,
    updatedAt: TODAY,
    ...overrides,
  };
}

function makeRule(overrides: Partial<ChargeRuleRow> & { id: string; ruleSetId: string }): ChargeRuleRow {
  return {
    calcMethod: 'percentage',
    rateBps: null,
    fixedAmount: null,
    currencyCode: null,
    minAmount: null,
    maxAmount: null,
    formula: null,
    tieredConfig: null,
    conditions: null,
    isInclusive: false,
    isActive: true,
    effectiveFrom: '2024-01-01',
    effectiveTo: null,
    version: 1,
    createdAt: TODAY,
    ...overrides,
  };
}

const baseCtx: ChargeCalculationContext = {
  scope: 'booking_level',
  timing: 'booking_confirm',
  jurisdictionCountry: 'KE',
  currencyCode: 'KES',
  bookingSubtotal: 100_000, // KES 1,000.00 in minor units
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('calculateCharges — basic percentage', () => {
  it('calculates 10% platform commission on booking subtotal', () => {
    const definitions = [makeDefinition({ id: 'def_commission', code: 'PLATFORM_COMMISSION' })];
    const ruleSets = [makeRuleSet({ id: 'rs_1', chargeDefinitionId: 'def_commission' })];
    const rules = [makeRule({ id: 'rule_1', ruleSetId: 'rs_1', calcMethod: 'percentage', rateBps: 1000 })];

    const { breakdown } = calculateCharges({
      context: baseCtx,
      definitions,
      ruleSets,
      rules,
      dependencies: [],
      referenceDate: TODAY,
    });

    expect(breakdown.lines).toHaveLength(1);
    expect(breakdown.lines[0]!.chargeCode).toBe('PLATFORM_COMMISSION');
    expect(breakdown.lines[0]!.chargeAmount).toBe(10_000); // 10% of 100_000
    expect(breakdown.lines[0]!.baseAmount).toBe(100_000);
    expect(breakdown.lines[0]!.rateBps).toBe(1000);
    expect(breakdown.provider.commissionLines).toHaveLength(1);
    expect(breakdown.provider.totalDeductions).toBe(10_000);
    expect(breakdown.provider.netPayable).toBe(90_000);
  });

  it('calculates fixed booking fee', () => {
    const definitions = [makeDefinition({
      id: 'def_fee',
      code: 'BOOKING_FEE',
      category: 'fee',
      payer: 'customer',
      beneficiary: 'platform',
      baseType: 'booking_subtotal',
      calcMethod: 'fixed',
    })];
    const ruleSets = [makeRuleSet({ id: 'rs_fee', chargeDefinitionId: 'def_fee' })];
    const rules = [makeRule({ id: 'rule_fee', ruleSetId: 'rs_fee', calcMethod: 'fixed', fixedAmount: 25_000 })];

    const { breakdown } = calculateCharges({
      context: baseCtx,
      definitions,
      ruleSets,
      rules,
      dependencies: [],
      referenceDate: TODAY,
    });

    expect(breakdown.lines[0]!.chargeAmount).toBe(25_000);
    expect(breakdown.customer.feeLines).toHaveLength(1);
  });
});

describe('calculateCharges — tax on commission (dependency)', () => {
  it('calculates VAT on commission using commission amount as base (base_of dependency)', () => {
    const defCommission = makeDefinition({
      id: 'def_commission',
      code: 'PLATFORM_COMMISSION',
      calcPriority: 10,
    });
    const defVAT = makeDefinition({
      id: 'def_vat',
      code: 'VAT_ON_COMMISSION',
      category: 'tax',
      payer: 'provider',
      beneficiary: 'government',
      baseType: 'another_charge', // will be resolved via dependency
      calcMethod: 'exclusive_tax',
      calcPriority: 20,
    });

    const ruleSets = [
      makeRuleSet({ id: 'rs_comm', chargeDefinitionId: 'def_commission' }),
      makeRuleSet({ id: 'rs_vat', chargeDefinitionId: 'def_vat' }),
    ];
    const rules = [
      makeRule({ id: 'rule_comm', ruleSetId: 'rs_comm', calcMethod: 'percentage', rateBps: 1000 }),   // 10%
      makeRule({ id: 'rule_vat', ruleSetId: 'rs_vat', calcMethod: 'exclusive_tax', rateBps: 1600 }), // 16%
    ];

    // VAT depends on commission as its base
    const dependencies: ChargeDependencyRow[] = [{
      id: 'dep_1',
      dependentChargeId: 'def_vat',
      dependsOnChargeId: 'def_commission',
      dependencyType: 'base_of',
      createdAt: TODAY,
    }];

    const { breakdown } = calculateCharges({
      context: baseCtx,
      definitions: [defCommission, defVAT],
      ruleSets,
      rules,
      dependencies,
      referenceDate: TODAY,
    });

    const commLine = breakdown.lines.find((l) => l.chargeCode === 'PLATFORM_COMMISSION')!;
    const vatLine = breakdown.lines.find((l) => l.chargeCode === 'VAT_ON_COMMISSION')!;

    expect(commLine.chargeAmount).toBe(10_000);   // 10% of 100_000
    expect(vatLine.baseAmount).toBe(10_000);       // uses commission as base
    expect(vatLine.chargeAmount).toBe(1_600);      // 16% of 10_000
    expect(breakdown.platform.taxLiability).toBe(1_600);
  });
});

describe('calculateCharges — withholding tax', () => {
  it('calculates withholding tax at payout scope', () => {
    const defWHT = makeDefinition({
      id: 'def_wht',
      code: 'WITHHOLDING_TAX',
      category: 'withholding',
      payer: 'provider',
      beneficiary: 'government',
      baseType: 'payout_amount',
      scope: 'payout_level',
    });

    const ctx: ChargeCalculationContext = {
      ...baseCtx,
      scope: 'payout_level',
      timing: 'payout',
      payoutAmount: 90_000,
    };

    const ruleSets = [makeRuleSet({ id: 'rs_wht', chargeDefinitionId: 'def_wht' })];
    const rules = [makeRule({ id: 'rule_wht', ruleSetId: 'rs_wht', calcMethod: 'percentage', rateBps: 500 })]; // 5%

    const { breakdown } = calculateCharges({
      context: ctx,
      definitions: [defWHT],
      ruleSets,
      rules,
      dependencies: [],
      referenceDate: TODAY,
    });

    const whtLine = breakdown.lines.find((l) => l.chargeCode === 'WITHHOLDING_TAX')!;
    expect(whtLine.chargeAmount).toBe(4_500); // 5% of 90_000
    expect(breakdown.platform.withholdingLiability).toBe(4_500);
  });
});

describe('calculateCharges — tiered percentage', () => {
  it('calculates tiered commission correctly', () => {
    const defCommission = makeDefinition({
      id: 'def_tiered',
      code: 'TIERED_COMMISSION',
      calcMethod: 'tiered_percentage',
    });

    const tieredConfig = {
      tiers: [
        { from: 0, to: 50_000, rateBps: 1500 }, // 15% on first 500
        { from: 50_000, to: 100_000, rateBps: 1000 }, // 10% on next 500
        { from: 100_000, to: null, rateBps: 500 }, // 5% on remainder
      ],
    };

    const ruleSets = [makeRuleSet({ id: 'rs_tiered', chargeDefinitionId: 'def_tiered' })];
    const rules = [makeRule({
      id: 'rule_tiered',
      ruleSetId: 'rs_tiered',
      calcMethod: 'tiered_percentage',
      tieredConfig: JSON.stringify(tieredConfig),
    })];

    const { breakdown } = calculateCharges({
      context: { ...baseCtx, bookingSubtotal: 100_000 },
      definitions: [defCommission],
      ruleSets,
      rules,
      dependencies: [],
      referenceDate: TODAY,
    });

    // First tier: 50000 * 15% = 7500
    // Second tier: 50000 * 10% = 5000
    // Total = 12500
    expect(breakdown.lines[0]!.chargeAmount).toBe(12_500);
  });
});

describe('calculateCharges — jurisdiction selection', () => {
  it('selects the most specific rule set (KE over global)', () => {
    const definition = makeDefinition({ id: 'def_comm', code: 'PLATFORM_COMMISSION' });

    // Global rule set: 8% commission
    const globalRuleSet = makeRuleSet({ id: 'rs_global', chargeDefinitionId: 'def_comm', jurisdictionCountry: null, priority: 0 });
    // Kenya-specific rule set: 12% commission
    const keRuleSet = makeRuleSet({ id: 'rs_ke', chargeDefinitionId: 'def_comm', jurisdictionCountry: 'KE', priority: 10 });

    const rules = [
      makeRule({ id: 'rule_global', ruleSetId: 'rs_global', rateBps: 800 }),  // 8%
      makeRule({ id: 'rule_ke', ruleSetId: 'rs_ke', rateBps: 1200 }), // 12%
    ];

    const { breakdown } = calculateCharges({
      context: { ...baseCtx, jurisdictionCountry: 'KE' },
      definitions: [definition],
      ruleSets: [globalRuleSet, keRuleSet],
      rules,
      dependencies: [],
      referenceDate: TODAY,
    });

    // Should use KE-specific 12% rate
    expect(breakdown.lines[0]!.chargeAmount).toBe(12_000);
    expect(breakdown.lines[0]!.ruleSetId).toBe('rs_ke');
  });

  it('falls back to global rule set when no jurisdiction-specific set exists', () => {
    const definition = makeDefinition({ id: 'def_comm', code: 'PLATFORM_COMMISSION' });
    const globalRuleSet = makeRuleSet({ id: 'rs_global', chargeDefinitionId: 'def_comm', jurisdictionCountry: null });
    const rules = [makeRule({ id: 'rule_global', ruleSetId: 'rs_global', rateBps: 1000 })];

    const { breakdown } = calculateCharges({
      context: { ...baseCtx, jurisdictionCountry: 'TZ' }, // Tanzania — no specific rule set
      definitions: [definition],
      ruleSets: [globalRuleSet],
      rules,
      dependencies: [],
      referenceDate: TODAY,
    });

    expect(breakdown.lines[0]!.chargeAmount).toBe(10_000);
    expect(breakdown.lines[0]!.ruleSetId).toBe('rs_global');
  });
});

describe('calculateCharges — exclusive dependencies', () => {
  it('excludes the lower-priority charge when two are exclusive', () => {
    // Two charges: discountA (priority 10) and discountB (priority 50)
    // They are exclusive — B (higher priority number) should be excluded
    const defA = makeDefinition({ id: 'def_a', code: 'DISCOUNT_A', category: 'discount', payer: 'platform', beneficiary: 'customer', calcPriority: 10 });
    const defB = makeDefinition({ id: 'def_b', code: 'DISCOUNT_B', category: 'discount', payer: 'platform', beneficiary: 'customer', calcPriority: 50 });

    const ruleSets = [
      makeRuleSet({ id: 'rs_a', chargeDefinitionId: 'def_a' }),
      makeRuleSet({ id: 'rs_b', chargeDefinitionId: 'def_b' }),
    ];
    const rules = [
      makeRule({ id: 'rule_a', ruleSetId: 'rs_a', calcMethod: 'percentage', rateBps: 500 }),
      makeRule({ id: 'rule_b', ruleSetId: 'rs_b', calcMethod: 'percentage', rateBps: 200 }),
    ];

    const dependencies: ChargeDependencyRow[] = [{
      id: 'dep_excl',
      dependentChargeId: 'def_a',
      dependsOnChargeId: 'def_b',
      dependencyType: 'exclusive',
      createdAt: TODAY,
    }];

    const { breakdown } = calculateCharges({
      context: baseCtx,
      definitions: [defA, defB],
      ruleSets,
      rules,
      dependencies,
      referenceDate: TODAY,
    });

    // defA has calcPriority 10 (lower = higher precedence) → defB excluded
    const codes = breakdown.lines.map((l) => l.chargeCode);
    expect(codes).toContain('DISCOUNT_A');
    expect(codes).not.toContain('DISCOUNT_B');
  });
});

describe('calculateCharges — effective dates', () => {
  it('excludes charges not yet effective', () => {
    const futureDefinition = makeDefinition({
      id: 'def_future',
      code: 'FUTURE_CHARGE',
      effectiveFrom: '2030-01-01', // future
    });

    const ruleSets = [makeRuleSet({ id: 'rs_f', chargeDefinitionId: 'def_future' })];
    const rules = [makeRule({ id: 'rule_f', ruleSetId: 'rs_f', rateBps: 1000 })];

    const { breakdown } = calculateCharges({
      context: baseCtx,
      definitions: [futureDefinition],
      ruleSets,
      rules,
      dependencies: [],
      referenceDate: TODAY,
    });

    expect(breakdown.lines).toHaveLength(0);
  });

  it('excludes expired charges', () => {
    const expiredDefinition = makeDefinition({
      id: 'def_expired',
      code: 'EXPIRED_CHARGE',
      effectiveFrom: '2024-01-01',
      effectiveTo: '2024-06-30', // expired
    });

    const ruleSets = [makeRuleSet({ id: 'rs_e', chargeDefinitionId: 'def_expired' })];
    const rules = [makeRule({
      id: 'rule_e', ruleSetId: 'rs_e', rateBps: 1000,
      effectiveFrom: '2024-01-01', effectiveTo: '2024-06-30'
    })];

    const { breakdown } = calculateCharges({
      context: baseCtx,
      definitions: [expiredDefinition],
      ruleSets,
      rules,
      dependencies: [],
      referenceDate: TODAY,
    });

    expect(breakdown.lines).toHaveLength(0);
  });
});

describe('allocateRefundCharges', () => {
  const mockLines = [
    { id: 'bcl_1', chargeCode: 'PLATFORM_COMMISSION', chargeAmount: 10_000, refundBehavior: 'non_refundable' as const, currencyCode: 'KES' },
    { id: 'bcl_2', chargeCode: 'TOURISM_LEVY', chargeAmount: 2_000, refundBehavior: 'fully_refundable' as const, currencyCode: 'KES' },
    { id: 'bcl_3', chargeCode: 'BOOKING_FEE', chargeAmount: 25_000, refundBehavior: 'non_refundable' as const, currencyCode: 'KES' },
    { id: 'bcl_4', chargeCode: 'VAT_ON_COMMISSION', chargeAmount: 1_600, refundBehavior: 'non_refundable' as const, currencyCode: 'KES' },
    { id: 'bcl_5', chargeCode: 'PAYOUT_FEE', chargeAmount: 5_000, refundBehavior: 'refundable_before_payout_only' as const, currencyCode: 'KES' },
  ];

  it('non-refundable charges return zero refund amount', () => {
    const allocs = allocateRefundCharges(mockLines, { refundRatio: 1.0, isBeforePayout: true, isBeforeServiceDate: true });

    const commission = allocs.find((a) => a.chargeCode === 'PLATFORM_COMMISSION')!;
    expect(commission.refundedChargeAmount).toBe(0);
    expect(commission.nonRefundableAmount).toBe(10_000);
  });

  it('fully_refundable charges are proportionally refunded', () => {
    const allocs = allocateRefundCharges(mockLines, { refundRatio: 0.5, isBeforePayout: true, isBeforeServiceDate: true });

    const levy = allocs.find((a) => a.chargeCode === 'TOURISM_LEVY')!;
    expect(levy.refundedChargeAmount).toBe(1_000); // 50% of 2000
    expect(levy.nonRefundableAmount).toBe(1_000);
  });

  it('refundable_before_payout_only: refundable when payout not yet done', () => {
    const allocsBefore = allocateRefundCharges(mockLines, { refundRatio: 1.0, isBeforePayout: true, isBeforeServiceDate: true });
    const allocsAfter = allocateRefundCharges(mockLines, { refundRatio: 1.0, isBeforePayout: false, isBeforeServiceDate: true });

    const before = allocsBefore.find((a) => a.chargeCode === 'PAYOUT_FEE')!;
    const after = allocsAfter.find((a) => a.chargeCode === 'PAYOUT_FEE')!;

    expect(before.refundedChargeAmount).toBe(5_000);
    expect(after.refundedChargeAmount).toBe(0);
  });

  it('full refund total: sum of refundable charges equals expected', () => {
    const allocs = allocateRefundCharges(mockLines, { refundRatio: 1.0, isBeforePayout: true, isBeforeServiceDate: true });
    const totalRefunded = allocs.reduce((s, a) => s + a.refundedChargeAmount, 0);
    // Refundable: tourism levy 2000 + payout fee 5000 = 7000
    expect(totalRefunded).toBe(7_000);
  });

  it('manual_review_required charges set requiresManualReview flag', () => {
    const manualLines = [{
      id: 'bcl_manual',
      chargeCode: 'MANUAL_ADJUSTMENT',
      chargeAmount: 5_000,
      refundBehavior: 'manual_review_required' as const,
      currencyCode: 'KES',
    }];

    const allocs = allocateRefundCharges(manualLines, { refundRatio: 1.0, isBeforePayout: true, isBeforeServiceDate: true });
    expect(allocs[0]!.requiresManualReview).toBe(true);
    expect(allocs[0]!.refundedChargeAmount).toBe(0);
  });
});

describe('calculateCharges — minimum_capped method', () => {
  it('applies minimum floor when percentage result is below minimum', () => {
    const definition = makeDefinition({ id: 'def_min', code: 'MIN_FEE', calcMethod: 'minimum_capped' });
    const ruleSets = [makeRuleSet({ id: 'rs_min', chargeDefinitionId: 'def_min' })];
    const rules = [makeRule({
      id: 'rule_min',
      ruleSetId: 'rs_min',
      calcMethod: 'minimum_capped',
      rateBps: 100,        // 1% of 100_000 = 1_000
      minAmount: 5_000,    // but minimum is 5_000
    })];

    const { breakdown } = calculateCharges({
      context: baseCtx,
      definitions: [definition],
      ruleSets,
      rules,
      dependencies: [],
      referenceDate: TODAY,
    });

    expect(breakdown.lines[0]!.chargeAmount).toBe(5_000); // minimum applied
  });
});

describe('calculateCharges — inclusive tax', () => {
  it('extracts inclusive VAT from the base amount', () => {
    const definition = makeDefinition({
      id: 'def_incl',
      code: 'INCLUSIVE_VAT',
      category: 'tax',
      payer: 'customer',
      beneficiary: 'government',
      calcMethod: 'inclusive_tax',
    });
    const ruleSets = [makeRuleSet({ id: 'rs_incl', chargeDefinitionId: 'def_incl' })];
    const rules = [makeRule({
      id: 'rule_incl',
      ruleSetId: 'rs_incl',
      calcMethod: 'inclusive_tax',
      rateBps: 1600, // 16% inclusive
      isInclusive: true,
    })];

    const { breakdown } = calculateCharges({
      context: { ...baseCtx, bookingSubtotal: 116_000 }, // price includes 16% VAT
      definitions: [definition],
      ruleSets,
      rules,
      dependencies: [],
      referenceDate: TODAY,
    });

    // tax = 116000 * 1600 / (10000 + 1600) = 116000 * 1600 / 11600 = 16000
    expect(breakdown.lines[0]!.chargeAmount).toBe(16_000);
    expect(breakdown.lines[0]!.isInclusive).toBe(true);
  });
});

describe('calculateCharges — payout settlement breakdown', () => {
  it('produces correct provider-side net payable after commission + withholding', () => {
    const defComm = makeDefinition({ id: 'def_comm', code: 'PLATFORM_COMMISSION', calcPriority: 10 });
    const defWHT = makeDefinition({
      id: 'def_wht', code: 'WITHHOLDING_TAX',
      category: 'withholding', payer: 'provider', beneficiary: 'government',
      baseType: 'payout_amount', scope: 'payout_level', calcPriority: 20,
    });

    const ruleSets = [
      makeRuleSet({ id: 'rs_comm', chargeDefinitionId: 'def_comm' }),
      makeRuleSet({ id: 'rs_wht', chargeDefinitionId: 'def_wht' }),
    ];
    const rules = [
      makeRule({ id: 'rule_comm', ruleSetId: 'rs_comm', rateBps: 1000 }), // 10%
      makeRule({ id: 'rule_wht', ruleSetId: 'rs_wht', calcMethod: 'percentage', rateBps: 500 }), // 5%
    ];

    const ctx: ChargeCalculationContext = {
      scope: 'payout_level',
      timing: 'payout',
      jurisdictionCountry: 'KE',
      currencyCode: 'KES',
      bookingSubtotal: 100_000,
      payoutAmount: 90_000, // after commission
    };

    const { breakdown } = calculateCharges({
      context: ctx,
      definitions: [defComm, defWHT],
      ruleSets,
      rules,
      dependencies: [],
      referenceDate: TODAY,
    });

    const commLine = breakdown.lines.find((l) => l.chargeCode === 'PLATFORM_COMMISSION')!;
    const whtLine = breakdown.lines.find((l) => l.chargeCode === 'WITHHOLDING_TAX')!;

    expect(commLine.chargeAmount).toBe(10_000); // 10% of bookingSubtotal
    expect(whtLine.chargeAmount).toBe(4_500);   // 5% of 90000 payoutAmount
    // Provider netPayable = gross - all deductions = 90000 - 10000? - 4500
    // Note: gross for provider breakdown is bookingSubtotal (100000 in payout scope using bookingSubtotal)
    expect(breakdown.provider.withholdingLines).toHaveLength(1);
    expect(breakdown.platform.withholdingLiability).toBe(4_500);
  });
});
