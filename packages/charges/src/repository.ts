import { eq, and, inArray } from 'drizzle-orm';
import type { DbClient } from '@felix-travel/db';
import {
  chargeDefinitions,
  chargeRuleSets,
  chargeRules,
  chargeDependencies,
  chargeRateVersions,
  taxCodes,
  jurisdictionProfiles,
  bookingChargeLines,
  refundChargeLines,
  payoutChargeLines,
  chargeAllocationLines,
} from '@felix-travel/db';
import type {
  ChargeDefinitionRow,
  ChargeRuleSetRow,
  ChargeRuleRow,
  ChargeDependencyRow,
  ChargeScope,
  ChargeTiming,
} from './types.js';

export class ChargesRepository {
  constructor(private readonly db: DbClient) { }

  // ── Definitions ─────────────────────────────────────────────────────────────

  async findEnabledDefinitions(scope?: ChargeScope, _timing?: ChargeTiming): Promise<ChargeDefinitionRow[]> {
    const conditions = [eq(chargeDefinitions.isEnabled, true)];
    if (scope) conditions.push(eq(chargeDefinitions.scope, scope));
    return this.db
      .select()
      .from(chargeDefinitions)
      .where(and(...conditions)) as Promise<ChargeDefinitionRow[]>;
  }

  async findDefinitionByCode(code: string): Promise<ChargeDefinitionRow | undefined> {
    const rows = await this.db
      .select()
      .from(chargeDefinitions)
      .where(eq(chargeDefinitions.code, code))
      .limit(1);
    return rows[0] as ChargeDefinitionRow | undefined;
  }

  async findDefinitionById(id: string): Promise<ChargeDefinitionRow | undefined> {
    const rows = await this.db.select().from(chargeDefinitions).where(eq(chargeDefinitions.id, id)).limit(1);
    return rows[0] as ChargeDefinitionRow | undefined;
  }

  async createDefinition(data: typeof chargeDefinitions.$inferInsert): Promise<ChargeDefinitionRow> {
    const [row] = await this.db.insert(chargeDefinitions).values(data).returning();
    if (!row) throw new Error('chargeDefinitions insert returned no rows');
    return row as ChargeDefinitionRow;
  }

  async updateDefinition(id: string, data: Partial<typeof chargeDefinitions.$inferInsert>): Promise<void> {
    await this.db
      .update(chargeDefinitions)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(chargeDefinitions.id, id));
  }

  async listDefinitions(): Promise<ChargeDefinitionRow[]> {
    return this.db.select().from(chargeDefinitions) as Promise<ChargeDefinitionRow[]>;
  }

  // ── Rule Sets ────────────────────────────────────────────────────────────────

  async findRuleSetsForDefinitions(definitionIds: string[]): Promise<ChargeRuleSetRow[]> {
    if (definitionIds.length === 0) return [];
    return this.db
      .select()
      .from(chargeRuleSets)
      .where(and(inArray(chargeRuleSets.chargeDefinitionId, definitionIds), eq(chargeRuleSets.isActive, true))) as Promise<ChargeRuleSetRow[]>;
  }

  async createRuleSet(data: typeof chargeRuleSets.$inferInsert): Promise<ChargeRuleSetRow> {
    const [row] = await this.db.insert(chargeRuleSets).values(data).returning();
    if (!row) throw new Error('chargeRuleSets insert returned no rows');
    return row as ChargeRuleSetRow;
  }

  async listRuleSets(definitionId?: string): Promise<ChargeRuleSetRow[]> {
    if (definitionId) {
      return this.db
        .select()
        .from(chargeRuleSets)
        .where(eq(chargeRuleSets.chargeDefinitionId, definitionId)) as Promise<ChargeRuleSetRow[]>;
    }

    return this.db.select().from(chargeRuleSets) as Promise<ChargeRuleSetRow[]>;
  }

  // ── Rules ────────────────────────────────────────────────────────────────────

  async findRulesForSets(ruleSetIds: string[]): Promise<ChargeRuleRow[]> {
    if (ruleSetIds.length === 0) return [];
    return this.db
      .select()
      .from(chargeRules)
      .where(and(inArray(chargeRules.ruleSetId, ruleSetIds), eq(chargeRules.isActive, true))) as Promise<ChargeRuleRow[]>;
  }

  async createRule(data: typeof chargeRules.$inferInsert): Promise<ChargeRuleRow> {
    const [row] = await this.db.insert(chargeRules).values(data).returning();
    if (!row) throw new Error('chargeRules insert returned no rows');
    return row as ChargeRuleRow;
  }

  async listRules(ruleSetId?: string): Promise<ChargeRuleRow[]> {
    if (ruleSetId) {
      return this.db
        .select()
        .from(chargeRules)
        .where(eq(chargeRules.ruleSetId, ruleSetId)) as Promise<ChargeRuleRow[]>;
    }

    return this.db.select().from(chargeRules) as Promise<ChargeRuleRow[]>;
  }

  async updateRule(id: string, data: Partial<typeof chargeRules.$inferInsert>, changedBy: string, reason?: string): Promise<void> {
    // Fetch existing for version history
    const existing = await this.db.select().from(chargeRules).where(eq(chargeRules.id, id)).limit(1);
    const current = existing[0];
    if (!current) throw new Error(`ChargeRule ${id} not found`);

    // Write rate version record if rate changed
    if (data.rateBps !== undefined || data.fixedAmount !== undefined) {
      await this.db.insert(chargeRateVersions).values({
        id: crypto.randomUUID(),
        chargeRuleId: id,
        previousRateBps: current.rateBps ?? null,
        newRateBps: data.rateBps ?? current.rateBps ?? null,
        previousFixedAmount: current.fixedAmount ?? null,
        newFixedAmount: data.fixedAmount ?? current.fixedAmount ?? null,
        changedBy,
        changeReason: reason ?? null,
        approvalRecordId: null,
        effectiveFrom: new Date().toISOString().slice(0, 10),
      });
    }

    await this.db
      .update(chargeRules)
      .set({ ...data, version: (current.version ?? 1) + 1 })
      .where(eq(chargeRules.id, id));
  }

  // ── Dependencies ─────────────────────────────────────────────────────────────

  async findDependencies(definitionIds: string[]): Promise<ChargeDependencyRow[]> {
    if (definitionIds.length === 0) return [];
    return this.db
      .select()
      .from(chargeDependencies)
      .where(inArray(chargeDependencies.dependentChargeId, definitionIds)) as Promise<ChargeDependencyRow[]>;
  }

  async createDependency(data: typeof chargeDependencies.$inferInsert): Promise<void> {
    await this.db.insert(chargeDependencies).values(data);
  }

  async listDependencies(definitionId?: string): Promise<ChargeDependencyRow[]> {
    if (definitionId) {
      return this.db
        .select()
        .from(chargeDependencies)
        .where(eq(chargeDependencies.dependentChargeId, definitionId)) as Promise<ChargeDependencyRow[]>;
    }

    return this.db.select().from(chargeDependencies) as Promise<ChargeDependencyRow[]>;
  }

  // ── Tax Codes ────────────────────────────────────────────────────────────────

  async findTaxCodesByCountry(countryCode: string) {
    return this.db.select().from(taxCodes).where(
      and(eq(taxCodes.jurisdictionCountry, countryCode), eq(taxCodes.isActive, true))
    );
  }

  // ── Jurisdiction Profiles ─────────────────────────────────────────────────────

  async findJurisdictionProfile(countryCode: string, region?: string) {
    const conditions = [
      eq(jurisdictionProfiles.countryCode, countryCode),
      eq(jurisdictionProfiles.isActive, true),
    ];
    if (region) conditions.push(eq(jurisdictionProfiles.region, region));
    const rows = await this.db.select().from(jurisdictionProfiles).where(and(...conditions)).limit(1);
    return rows[0] ?? null;
  }

  // ── Booking Charge Lines ──────────────────────────────────────────────────────

  async insertBookingChargeLine(data: typeof bookingChargeLines.$inferInsert) {
    const [row] = await this.db.insert(bookingChargeLines).values(data).returning();
    if (!row) throw new Error('bookingChargeLines insert returned no rows');
    return row;
  }

  async findBookingChargeLines(bookingId: string) {
    return this.db
      .select({
        id: bookingChargeLines.id,
        chargeAmount: bookingChargeLines.chargeAmount,
        currencyCode: bookingChargeLines.currencyCode,
        refundBehavior: chargeDefinitions.refundBehavior,
        chargeCode: chargeDefinitions.code,
      })
      .from(bookingChargeLines)
      .innerJoin(chargeDefinitions, eq(bookingChargeLines.chargeDefinitionId, chargeDefinitions.id))
      .where(and(eq(bookingChargeLines.bookingId, bookingId), eq(bookingChargeLines.isVoid, false)));
  }

  async voidBookingChargeLine(id: string): Promise<void> {
    await this.db.update(bookingChargeLines).set({ isVoid: true }).where(eq(bookingChargeLines.id, id));
  }

  // ── Refund Charge Lines ───────────────────────────────────────────────────────

  async insertRefundChargeLine(data: typeof refundChargeLines.$inferInsert) {
    const [row] = await this.db.insert(refundChargeLines).values(data).returning();
    if (!row) throw new Error('refundChargeLines insert returned no rows');
    return row;
  }

  async findRefundChargeLines(refundId: string) {
    return this.db.select().from(refundChargeLines).where(eq(refundChargeLines.refundId, refundId));
  }

  // ── Payout Charge Lines ───────────────────────────────────────────────────────

  async insertPayoutChargeLine(data: typeof payoutChargeLines.$inferInsert) {
    const [row] = await this.db.insert(payoutChargeLines).values(data).returning();
    if (!row) throw new Error('payoutChargeLines insert returned no rows');
    return row;
  }

  async findPayoutChargeLines(payoutId: string) {
    return this.db.select().from(payoutChargeLines).where(eq(payoutChargeLines.payoutId, payoutId));
  }

  // ── Charge Allocation Lines ───────────────────────────────────────────────────

  async insertChargeAllocationLine(data: typeof chargeAllocationLines.$inferInsert) {
    const [row] = await this.db.insert(chargeAllocationLines).values(data).returning();
    if (!row) throw new Error('chargeAllocationLines insert returned no rows');
    return row;
  }

  async markAllocationPosted(id: string, ledgerEntryId: string): Promise<void> {
    await this.db
      .update(chargeAllocationLines)
      .set({ status: 'posted', ledgerEntryId })
      .where(eq(chargeAllocationLines.id, id));
  }

  async findPendingAllocations(limit = 100) {
    return this.db
      .select()
      .from(chargeAllocationLines)
      .where(eq(chargeAllocationLines.status, 'pending'))
      .limit(limit);
  }
}
