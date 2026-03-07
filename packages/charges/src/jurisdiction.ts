import type { ChargeRuleSetRow, ChargeCalculationContext } from './types.js';

/**
 * Selects the best-matching rule set for a charge definition given the
 * calculation context.
 *
 * Matching specificity (higher = more specific = wins):
 *   +8  exact country match
 *   +4  exact region match
 *   +2  exact provider match
 *   +1  exact listing category match
 *
 * Within equal specificity, the higher `priority` field wins.
 * If no rule set matches the context constraints (amount bounds, country, etc.),
 * returns null.
 */
export function selectBestRuleSet(
  ruleSets: ChargeRuleSetRow[],
  context: ChargeCalculationContext,
): ChargeRuleSetRow | null {
  const refAmount = getRefAmount(context);

  const candidates = ruleSets.filter((rs) => {
    if (!rs.isActive) return false;

    // Country filter
    if (rs.jurisdictionCountry !== null && rs.jurisdictionCountry !== context.jurisdictionCountry) {
      return false;
    }
    // Region filter (only checked if country also matches or is a wildcard)
    if (rs.jurisdictionRegion !== null && rs.jurisdictionRegion !== (context.jurisdictionRegion ?? null)) {
      return false;
    }
    // Provider filter
    if (rs.providerId !== null && rs.providerId !== (context.providerId ?? null)) {
      return false;
    }
    // Listing category filter
    if (rs.listingCategory !== null && rs.listingCategory !== (context.listingCategory ?? null)) {
      return false;
    }
    // Amount range filters
    if (rs.minBookingAmount !== null && refAmount !== null && refAmount < rs.minBookingAmount) {
      return false;
    }
    if (rs.maxBookingAmount !== null && refAmount !== null && refAmount > rs.maxBookingAmount) {
      return false;
    }

    return true;
  });

  if (candidates.length === 0) return null;

  // Score each candidate by specificity
  const scored = candidates.map((rs) => {
    let score = 0;
    if (rs.jurisdictionCountry !== null) score += 8;
    if (rs.jurisdictionRegion !== null) score += 4;
    if (rs.providerId !== null) score += 2;
    if (rs.listingCategory !== null) score += 1;
    return { rs, score };
  });

  // Sort: highest specificity first, then highest priority
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.rs.priority - a.rs.priority;
  });

  return scored[0]!.rs;
}

/**
 * Returns the "reference amount" from context — used for min/max booking
 * amount filtering on rule sets.
 */
function getRefAmount(context: ChargeCalculationContext): number | null {
  return (
    context.bookingSubtotal ??
    context.paymentAmount ??
    context.payoutAmount ??
    null
  );
}

/**
 * Evaluates whether a charge definition is applicable given the context.
 * Returns true if all of the following hold:
 *  - The charge is active (isEnabled)
 *  - effectiveFrom <= today <= effectiveTo (if set)
 *  - The charge's scope matches the context scope
 *  - The charge's timing matches the context timing
 */
export function isDefinitionApplicable(
  def: { isEnabled: boolean; effectiveFrom: string; effectiveTo: string | null; scope: string; calcMethod: string },
  _context: ChargeCalculationContext,
  today: string,
): boolean {
  if (!def.isEnabled) return false;
  if (def.effectiveFrom > today) return false;
  if (def.effectiveTo !== null && def.effectiveTo < today) return false;
  return true;
}
