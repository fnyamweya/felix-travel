import type { DateTimeString, MinorCurrencyAmount } from './common.js';

export type LedgerAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: LedgerAccountType;
  /** null = platform-level account; non-null = provider subledger */
  providerId: string | null;
  isActive: boolean;
  createdAt: DateTimeString;
}

export type LedgerEntryType =
  | 'booking_payment'
  | 'commission_recognition'
  | 'provider_payable_recognition'
  | 'payout_issuance'
  | 'payout_failure_unwind'
  | 'refund_issuance'
  | 'refund_provider_deduction'
  | 'reversal'
  | 'manual_adjustment'
  | 'fx_gain_loss';

export interface LedgerEntry {
  id: string;
  type: LedgerEntryType;
  referenceType: 'booking' | 'payment' | 'refund' | 'payout' | 'manual';
  referenceId: string;
  description: string;
  effectiveDate: string;
  createdAt: DateTimeString;
  createdBy: string;
  lines: LedgerEntryLine[];
}

export interface LedgerEntryLine {
  id: string;
  entryId: string;
  accountId: string;
  /** Exactly one of debit/credit is non-zero per line */
  debitAmount: MinorCurrencyAmount;
  creditAmount: MinorCurrencyAmount;
  currencyCode: string;
  memo: string | null;
}
