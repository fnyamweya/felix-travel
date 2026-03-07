export interface StatementPeriod {
  from: string; // ISO date YYYY-MM-DD
  to: string;   // ISO date YYYY-MM-DD
}

export interface StatementLineItem {
  date: string;
  type: 'booking_payment' | 'payout_issuance' | 'refund_issuance' | 'payout_failure_unwind' | 'manual';
  referenceId: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  currencyCode: string;
}

export interface ProviderStatement {
  providerId: string;
  providerName: string;
  period: StatementPeriod;
  currencyCode: string;
  openingBalance: number;
  closingBalance: number;
  totalEarned: number;
  totalPayouts: number;
  totalRefunds: number;
  lineItems: StatementLineItem[];
  generatedAt: string;
}

export interface PlatformStatement {
  period: StatementPeriod;
  currencyCode: string;
  totalGrossBookings: number;
  totalCommissionEarned: number;
  totalFeeRevenue: number;
  totalRefundExpense: number;
  totalPayoutsDispatched: number;
  netRevenue: number;
  lineItems: StatementLineItem[];
  generatedAt: string;
}
