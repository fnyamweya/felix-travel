import type { SettlementDeduction, SettlementResult, LedgerPosting } from './types.js';

export interface SettlementInput {
  bookingId: string;
  providerId: string;
  grossAmount: number;
  currencyCode: string;
  /** Charge lines previously calculated by the charges engine */
  chargeLines: Array<{
    chargeDefinitionId: string;
    code: string;
    name: string;
    chargeAmount: number;
    payer: 'customer' | 'provider' | 'platform';
    beneficiary: 'platform' | 'government' | 'provider' | 'customer';
    ledgerDebitAccountCode?: string | null;
    ledgerCreditAccountCode?: string | null;
  }>;
  /** Default platform commission rate in BPS (fallback if no charge lines present) */
  defaultCommissionBps?: number;
}

export function calculateSettlement(input: SettlementInput): SettlementResult {
  const { bookingId, providerId, grossAmount, currencyCode, chargeLines, defaultCommissionBps } =
    input;

  const deductions: SettlementDeduction[] = [];

  // Step 1 & 2: Filter charge lines where payer === 'provider' and build deductions
  const providerChargeLines = chargeLines.filter((line) => line.payer === 'provider');

  for (const line of providerChargeLines) {
    deductions.push({
      code: line.code,
      description: line.name,
      amount: line.chargeAmount,
      currencyCode,
      beneficiary: line.beneficiary,
      chargeDefinitionId: line.chargeDefinitionId,
    });
  }

  // Step 3: Fallback to defaultCommissionBps if no charge lines present
  if (chargeLines.length === 0 && defaultCommissionBps !== undefined) {
    const platformCommission = Math.round((grossAmount * defaultCommissionBps) / 10000);
    deductions.push({
      code: 'PLATFORM_COMMISSION',
      description: 'Platform commission',
      amount: platformCommission,
      currencyCode,
      beneficiary: 'platform',
    });
  }

  // Step 4: totalDeductions
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

  // Step 5: netPayable
  const netPayable = Math.max(0, grossAmount - totalDeductions);

  // Step 6: Build ledger postings from charge lines with account codes
  const ledgerPostings: LedgerPosting[] = [];

  for (const line of providerChargeLines) {
    if (line.ledgerDebitAccountCode != null && line.ledgerCreditAccountCode != null) {
      ledgerPostings.push({
        debitAccountCode: line.ledgerDebitAccountCode,
        creditAccountCode: line.ledgerCreditAccountCode,
        amount: line.chargeAmount,
        currencyCode,
        description: line.name,
      });
    }
  }

  // Step 7: Core posting — DR 1100 (Cash Clearing) / CR 2000 (Provider Payable) for netPayable
  if (netPayable > 0) {
    ledgerPostings.push({
      debitAccountCode: '1100',
      creditAccountCode: '2000',
      amount: netPayable,
      currencyCode,
      description: 'Net payable to provider',
    });
  }

  // Step 7 (continued): CR 4000 (Platform Revenue) for platform commission if present
  const platformCommissionDeduction = deductions.find((d) => d.beneficiary === 'platform');
  if (platformCommissionDeduction !== undefined && platformCommissionDeduction.amount > 0) {
    ledgerPostings.push({
      debitAccountCode: '1100',
      creditAccountCode: '4000',
      amount: platformCommissionDeduction.amount,
      currencyCode,
      description: 'Platform revenue (commission)',
    });
  }

  return {
    bookingId,
    providerId,
    currencyCode,
    grossAmount,
    deductions,
    totalDeductions,
    netPayable,
    ledgerPostings,
  };
}
