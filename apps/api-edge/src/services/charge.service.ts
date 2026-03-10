import type { Env } from '../bindings.js';
import { createDbClient } from '@felix-travel/db';
import { ChargesRepository, ChargeService as CoreChargeService } from '@felix-travel/charges';
import type { ChargeCalculationContext, ChargeAssignmentTargetType } from '@felix-travel/charges';
import type { SessionContext } from '@felix-travel/types';
import { AppError } from '../lib/errors.js';
import { newId } from '../lib/id.js';

export class ChargeService {
  private repo: ChargesRepository;
  private core: CoreChargeService;

  constructor(env: Env) {
    const db = createDbClient(env.DB);
    this.repo = new ChargesRepository(db);
    this.core = new CoreChargeService(this.repo, db);
  }

  // ── Admin: Definitions ─────────────────────────────────────────────────────

  async listDefinitions() {
    return this.repo.listDefinitions();
  }

  async getDefinition(id: string) {
    const def = await this.repo.findDefinitionById(id);
    if (!def) throw new AppError('NOT_FOUND', 'Charge definition not found', 404);
    return def;
  }

  async createDefinition(data: {
    code: string;
    name: string;
    description?: string;
    category: string;
    scope: string;
    payer: string;
    beneficiary: string;
    baseType: string;
    calcMethod: string;
    calcPriority?: number;
    isTaxable?: boolean;
    isRecoverable?: boolean;
    refundBehavior?: string;
    ledgerDebitAccountCode?: string;
    ledgerCreditAccountCode?: string;
    effectiveFrom: string;
    effectiveTo?: string;
    jurisdictionMetadata?: Record<string, unknown>;
    requiresApproval?: boolean;
  }, actor: SessionContext) {
    return this.repo.createDefinition({
      id: newId(),
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      category: data.category as any,
      scope: data.scope as any,
      payer: data.payer as any,
      beneficiary: data.beneficiary as any,
      baseType: data.baseType as any,
      calcMethod: data.calcMethod as any,
      calcPriority: data.calcPriority ?? 100,
      isTaxable: data.isTaxable ?? false,
      isRecoverable: data.isRecoverable ?? false,
      refundBehavior: (data.refundBehavior ?? 'fully_refundable') as any,
      ledgerDebitAccountCode: data.ledgerDebitAccountCode ?? null,
      ledgerCreditAccountCode: data.ledgerCreditAccountCode ?? null,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo ?? null,
      jurisdictionMetadata: data.jurisdictionMetadata ? JSON.stringify(data.jurisdictionMetadata) : null,
      isEnabled: true,
      requiresApproval: data.requiresApproval ?? false,
      createdBy: actor.userId,
    });
  }

  async updateDefinition(id: string, data: Partial<{
    name: string;
    description: string;
    calcPriority: number;
    refundBehavior: string;
    isEnabled: boolean;
    requiresApproval: boolean;
    effectiveTo: string;
  }>) {
    await this.repo.updateDefinition(id, data as any);
    return this.repo.findDefinitionById(id);
  }

  // ── Admin: Rule Sets ───────────────────────────────────────────────────────

  async createRuleSet(data: {
    chargeDefinitionId: string;
    name: string;
    jurisdictionCountry?: string;
    jurisdictionRegion?: string;
    providerId?: string;
    listingCategory?: string;
    minBookingAmount?: number;
    maxBookingAmount?: number;
    priority?: number;
  }) {
    return this.repo.createRuleSet({
      id: newId(),
      chargeDefinitionId: data.chargeDefinitionId,
      name: data.name,
      jurisdictionCountry: data.jurisdictionCountry ?? null,
      jurisdictionRegion: data.jurisdictionRegion ?? null,
      providerId: data.providerId ?? null,
      listingCategory: data.listingCategory ?? null,
      minBookingAmount: data.minBookingAmount ?? null,
      maxBookingAmount: data.maxBookingAmount ?? null,
      isActive: true,
      priority: data.priority ?? 0,
    });
  }

  async listRuleSets(chargeDefinitionId?: string) {
    return this.repo.listRuleSets(chargeDefinitionId);
  }

  // ── Admin: Rules ───────────────────────────────────────────────────────────

  async createRule(data: {
    ruleSetId: string;
    calcMethod: string;
    rateBps?: number;
    fixedAmount?: number;
    currencyCode?: string;
    minAmount?: number;
    maxAmount?: number;
    formula?: string;
    tieredConfig?: unknown;
    conditions?: unknown[];
    isInclusive?: boolean;
    effectiveFrom: string;
    effectiveTo?: string;
  }) {
    return this.repo.createRule({
      id: newId(),
      ruleSetId: data.ruleSetId,
      calcMethod: data.calcMethod as any,
      rateBps: data.rateBps ?? null,
      fixedAmount: data.fixedAmount ?? null,
      currencyCode: data.currencyCode ?? null,
      minAmount: data.minAmount ?? null,
      maxAmount: data.maxAmount ?? null,
      formula: data.formula ?? null,
      tieredConfig: data.tieredConfig ? JSON.stringify(data.tieredConfig) : null,
      conditions: data.conditions ? JSON.stringify(data.conditions) : null,
      isInclusive: data.isInclusive ?? false,
      isActive: true,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo ?? null,
      version: 1,
    });
  }

  async listRules(ruleSetId?: string) {
    return this.repo.listRules(ruleSetId);
  }

  async updateRule(id: string, data: {
    rateBps?: number;
    fixedAmount?: number;
    isActive?: boolean;
    effectiveTo?: string;
    changeReason?: string;
  }, actor: SessionContext) {
    await this.repo.updateRule(id, data as any, actor.userId, data.changeReason);
    return { id, updated: true };
  }

  // ── Dependencies ───────────────────────────────────────────────────────────

  async addDependency(data: {
    dependentChargeId: string;
    dependsOnChargeId: string;
    dependencyType: string;
  }) {
    await this.repo.createDependency({
      id: newId(),
      dependentChargeId: data.dependentChargeId,
      dependsOnChargeId: data.dependsOnChargeId,
      dependencyType: data.dependencyType as any,
    });
    return { created: true };
  }

  async listDependencies(chargeDefinitionId?: string) {
    return this.repo.listDependencies(chargeDefinitionId);
  }

  // ── Simulation ─────────────────────────────────────────────────────────────

  async simulate(ctx: ChargeCalculationContext, definitionIds?: string[]) {
    return this.core.simulate(ctx, definitionIds);
  }

  // ── Booking Charges (called from booking service) ──────────────────────────

  async applyBookingCharges(bookingId: string, ctx: ChargeCalculationContext, bookingItemId?: string) {
    return this.core.applyBookingCharges(bookingId, ctx, bookingItemId);
  }

  async applyRefundCharges(refundId: string, bookingId: string, opts: {
    refundRatio: number;
    isBeforePayout: boolean;
    isBeforeServiceDate: boolean;
  }) {
    return this.core.applyRefundCharges(refundId, bookingId, opts);
  }

  async applyPayoutCharges(payoutId: string, ctx: ChargeCalculationContext, bookingId?: string) {
    return this.core.applyPayoutCharges(payoutId, ctx, bookingId);
  }

  async getBookingChargeBreakdown(bookingId: string) {
    return this.core.getBookingChargeBreakdown(bookingId);
  }

  async getPayoutChargeLines(payoutId: string) {
    return this.repo.findPayoutChargeLines(payoutId);
  }

  async getRefundChargeLines(refundId: string) {
    return this.repo.findRefundChargeLines(refundId);
  }

  // ── Jurisdiction Profiles ──────────────────────────────────────────────────

  async getJurisdictionProfile(country: string, region?: string) {
    return this.repo.findJurisdictionProfile(country, region);
  }

  async getTaxCodes(country: string) {
    return this.repo.findTaxCodesByCountry(country);
  }

  // ── Charge Assignments ────────────────────────────────────────────────────

  async listAssignments(targetType: ChargeAssignmentTargetType, targetId?: string) {
    return this.repo.findAssignmentsByTarget(targetType, targetId ?? undefined);
  }

  async createAssignment(data: {
    chargeDefinitionId: string;
    targetType: ChargeAssignmentTargetType;
    targetId?: string | undefined;
    overrideCalcMethod?: string | undefined;
    overrideRateBps?: number | undefined;
    overrideFixedAmount?: number | undefined;
    isWaived?: boolean | undefined;
    priority?: number | undefined;
    effectiveFrom?: string | undefined;
    effectiveTo?: string | undefined;
    reason?: string | undefined;
  }, actorId: string) {
    return this.repo.insertAssignment({
      id: newId(),
      chargeDefinitionId: data.chargeDefinitionId,
      targetType: data.targetType,
      targetId: data.targetId ?? null,
      overrideCalcMethod: (data.overrideCalcMethod ?? null) as any,
      overrideRateBps: data.overrideRateBps ?? null,
      overrideFixedAmount: data.overrideFixedAmount ?? null,
      isWaived: data.isWaived ?? false,
      priority: data.priority ?? 0,
      isActive: true,
      effectiveFrom: data.effectiveFrom ?? new Date().toISOString(),
      effectiveTo: data.effectiveTo ?? null,
      reason: data.reason ?? null,
      createdBy: actorId,
    });
  }

  async updateAssignment(id: string, data: {
    overrideCalcMethod?: string | null | undefined;
    overrideRateBps?: number | null | undefined;
    overrideFixedAmount?: number | null | undefined;
    isWaived?: boolean | undefined;
    priority?: number | undefined;
    isActive?: boolean | undefined;
    effectiveFrom?: string | undefined;
    effectiveTo?: string | null | undefined;
    reason?: string | null | undefined;
  }) {
    return this.repo.updateAssignment(id, data as any);
  }

  async deleteAssignment(id: string) {
    return this.repo.deleteAssignment(id);
  }
}
