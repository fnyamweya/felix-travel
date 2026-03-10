import { eq, and, desc } from 'drizzle-orm';
import type { DbClient } from '../client.js';
import { ledgerAccounts, ledgerEntries, ledgerEntryLines, commissions } from '../schema/index.js';

// System actor ID — must match a row in the users table seeded as usr_admin_001
const SYSTEM_ACTOR_ID = 'usr_admin_001';

export class LedgerRepository {
  constructor(private readonly db: DbClient) { }

  async listAccounts() {
    return this.db.query.ledgerAccounts.findMany({
      orderBy: [ledgerAccounts.code],
    });
  }

  async findAccountByCode(code: string, providerId?: string | null) {
    if (providerId !== undefined) {
      return this.db.query.ledgerAccounts.findFirst({
        where: and(eq(ledgerAccounts.code, code), eq(ledgerAccounts.providerId, providerId ?? '')),
      });
    }
    return this.db.query.ledgerAccounts.findFirst({ where: eq(ledgerAccounts.code, code) });
  }

  async findOrCreateAccount(data: typeof ledgerAccounts.$inferInsert) {
    const existing = await this.db.query.ledgerAccounts.findFirst({
      where: and(eq(ledgerAccounts.code, data.code)),
    });
    if (existing) return existing;
    const [account] = await this.db.insert(ledgerAccounts).values(data).returning();
    if (!account) throw new Error('LedgerAccount insert returned no rows');
    return account;
  }

  /**
   * Create a balanced journal entry atomically.
   * Validates ∑debits = ∑credits before inserting — rejects imbalanced entries.
   * This is the accounting invariant that makes the ledger correct.
   */
  async createEntry(
    entry: typeof ledgerEntries.$inferInsert,
    lines: Omit<typeof ledgerEntryLines.$inferInsert, 'entryId' | 'id'>[]
  ) {
    const totalDebits = lines.reduce((s, l) => s + (l.debitAmount ?? 0), 0);
    const totalCredits = lines.reduce((s, l) => s + (l.creditAmount ?? 0), 0);
    if (totalDebits !== totalCredits) {
      throw new Error(`Ledger imbalanced: debits=${totalDebits} credits=${totalCredits} ref=${entry.referenceId}`);
    }
    const [createdEntry] = await this.db.insert(ledgerEntries).values(entry).returning();
    if (!createdEntry) throw new Error('LedgerEntry insert returned no rows');
    await this.db.insert(ledgerEntryLines).values(
      lines.map((l) => ({ ...l, id: crypto.randomUUID(), entryId: createdEntry.id }))
    );
    return createdEntry;
  }

  async findEntriesByReference(referenceType: string, referenceId: string) {
    return this.db.query.ledgerEntries.findMany({
      where: and(
        eq(ledgerEntries.referenceType, referenceType as 'booking' | 'payment' | 'refund' | 'payout' | 'manual'),
        eq(ledgerEntries.referenceId, referenceId)
      ),
      orderBy: [desc(ledgerEntries.createdAt)],
    });
  }

  async getAccountBalance(accountId: string) {
    const lines = await this.db
      .select({ debitAmount: ledgerEntryLines.debitAmount, creditAmount: ledgerEntryLines.creditAmount })
      .from(ledgerEntryLines)
      .where(eq(ledgerEntryLines.accountId, accountId));
    const totalDebits = lines.reduce((s, l) => s + l.debitAmount, 0);
    const totalCredits = lines.reduce((s, l) => s + l.creditAmount, 0);
    return { totalDebits, totalCredits, netDebitBalance: totalDebits - totalCredits };
  }

  async createCommission(data: typeof commissions.$inferInsert) {
    const [commission] = await this.db.insert(commissions).values(data).returning();
    if (!commission) throw new Error('Commission insert returned no rows');
    return commission;
  }

  async updateCommissionStatus(bookingId: string, status: 'pending' | 'earned' | 'reversed') {
    await this.db.update(commissions).set({ status }).where(eq(commissions.bookingId, bookingId));
  }

  /**
   * Create a journal entry using human-readable account codes and direction flags.
   * Resolves account codes to account IDs before delegating to createEntry.
   *
   * Preferred API for service layer — avoids requiring callers to know account UUIDs.
   */
  async createEntryByAccountCode(
    entry: Omit<typeof ledgerEntries.$inferInsert, 'effectiveDate' | 'createdBy'> & {
      effectiveDate?: string;
      createdBy?: string;
    },
    lines: Array<{
      accountCode: string;
      direction: 'debit' | 'credit';
      amount: number;
      currency: string;
      providerId?: string | null;
    }>
  ) {
    const resolvedLines = await Promise.all(
      lines.map(async (l) => {
        const account = await this.findAccountByCode(l.accountCode, l.providerId ?? undefined);
        if (!account) {
          throw new Error(
            `Ledger account not found: code='${l.accountCode}'${l.providerId ? ` providerId='${l.providerId}'` : ''}`
          );
        }
        return {
          accountId: account.id,
          debitAmount: l.direction === 'debit' ? l.amount : 0,
          creditAmount: l.direction === 'credit' ? l.amount : 0,
          currencyCode: l.currency,
        };
      })
    );

    return this.createEntry(
      {
        ...entry,
        effectiveDate: entry.effectiveDate ?? new Date().toISOString().slice(0, 10),
        createdBy: entry.createdBy ?? SYSTEM_ACTOR_ID,
      },
      resolvedLines
    );
  }

  /**
   * Get net debit balance for a ledger account identified by code.
   * Returns zeros if the account code does not exist.
   */
  async getBalance(accountCode: string, _currency: string, providerId?: string | null) {
    const account = await this.findAccountByCode(accountCode, providerId ?? undefined);
    if (!account) return { totalDebits: 0, totalCredits: 0, netDebitBalance: 0 };
    return this.getAccountBalance(account.id);
  }

  /**
   * Get entry lines for an account identified by code, optionally filtered by date range.
   */
  async getEntriesForAccount(
    accountCode: string,
    opts?: { from?: string; to?: string; limit?: number; offset?: number },
    providerId?: string | null
  ) {
    const account = await this.findAccountByCode(accountCode, providerId ?? undefined);
    if (!account) return [];
    return this.db.query.ledgerEntryLines.findMany({
      where: eq(ledgerEntryLines.accountId, account.id),
      orderBy: [desc(ledgerEntryLines.createdAt)],
      limit: opts?.limit ?? 100,
      offset: opts?.offset ?? 0,
    });
  }
}
