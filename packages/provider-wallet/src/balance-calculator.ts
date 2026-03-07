import type { DbClient } from '@felix-travel/db';
import { sql, eq, inArray, and, isNull } from 'drizzle-orm';
import {
  ledgerAccounts,
  ledgerEntries,
  ledgerEntryLines,
  payments,
  payouts,
  bookings,
  refunds,
} from '@felix-travel/db';

export interface ProviderBalance {
  providerId: string;
  currencyCode: string;
  /** Total amount allocated to provider from bookings (net of platform commission) */
  providerGrossAllocated: number;
  /** Total amount debited from provider payable via payouts */
  payoutsDebited: number;
  /** Total amount debited from provider payable via pre-payout refunds */
  refundsDebited: number;
  /** Total amount reversed back from failed payouts */
  payoutsReversed: number;
  /** Current ledger balance: grossAllocated - payoutsDebited - refundsDebited + reversed */
  currentBalance: number;
  /** Payout amounts currently in processing state (submitted to Tingg) */
  inTransit: number;
  /** Payout amounts on hold pending approval */
  onHold: number;
  /** Balance available to withdraw: currentBalance - inTransit - onHold */
  withdrawable: number;
  /** Timestamp of calculation */
  calculatedAt: string;
}

async function resolveAccountId(db: DbClient, code: string): Promise<string> {
  const rows = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.code, code), isNull(ledgerAccounts.providerId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error(`Ledger account not found for code: ${code}`);
  return row.id;
}

export async function calculateProviderBalance(
  db: DbClient,
  providerId: string,
  currencyCode = 'KES',
): Promise<ProviderBalance> {
  // Resolve the provider payable account (2000)
  const providerPayableAccountId = await resolveAccountId(db, '2000');

  // --- Collect reference IDs ---

  // Succeeded payment IDs for bookings belonging to this provider
  const succeededPaymentRows = await db
    .select({ id: payments.id })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .where(and(eq(bookings.providerId, providerId), eq(payments.status, 'succeeded')));
  const paymentIds = succeededPaymentRows.map((r) => r.id);

  // All payout IDs for this provider
  const providerPayoutRows = await db
    .select({ id: payouts.id })
    .from(payouts)
    .where(eq(payouts.providerId, providerId));
  const payoutIds = providerPayoutRows.map((r) => r.id);

  // Refund IDs for bookings belonging to this provider (refunds carry a direct bookingId)
  const providerRefundRows = await db
    .select({ id: refunds.id })
    .from(refunds)
    .innerJoin(bookings, eq(refunds.bookingId, bookings.id))
    .where(eq(bookings.providerId, providerId));
  const refundIds = providerRefundRows.map((r) => r.id);

  // --- Resolve ledger entry IDs by type ---

  const bookingPaymentEntryIds: string[] =
    paymentIds.length > 0
      ? (
        await db
          .select({ id: ledgerEntries.id })
          .from(ledgerEntries)
          .where(
            and(
              eq(ledgerEntries.type, 'booking_payment'),
              eq(ledgerEntries.referenceType, 'payment'),
              inArray(ledgerEntries.referenceId, paymentIds),
            ),
          )
      ).map((r) => r.id)
      : [];

  const payoutIssuanceEntryIds: string[] =
    payoutIds.length > 0
      ? (
        await db
          .select({ id: ledgerEntries.id })
          .from(ledgerEntries)
          .where(
            and(
              eq(ledgerEntries.type, 'payout_issuance'),
              eq(ledgerEntries.referenceType, 'payout'),
              inArray(ledgerEntries.referenceId, payoutIds),
            ),
          )
      ).map((r) => r.id)
      : [];

  const payoutUnwindEntryIds: string[] =
    payoutIds.length > 0
      ? (
        await db
          .select({ id: ledgerEntries.id })
          .from(ledgerEntries)
          .where(
            and(
              eq(ledgerEntries.type, 'payout_failure_unwind'),
              eq(ledgerEntries.referenceType, 'payout'),
              inArray(ledgerEntries.referenceId, payoutIds),
            ),
          )
      ).map((r) => r.id)
      : [];

  const refundIssuanceEntryIds: string[] =
    refundIds.length > 0
      ? (
        await db
          .select({ id: ledgerEntries.id })
          .from(ledgerEntries)
          .where(
            and(
              eq(ledgerEntries.type, 'refund_issuance'),
              eq(ledgerEntries.referenceType, 'refund'),
              inArray(ledgerEntries.referenceId, refundIds),
            ),
          )
      ).map((r) => r.id)
      : [];

  // --- Sum credit/debit amounts on account 2000 for each entry set ---

  const sumCreditDebit = async (
    entryIds: string[],
  ): Promise<{ credit: number; debit: number }> => {
    if (entryIds.length === 0) return { credit: 0, debit: 0 };
    const rows = await db
      .select({
        credit: sql<number>`coalesce(sum(${ledgerEntryLines.creditAmount}), 0)`,
        debit: sql<number>`coalesce(sum(${ledgerEntryLines.debitAmount}), 0)`,
      })
      .from(ledgerEntryLines)
      .where(
        and(
          eq(ledgerEntryLines.accountId, providerPayableAccountId),
          inArray(ledgerEntryLines.entryId, entryIds),
          eq(ledgerEntryLines.currencyCode, currencyCode),
        ),
      );
    const row = rows[0];
    return { credit: row?.credit ?? 0, debit: row?.debit ?? 0 };
  };

  const [bookingPaymentSums, payoutIssuanceSums, payoutUnwindSums, refundIssuanceSums] =
    await Promise.all([
      sumCreditDebit(bookingPaymentEntryIds),
      sumCreditDebit(payoutIssuanceEntryIds),
      sumCreditDebit(payoutUnwindEntryIds),
      sumCreditDebit(refundIssuanceEntryIds),
    ]);

  const providerGrossAllocated = bookingPaymentSums.credit;
  const payoutsDebited = payoutIssuanceSums.debit;
  const refundsDebited = refundIssuanceSums.debit;
  const payoutsReversed = payoutUnwindSums.credit;
  const currentBalance =
    providerGrossAllocated - payoutsDebited - refundsDebited + payoutsReversed;

  // --- inTransit and onHold: query payouts table directly ---

  const [inTransitRows, onHoldRows] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${payouts.amount}), 0)` })
      .from(payouts)
      .where(
        and(
          eq(payouts.providerId, providerId),
          inArray(payouts.status, ['processing']),
          eq(payouts.currencyCode, currencyCode),
        ),
      ),
    db
      .select({ total: sql<number>`coalesce(sum(${payouts.amount}), 0)` })
      .from(payouts)
      .where(
        and(
          eq(payouts.providerId, providerId),
          inArray(payouts.status, ['on_hold']),
          eq(payouts.currencyCode, currencyCode),
        ),
      ),
  ]);

  const inTransit = inTransitRows[0]?.total ?? 0;
  const onHold = onHoldRows[0]?.total ?? 0;
  const withdrawable = Math.max(0, currentBalance - inTransit - onHold);

  return {
    providerId,
    currencyCode,
    providerGrossAllocated,
    payoutsDebited,
    refundsDebited,
    payoutsReversed,
    currentBalance,
    inTransit,
    onHold,
    withdrawable,
    calculatedAt: new Date().toISOString(),
  };
}
