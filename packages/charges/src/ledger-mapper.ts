import type { ChargeLineResult, ChargeCategory } from './types.js';

/** Default ledger account codes for each charge category (fallbacks when definition has none). */
const CATEGORY_DEFAULT_ACCOUNTS: Record<ChargeCategory, { debit: string; credit: string }> = {
  commission: { debit: '1100', credit: '4000' }, // DR Cash Clearing  CR Platform Revenue
  tax: { debit: '1100', credit: '2200' }, // DR Cash Clearing  CR Tax Liability
  duty: { debit: '1100', credit: '2300' }, // DR Cash Clearing  CR Duty Liability
  fee: { debit: '1100', credit: '4100' }, // DR Cash Clearing  CR Fee Revenue
  levy: { debit: '1100', credit: '2400' }, // DR Cash Clearing  CR Levy Liability
  surcharge: { debit: '1100', credit: '4100' }, // DR Cash Clearing  CR Misc Revenue
  discount: { debit: '4000', credit: '1100' }, // DR Revenue (contra)  CR Cash Clearing
  withholding: { debit: '2000', credit: '2500' }, // DR Provider Payable  CR Withholding Liability
  fx: { debit: '1100', credit: '4200' }, // DR Cash Clearing  CR FX Revenue
  adjustment: { debit: '9900', credit: '9901' }, // Manual adjustment accounts
};

export interface ChargeAllocationRecord {
  chargeDefinitionId: string;
  chargeCode: string;
  chargeAmount: number;
  currencyCode: string;
  debitAccountCode: string;
  creditAccountCode: string;
  /** 'booking_charge_line' | 'payout_charge_line' | 'refund_charge_line' */
  contextType: string;
  /** ID of the BookingChargeLine / PayoutChargeLine / RefundChargeLine row */
  contextId: string;
}

/**
 * Derives ledger allocation records from a list of computed charge lines.
 * Uses the definition's explicit account codes if set; falls back to
 * category defaults otherwise.
 *
 * @param lines       - Computed charge line results from the engine
 * @param contextType - Type of source record ('booking_charge_line' etc.)
 * @param contextId   - ID of the source record (charge line row id)
 */
export function deriveAllocationRecords(
  lines: ChargeLineResult[],
  contextType: 'booking_charge_line' | 'payout_charge_line' | 'refund_charge_line',
  contextId: string,
): ChargeAllocationRecord[] {
  return lines.map((line) => {
    const defaults = CATEGORY_DEFAULT_ACCOUNTS[line.category];
    const debitAccountCode = line.ledgerDebitAccountCode ?? defaults.debit;
    const creditAccountCode = line.ledgerCreditAccountCode ?? defaults.credit;

    return {
      chargeDefinitionId: line.chargeDefinitionId,
      chargeCode: line.chargeCode,
      chargeAmount: line.chargeAmount,
      currencyCode: line.currencyCode,
      debitAccountCode,
      creditAccountCode,
      contextType,
      contextId,
    };
  });
}

/**
 * Returns the category-default account pair for a charge category.
 * Useful for one-off lookups without a full ChargeLineResult.
 */
export function getDefaultAccounts(category: ChargeCategory): { debit: string; credit: string } {
  return CATEGORY_DEFAULT_ACCOUNTS[category];
}
