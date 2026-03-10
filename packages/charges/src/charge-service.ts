import type { DbClient } from '@felix-travel/db';
import type {
  ChargeCalculationContext,
  ChargeBreakdown,
  ChargeSimulationResponse,
  RefundBehavior,
} from './types.js';
import { calculateCharges, allocateRefundCharges } from './engine.js';
import { deriveAllocationRecords } from './ledger-mapper.js';
import type { ChargesRepository } from './repository.js';

export class ChargeService {
  constructor(
    private readonly repo: ChargesRepository,
    _db: DbClient,
  ) { }

  /**
   * Calculate charges for a context WITHOUT persisting anything.
   * Used for quote previews, simulations, and admin dry-runs.
   */
  async simulate(ctx: ChargeCalculationContext, definitionIds?: string[]): Promise<ChargeSimulationResponse> {
    let definitions = await this.repo.findEnabledDefinitions(ctx.scope, ctx.timing);
    if (definitionIds && definitionIds.length > 0) {
      definitions = definitions.filter((d) => definitionIds.includes(d.id));
    }

    const defIds = definitions.map((d) => d.id);
    const [ruleSets, dependencies, assignments] = await Promise.all([
      this.repo.findRuleSetsForDefinitions(defIds),
      this.repo.findDependencies(defIds),
      this.repo.findAssignmentsForDefinitions(defIds),
    ]);
    const ruleSetIds = ruleSets.map((rs) => rs.id);
    const rules = await this.repo.findRulesForSets(ruleSetIds);

    const { breakdown, appliedRules } = calculateCharges({
      context: ctx,
      definitions,
      ruleSets,
      rules,
      dependencies,
      assignments,
    });

    return { breakdown, appliedRules };
  }

  /**
   * Calculate, persist, and allocate charges for a booking.
   * Returns the persisted booking charge line IDs and the breakdown.
   *
   * This is called at booking_confirm time for booking_level charges,
   * and at payment_capture time for payment_level charges.
   */
  async applyBookingCharges(
    bookingId: string,
    ctx: ChargeCalculationContext,
    bookingItemId?: string,
  ): Promise<{ breakdown: ChargeBreakdown; chargeLineIds: string[] }> {
    const { breakdown } = await this.simulate(ctx);

    const chargeLineIds: string[] = [];
    for (const line of breakdown.lines) {
      const id = crypto.randomUUID();
      await this.repo.insertBookingChargeLine({
        id,
        bookingId,
        bookingItemId: bookingItemId ?? null,
        chargeDefinitionId: line.chargeDefinitionId,
        chargeRuleId: line.ruleId ?? null,
        jurisdictionCountry: ctx.jurisdictionCountry,
        scope: line.scope,
        payer: line.payer,
        beneficiary: line.beneficiary,
        baseAmount: line.baseAmount,
        rateBps: line.rateBps ?? null,
        fixedAmount: line.fixedAmount ?? null,
        chargeAmount: line.chargeAmount,
        currencyCode: line.currencyCode,
        isInclusive: line.isInclusive,
        isVoid: false,
        timing: ctx.timing,
        appliesCustomerSide: line.appliesCustomerSide,
        appliesProviderSide: line.appliesProviderSide,
      });
      chargeLineIds.push(id);

      // Create allocation record (status = 'pending' until ledger entry is written)
      const allocs = deriveAllocationRecords([line], 'booking_charge_line', id);
      for (const alloc of allocs) {
        await this.repo.insertChargeAllocationLine({
          id: crypto.randomUUID(),
          chargeContextType: 'booking_charge_line',
          chargeContextId: id,
          chargeDefinitionId: alloc.chargeDefinitionId,
          amount: alloc.chargeAmount,
          currencyCode: alloc.currencyCode,
          debitAccountCode: alloc.debitAccountCode,
          creditAccountCode: alloc.creditAccountCode,
          ledgerEntryId: null,
          status: 'pending',
        });
      }
    }

    return { breakdown, chargeLineIds };
  }

  /**
   * Calculate and persist refund charge reversals.
   * Returns per-line refund allocations.
   */
  async applyRefundCharges(
    refundId: string,
    bookingId: string,
    opts: {
      refundRatio: number;    // fraction of booking being refunded
      isBeforePayout: boolean;
      isBeforeServiceDate: boolean;
    },
  ) {
    const existingLines = await this.repo.findBookingChargeLines(bookingId);

    const allocations = allocateRefundCharges(
      existingLines.map((l) => ({
        id: l.id,
        chargeCode: l.chargeCode ?? '',
        chargeAmount: l.chargeAmount,
        refundBehavior: l.refundBehavior as RefundBehavior,
        currencyCode: l.currencyCode,
      })),
      opts,
    );

    for (const alloc of allocations) {
      const id = crypto.randomUUID();
      await this.repo.insertRefundChargeLine({
        id,
        refundId,
        bookingChargeLineId: alloc.bookingChargeLineId,
        originalChargeAmount: alloc.originalChargeAmount,
        refundedChargeAmount: alloc.refundedChargeAmount,
        refundBehavior: alloc.refundBehavior,
        currencyCode: existingLines.find((l) => l.id === alloc.bookingChargeLineId)?.currencyCode ?? 'KES',
        notes: alloc.requiresManualReview ? 'Requires manual review' : null,
      });
    }

    return allocations;
  }

  /**
   * Calculate and persist payout-level charge deductions.
   */
  async applyPayoutCharges(
    payoutId: string,
    ctx: ChargeCalculationContext,
    bookingId?: string,
  ): Promise<{ breakdown: ChargeBreakdown; chargeLineIds: string[] }> {
    const { breakdown } = await this.simulate(ctx);

    const chargeLineIds: string[] = [];
    for (const line of breakdown.lines) {
      const id = crypto.randomUUID();
      const gross = ctx.payoutAmount ?? 0;
      await this.repo.insertPayoutChargeLine({
        id,
        payoutId,
        bookingId: bookingId ?? null,
        chargeDefinitionId: line.chargeDefinitionId,
        scope: line.scope,
        description: `${line.chargeName} — payout deduction`,
        grossAmount: gross,
        chargeAmount: line.chargeAmount,
        netAmount: gross - line.chargeAmount,
        currencyCode: line.currencyCode,
      });
      chargeLineIds.push(id);
    }

    return { breakdown, chargeLineIds };
  }

  /** Get the full charge breakdown for an existing booking (from persisted lines). */
  async getBookingChargeBreakdown(bookingId: string) {
    return this.repo.findBookingChargeLines(bookingId);
  }
}
