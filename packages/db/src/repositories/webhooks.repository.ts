import { eq, and, lte, inArray, desc } from 'drizzle-orm';
import type { DbClient } from '../client.js';
import { webhookDeliveries, auditLogs } from '../schema/index.js';

export class WebhooksRepository {
  constructor(private readonly db: DbClient) { }

  async createDelivery(data: typeof webhookDeliveries.$inferInsert) {
    const [delivery] = await this.db.insert(webhookDeliveries).values(data).returning();
    if (!delivery) throw new Error('WebhookDelivery insert returned no rows');
    return delivery;
  }

  async findDeliveryById(id: string) {
    return this.db.query.webhookDeliveries.findFirst({ where: eq(webhookDeliveries.id, id) });
  }

  async updateDelivery(id: string, data: Partial<typeof webhookDeliveries.$inferInsert>) {
    const [updated] = await this.db
      .update(webhookDeliveries)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(webhookDeliveries.id, id))
      .returning();
    return updated ?? null;
  }

  async findDueForRetry(now: string) {
    return this.db
      .select()
      .from(webhookDeliveries)
      .where(and(inArray(webhookDeliveries.status, ['pending', 'retrying', 'failed']), lte(webhookDeliveries.nextRetryAt, now)))
      .limit(50);
  }

  async findBySubscription(subscriptionId: string, limit = 50) {
    return this.db.query.webhookDeliveries.findMany({
      where: eq(webhookDeliveries.subscriptionId, subscriptionId),
      orderBy: [desc(webhookDeliveries.createdAt)],
      limit,
    });
  }

  async createAuditLog(data: typeof auditLogs.$inferInsert) {
    const [log] = await this.db.insert(auditLogs).values(data).returning();
    if (!log) throw new Error('AuditLog insert returned no rows');
    return log;
  }

  async findAuditLogs(entityType?: string, entityId?: string, limit = 50, offset = 0) {
    if (entityType && entityId) {
      return this.db.query.auditLogs.findMany({
        where: and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)),
        orderBy: [desc(auditLogs.createdAt)],
        limit,
        offset,
      });
    }
    return this.db.query.auditLogs.findMany({ orderBy: [desc(auditLogs.createdAt)], limit, offset });
  }
}
