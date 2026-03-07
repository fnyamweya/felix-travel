import { eq, desc, inArray } from 'drizzle-orm';
import type { DbClient } from '../client.js';
import { payments, paymentAttempts, paymentWebhooks, refunds, refundItems } from '../schema/index.js';

export class PaymentsRepository {
  constructor(private readonly db: DbClient) { }

  async findById(id: string) {
    return this.db.query.payments.findFirst({ where: eq(payments.id, id) });
  }

  async findByBookingId(bookingId: string) {
    return this.db.query.payments.findFirst({
      where: eq(payments.bookingId, bookingId),
      orderBy: [desc(payments.createdAt)],
    });
  }

  async findByTinggCheckoutRequestId(id: string) {
    return this.db.query.payments.findFirst({ where: eq(payments.tinggCheckoutRequestId, id) });
  }

  async findByMerchantTxId(merchantTxId: string) {
    return this.db.query.payments.findFirst({ where: eq(payments.tinggMerchantTxId, merchantTxId) });
  }

  async findPendingPayments() {
    return this.db
      .select()
      .from(payments)
      .where(inArray(payments.status, ['initiated', 'pending_customer_action', 'pending_provider', 'processing']));
  }

  async create(data: typeof payments.$inferInsert) {
    const [payment] = await this.db.insert(payments).values(data).returning();
    if (!payment) throw new Error('Payment insert returned no rows');
    return payment;
  }

  async update(id: string, data: Partial<typeof payments.$inferInsert>) {
    const [updated] = await this.db
      .update(payments)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(payments.id, id))
      .returning();
    return updated ?? null;
  }

  async createAttempt(data: typeof paymentAttempts.$inferInsert) {
    const [attempt] = await this.db.insert(paymentAttempts).values(data).returning();
    if (!attempt) throw new Error('PaymentAttempt insert returned no rows');
    return attempt;
  }

  async updateAttempt(id: string, data: Partial<typeof paymentAttempts.$inferInsert>) {
    const [updated] = await this.db.update(paymentAttempts).set(data).where(eq(paymentAttempts.id, id)).returning();
    return updated ?? null;
  }

  async archiveWebhook(data: typeof paymentWebhooks.$inferInsert) {
    const [wh] = await this.db.insert(paymentWebhooks).values(data).returning();
    if (!wh) throw new Error('PaymentWebhook insert returned no rows');
    return wh;
  }

  async findWebhookByTinggEventId(tinggEventId: string) {
    return this.db.query.paymentWebhooks.findFirst({ where: eq(paymentWebhooks.tinggEventId, tinggEventId) });
  }

  async updateWebhook(id: string, data: Partial<typeof paymentWebhooks.$inferInsert>) {
    await this.db.update(paymentWebhooks).set(data).where(eq(paymentWebhooks.id, id));
  }

  async createRefund(data: typeof refunds.$inferInsert) {
    const [refund] = await this.db.insert(refunds).values(data).returning();
    if (!refund) throw new Error('Refund insert returned no rows');
    return refund;
  }

  async findRefundById(id: string) {
    return this.db.query.refunds.findFirst({ where: eq(refunds.id, id) });
  }

  async updateRefund(id: string, data: Partial<typeof refunds.$inferInsert>) {
    const [updated] = await this.db
      .update(refunds)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(refunds.id, id))
      .returning();
    return updated ?? null;
  }

  async createRefundItems(items: (typeof refundItems.$inferInsert)[]) {
    if (items.length === 0) return [];
    return this.db.insert(refundItems).values(items).returning();
  }

  async findRefundsByPaymentId(paymentId: string) {
    return this.db.select().from(refunds).where(eq(refunds.paymentId, paymentId)).orderBy(desc(refunds.createdAt));
  }

  async findRefundItems(refundId: string) {
    return this.db.query.refundItems.findMany({
      where: eq(refundItems.refundId, refundId),
      orderBy: [desc(refundItems.createdAt)],
    });
  }
}
