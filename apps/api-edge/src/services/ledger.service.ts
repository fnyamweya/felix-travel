import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { LedgerRepository } from '@felix-travel/db';
import { newId } from '../lib/id.js';

const SYSTEM_ACTOR = 'usr_admin_001';

export class LedgerService {
  constructor(private db: DrizzleD1Database<any>) { }

  async listAccounts() {
    const repo = new LedgerRepository(this.db);
    return repo.listAccounts();
  }

  /** DR Cash Clearing (1100) / CR Provider Payable (2000) + CR Platform Revenue (4000) */
  async postPaymentReceived(opts: {
    paymentId: string;
    bookingId: string;
    amount: number;
    currency: string;
    platformFeeRate?: number;
  }) {
    const repo = new LedgerRepository(this.db);
    const feeRate = opts.platformFeeRate ?? 0.05;
    const platformFee = Math.round(opts.amount * feeRate);
    const providerPayable = opts.amount - platformFee;

    await repo.createEntryByAccountCode(
      {
        id: newId(),
        type: 'booking_payment',
        referenceType: 'payment',
        referenceId: opts.paymentId,
        description: `Payment received for booking ${opts.bookingId}`,
        createdBy: SYSTEM_ACTOR,
      },
      [
        { accountCode: '1100', direction: 'debit', amount: opts.amount, currency: opts.currency },
        { accountCode: '2000', direction: 'credit', amount: providerPayable, currency: opts.currency },
        { accountCode: '4000', direction: 'credit', amount: platformFee, currency: opts.currency },
      ]
    );
  }

  /** DR Provider Payable (2000) / CR Cash Outgoing (1200) */
  async postPayoutIssuance(opts: {
    payoutId: string;
    amount: number;
    currency: string;
  }) {
    const repo = new LedgerRepository(this.db);
    await repo.createEntryByAccountCode(
      {
        id: newId(),
        type: 'payout_issuance',
        referenceType: 'payout',
        referenceId: opts.payoutId,
        description: `Payout dispatched ${opts.payoutId}`,
        createdBy: SYSTEM_ACTOR,
      },
      [
        { accountCode: '2000', direction: 'debit', amount: opts.amount, currency: opts.currency },
        { accountCode: '1200', direction: 'credit', amount: opts.amount, currency: opts.currency },
      ]
    );
  }

  /** DR Cash Outgoing (1200) / CR Provider Payable (2000) — reversal on failure */
  async postPayoutFailureUnwind(opts: {
    payoutId: string;
    amount: number;
    currency: string;
  }) {
    const repo = new LedgerRepository(this.db);
    await repo.createEntryByAccountCode(
      {
        id: newId(),
        type: 'payout_failure_unwind',
        referenceType: 'payout',
        referenceId: opts.payoutId,
        description: `Payout failure unwind ${opts.payoutId}`,
        createdBy: SYSTEM_ACTOR,
      },
      [
        { accountCode: '1200', direction: 'debit', amount: opts.amount, currency: opts.currency },
        { accountCode: '2000', direction: 'credit', amount: opts.amount, currency: opts.currency },
      ]
    );
  }

  /**
   * Pre-payout:  DR Provider Payable (2000) / CR Refund Liability (2100)
   * Post-payout: DR Refund Expense (6000)   / CR Cash Outgoing (1200)
   */
  async postRefundIssuance(opts: {
    refundId: string;
    amount: number;
    currency: string;
    postPayout: boolean;
  }) {
    const repo = new LedgerRepository(this.db);
    if (opts.postPayout) {
      await repo.createEntryByAccountCode(
        {
          id: newId(),
          type: 'refund_issuance',
          referenceType: 'refund',
          referenceId: opts.refundId,
          description: `Post-payout refund ${opts.refundId}`,
          createdBy: SYSTEM_ACTOR,
        },
        [
          { accountCode: '6000', direction: 'debit', amount: opts.amount, currency: opts.currency },
          { accountCode: '1200', direction: 'credit', amount: opts.amount, currency: opts.currency },
        ]
      );
    } else {
      await repo.createEntryByAccountCode(
        {
          id: newId(),
          type: 'refund_issuance',
          referenceType: 'refund',
          referenceId: opts.refundId,
          description: `Pre-payout refund ${opts.refundId}`,
          createdBy: SYSTEM_ACTOR,
        },
        [
          { accountCode: '2000', direction: 'debit', amount: opts.amount, currency: opts.currency },
          { accountCode: '2100', direction: 'credit', amount: opts.amount, currency: opts.currency },
        ]
      );
    }
  }

  async getAccountBalance(accountCode: string, currency: string) {
    const repo = new LedgerRepository(this.db);
    return repo.getBalance(accountCode, currency);
  }

  async getAccountEntries(
    accountCode: string,
    opts?: { from?: string; to?: string; limit?: number; offset?: number }
  ) {
    const repo = new LedgerRepository(this.db);
    return repo.getEntriesForAccount(accountCode, opts);
  }
}
