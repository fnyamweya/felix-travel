import type { DbClient } from '@felix-travel/db';
import {
  ledgerAccounts,
  ledgerEntries,
  ledgerEntryLines,
  bookings,
  payments,
  payouts,
  refunds,
  serviceProviders,
} from '@felix-travel/db';
import { eq, and, gte, lte, inArray, desc } from 'drizzle-orm';

import type {
  StatementPeriod,
  StatementLineItem,
  ProviderStatement,
  PlatformStatement,
} from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapLedgerEntryType(type: string): StatementLineItem['type'] {
  switch (type) {
    case 'booking_payment': return 'booking_payment';
    case 'payout_issuance': return 'payout_issuance';
    case 'refund_issuance': return 'refund_issuance';
    case 'payout_failure_unwind': return 'payout_failure_unwind';
    default: return 'manual';
  }
}

function buildEmptyProviderStatement(
  providerId: string,
  providerName: string,
  period: StatementPeriod,
  currencyCode: string,
): ProviderStatement {
  return {
    providerId,
    providerName,
    period,
    currencyCode,
    openingBalance: 0,
    closingBalance: 0,
    totalEarned: 0,
    totalPayouts: 0,
    totalRefunds: 0,
    lineItems: [],
    generatedAt: new Date().toISOString(),
  };
}

function buildEmptyPlatformStatement(
  period: StatementPeriod,
  currencyCode: string,
): PlatformStatement {
  return {
    period,
    currencyCode,
    totalGrossBookings: 0,
    totalCommissionEarned: 0,
    totalFeeRevenue: 0,
    totalRefundExpense: 0,
    totalPayoutsDispatched: 0,
    netRevenue: 0,
    lineItems: [],
    generatedAt: new Date().toISOString(),
  };
}

// ─── Provider Statement ───────────────────────────────────────────────────────

/**
 * Generate a statement for a single service provider over a given period.
 * All amounts are in minor currency units (integers).
 */
export async function generateProviderStatement(
  db: DbClient,
  providerId: string,
  period: StatementPeriod,
  currencyCode = 'KES',
): Promise<ProviderStatement> {
  // 1. Load provider name
  const providerRows = await db
    .select({ id: serviceProviders.id, name: serviceProviders.name })
    .from(serviceProviders)
    .where(eq(serviceProviders.id, providerId));

  const provider = providerRows[0];
  if (!provider) {
    throw new Error(`Provider '${providerId}' not found`);
  }

  // 2. Find all bookings for provider → get booking IDs
  const bookingRows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.providerId, providerId));

  if (bookingRows.length === 0) {
    return buildEmptyProviderStatement(providerId, provider.name, period, currencyCode);
  }

  const bookingIds = bookingRows.map((b) => b.id);

  // Get payment IDs for these bookings
  const paymentRows = await db
    .select({ id: payments.id })
    .from(payments)
    .where(inArray(payments.bookingId, bookingIds));

  const paymentIds = paymentRows.map((p) => p.id);

  // 3. Find all payout IDs for provider
  const payoutRows = await db
    .select({ id: payouts.id })
    .from(payouts)
    .where(eq(payouts.providerId, providerId));

  const payoutIds = payoutRows.map((p) => p.id);

  // 4. Find all refund IDs linked to the provider's bookings
  const refundRows = await db
    .select({ id: refunds.id })
    .from(refunds)
    .where(inArray(refunds.bookingId, bookingIds));

  const refundIds = refundRows.map((r) => r.id);

  // 5 & 6 & 7. Find lines joined to entries, filtered by referenceId and date range
  const allReferenceIds = [...bookingIds, ...paymentIds, ...payoutIds, ...refundIds];

  const joinedLines = await db
    .select({
      accountId: ledgerEntryLines.accountId,
      debitAmount: ledgerEntryLines.debitAmount,
      creditAmount: ledgerEntryLines.creditAmount,
      lineCurrency: ledgerEntryLines.currencyCode,
      effectiveDate: ledgerEntries.effectiveDate,
      entryType: ledgerEntries.type,
      referenceId: ledgerEntries.referenceId,
      description: ledgerEntries.description,
    })
    .from(ledgerEntryLines)
    .innerJoin(ledgerEntries, eq(ledgerEntryLines.entryId, ledgerEntries.id))
    .where(
      and(
        inArray(ledgerEntries.referenceId, allReferenceIds),
        gte(ledgerEntries.effectiveDate, period.from),
        lte(ledgerEntries.effectiveDate, period.to),
      ),
    );

  // 8. Resolve account '2000' (Provider Payable)
  const payableAccountRows = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.code, '2000'));

  const payableAccountId = payableAccountRows[0]?.id;

  // 9. Filter lines to only the provider payable account
  const payableLines = payableAccountId
    ? joinedLines.filter((l) => l.accountId === payableAccountId)
    : [];

  // 10. Sort ascending by effectiveDate, compute running balance
  payableLines.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  let runningBalance = 0;
  const lineItems: StatementLineItem[] = payableLines.map((l) => {
    runningBalance += l.creditAmount - l.debitAmount;
    return {
      date: l.effectiveDate,
      type: mapLedgerEntryType(l.entryType),
      referenceId: l.referenceId,
      description: l.description,
      debitAmount: l.debitAmount,
      creditAmount: l.creditAmount,
      runningBalance,
      currencyCode: l.lineCurrency,
    };
  });

  // 11. Calculate totals
  const totalEarned = payableLines
    .filter((l) => l.entryType === 'booking_payment')
    .reduce((sum, l) => sum + l.creditAmount, 0);

  const totalPayouts = payableLines
    .filter((l) => l.entryType === 'payout_issuance')
    .reduce((sum, l) => sum + l.debitAmount, 0);

  const totalRefunds = payableLines
    .filter((l) => l.entryType === 'refund_issuance')
    .reduce((sum, l) => sum + l.debitAmount, 0);

  return {
    providerId,
    providerName: provider.name,
    period,
    currencyCode,
    openingBalance: 0,
    closingBalance: runningBalance,
    totalEarned,
    totalPayouts,
    totalRefunds,
    lineItems,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Platform Statement ───────────────────────────────────────────────────────

/**
 * Generate an aggregate P&L statement for the platform over a given period.
 * All amounts are in minor currency units (integers).
 */
export async function generatePlatformStatement(
  db: DbClient,
  period: StatementPeriod,
  currencyCode = 'KES',
): Promise<PlatformStatement> {
  // 1. Resolve account IDs for the five platform accounts
  const accountRows = await db
    .select({ id: ledgerAccounts.id, code: ledgerAccounts.code })
    .from(ledgerAccounts)
    .where(inArray(ledgerAccounts.code, ['4000', '4100', '1100', '6000', '1200']));

  const accountMap = new Map(accountRows.map((a) => [a.code, a.id]));
  const commissionAccountId = accountMap.get('4000');
  const feeAccountId = accountMap.get('4100');
  const cashClearingAccountId = accountMap.get('1100');
  const refundExpenseAccountId = accountMap.get('6000');
  const cashOutgoingAccountId = accountMap.get('1200');

  // 2. Query all ledger entries within the period (desc for the DB fetch)
  const entryRows = await db
    .select({
      id: ledgerEntries.id,
      type: ledgerEntries.type,
      referenceId: ledgerEntries.referenceId,
      description: ledgerEntries.description,
      effectiveDate: ledgerEntries.effectiveDate,
    })
    .from(ledgerEntries)
    .where(
      and(
        gte(ledgerEntries.effectiveDate, period.from),
        lte(ledgerEntries.effectiveDate, period.to),
      ),
    )
    .orderBy(desc(ledgerEntries.effectiveDate));

  if (entryRows.length === 0) {
    return buildEmptyPlatformStatement(period, currencyCode);
  }

  const entryIds = entryRows.map((e) => e.id);

  // Fetch all lines for the period's entries
  const lineRows = await db
    .select({
      entryId: ledgerEntryLines.entryId,
      accountId: ledgerEntryLines.accountId,
      debitAmount: ledgerEntryLines.debitAmount,
      creditAmount: ledgerEntryLines.creditAmount,
      lineCurrency: ledgerEntryLines.currencyCode,
    })
    .from(ledgerEntryLines)
    .where(inArray(ledgerEntryLines.entryId, entryIds));

  // Helper: sum credits / debits for a specific account
  const sumCredits = (accountId: string | undefined): number =>
    accountId
      ? lineRows
        .filter((l) => l.accountId === accountId)
        .reduce((s, l) => s + l.creditAmount, 0)
      : 0;

  const sumDebits = (accountId: string | undefined): number =>
    accountId
      ? lineRows
        .filter((l) => l.accountId === accountId)
        .reduce((s, l) => s + l.debitAmount, 0)
      : 0;

  // 3-7. Compute totals per account
  const totalCommissionEarned = sumCredits(commissionAccountId);    // credits on 4000
  const totalFeeRevenue = sumCredits(feeAccountId);           // credits on 4100
  const totalRefundExpense = sumDebits(refundExpenseAccountId);  // debits  on 6000
  const totalPayoutsDispatched = sumCredits(cashOutgoingAccountId);  // credits on 1200
  const totalGrossBookings = sumDebits(cashClearingAccountId);   // debits  on 1100

  // 8. Net revenue
  const netRevenue = totalCommissionEarned + totalFeeRevenue - totalRefundExpense;

  // 9. Build line items from all relevant account entries, sorted ascending by date
  const relevantAccountIds = new Set<string>(
    [
      commissionAccountId,
      feeAccountId,
      cashClearingAccountId,
      refundExpenseAccountId,
      cashOutgoingAccountId,
    ].filter((id): id is string => id !== undefined),
  );

  const entryMap = new Map(entryRows.map((e) => [e.id, e]));

  const relevantLines = lineRows
    .filter((l) => relevantAccountIds.has(l.accountId))
    .flatMap((l) => {
      const entry = entryMap.get(l.entryId);
      if (!entry) return [];
      return [{
        accountId: l.accountId,
        debitAmount: l.debitAmount,
        creditAmount: l.creditAmount,
        lineCurrency: l.lineCurrency,
        effectiveDate: entry.effectiveDate,
        entryType: entry.type,
        referenceId: entry.referenceId,
        description: entry.description,
      }];
    })
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  let balance = 0;
  const lineItems: StatementLineItem[] = relevantLines.map((l) => {
    balance += l.creditAmount - l.debitAmount;
    return {
      date: l.effectiveDate,
      type: mapLedgerEntryType(l.entryType),
      referenceId: l.referenceId,
      description: l.description,
      debitAmount: l.debitAmount,
      creditAmount: l.creditAmount,
      runningBalance: balance,
      currencyCode: l.lineCurrency,
    };
  });

  return {
    period,
    currencyCode,
    totalGrossBookings,
    totalCommissionEarned,
    totalFeeRevenue,
    totalRefundExpense,
    totalPayoutsDispatched,
    netRevenue,
    lineItems,
    generatedAt: new Date().toISOString(),
  };
}
