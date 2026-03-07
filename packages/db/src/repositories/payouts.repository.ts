import { eq, desc, inArray } from 'drizzle-orm';
import type { DbClient } from '../client.js';
import { payouts, payoutBatches, payoutBookingLinks, payoutWebhooks } from '../schema/index.js';

export class PayoutsRepository {
  constructor(private readonly db: DbClient) { }

  async findById(id: string) {
    return this.db.query.payouts.findFirst({ where: eq(payouts.id, id) });
  }

  async findByIdempotencyKey(key: string) {
    return this.db.query.payouts.findFirst({ where: eq(payouts.idempotencyKey, key) });
  }

  async findByTinggPaymentRef(ref: string) {
    return this.db.query.payouts.findFirst({ where: eq(payouts.tinggPaymentRef, ref) });
  }

  async findByProvider(providerId: string, limit = 50, offset = 0) {
    return this.db.query.payouts.findMany({
      where: eq(payouts.providerId, providerId),
      orderBy: [desc(payouts.createdAt)],
      limit,
      offset,
    });
  }

  async findPendingPayouts() {
    return this.db.select().from(payouts).where(inArray(payouts.status, ['pending', 'scheduled', 'processing']));
  }

  async create(data: typeof payouts.$inferInsert) {
    const [payout] = await this.db.insert(payouts).values(data).returning();
    if (!payout) throw new Error('Payout insert returned no rows');
    return payout;
  }

  async update(id: string, data: Partial<typeof payouts.$inferInsert>) {
    const [updated] = await this.db
      .update(payouts)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(payouts.id, id))
      .returning();
    return updated ?? null;
  }

  async createBatch(data: typeof payoutBatches.$inferInsert) {
    const [batch] = await this.db.insert(payoutBatches).values(data).returning();
    if (!batch) throw new Error('PayoutBatch insert returned no rows');
    return batch;
  }

  async updateBatch(id: string, data: Partial<typeof payoutBatches.$inferInsert>) {
    const [updated] = await this.db
      .update(payoutBatches)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(payoutBatches.id, id))
      .returning();
    return updated ?? null;
  }

  async addBookingLinks(links: (typeof payoutBookingLinks.$inferInsert)[]) {
    if (links.length === 0) return [];
    return this.db.insert(payoutBookingLinks).values(links).returning();
  }

  async archiveWebhook(data: typeof payoutWebhooks.$inferInsert) {
    const [wh] = await this.db.insert(payoutWebhooks).values(data).returning();
    if (!wh) throw new Error('PayoutWebhook insert returned no rows');
    return wh;
  }

  async findWebhookByTinggEventId(tinggEventId: string) {
    return this.db.query.payoutWebhooks.findFirst({ where: eq(payoutWebhooks.tinggEventId, tinggEventId) });
  }

  async updateWebhook(id: string, data: Partial<typeof payoutWebhooks.$inferInsert>) {
    await this.db.update(payoutWebhooks).set(data).where(eq(payoutWebhooks.id, id));
  }
}
