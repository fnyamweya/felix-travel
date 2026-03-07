export interface SettlementDeduction {
  code: string;
  description: string;
  amount: number;
  currencyCode: string;
  beneficiary: 'platform' | 'government' | 'provider' | 'customer';
  chargeDefinitionId?: string;
}

export interface LedgerPosting {
  debitAccountCode: string;
  creditAccountCode: string;
  amount: number;
  currencyCode: string;
  description: string;
}

export interface SettlementResult {
  bookingId: string;
  providerId: string;
  currencyCode: string;
  /** Gross booking value before any deductions */
  grossAmount: number;
  /** Deductions from the gross (platform commission, taxes, duties, etc.) */
  deductions: SettlementDeduction[];
  /** Sum of all deductions */
  totalDeductions: number;
  /** Amount the provider actually receives: grossAmount - totalDeductions */
  netPayable: number;
  /** Suggested ledger postings (informational — actual posting done by LedgerService) */
  ledgerPostings: LedgerPosting[];
}

export interface ReleaseEligibility {
  eligible: boolean;
  reason?: string;
  /** ISO date when the booking becomes eligible (settlement delay) */
  eligibleFrom?: string;
}
