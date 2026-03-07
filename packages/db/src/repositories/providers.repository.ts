import { eq, and, isNull } from 'drizzle-orm';
import type { DbClient } from '../client.js';
import { serviceProviders, providerMemberships, providerSettings, providerPayoutAccounts, providerCallbackSubscriptions } from '../schema/index.js';

export class ProvidersRepository {
  constructor(private readonly db: DbClient) { }

  async findById(id: string) {
    return this.db.query.serviceProviders.findFirst({
      where: and(eq(serviceProviders.id, id), isNull(serviceProviders.deletedAt)),
    });
  }

  async findBySlug(slug: string) {
    return this.db.query.serviceProviders.findFirst({
      where: and(eq(serviceProviders.slug, slug), isNull(serviceProviders.deletedAt)),
    });
  }

  async findAll(limit = 50, offset = 0) {
    return this.db.query.serviceProviders.findMany({
      where: isNull(serviceProviders.deletedAt),
      orderBy: [serviceProviders.name],
      limit,
      offset,
    });
  }

  async create(data: typeof serviceProviders.$inferInsert) {
    const [provider] = await this.db.insert(serviceProviders).values(data).returning();
    if (!provider) throw new Error('Provider insert returned no rows');
    return provider;
  }

  async update(id: string, data: Partial<typeof serviceProviders.$inferInsert>) {
    const [updated] = await this.db
      .update(serviceProviders)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(serviceProviders.id, id))
      .returning();
    return updated ?? null;
  }

  async getSettings(providerId: string) {
    return this.db.query.providerSettings.findFirst({ where: eq(providerSettings.providerId, providerId) });
  }

  async upsertSettings(data: typeof providerSettings.$inferInsert) {
    await this.db
      .insert(providerSettings)
      .values(data)
      .onConflictDoUpdate({ target: providerSettings.providerId, set: { ...data, updatedAt: new Date().toISOString() } });
  }

  async findMembershipByUser(userId: string) {
    return this.db.query.providerMemberships.findFirst({
      where: and(eq(providerMemberships.userId, userId), eq(providerMemberships.isActive, true)),
    });
  }

  async createMembership(data: typeof providerMemberships.$inferInsert) {
    const [member] = await this.db.insert(providerMemberships).values(data).returning();
    if (!member) throw new Error('Membership insert returned no rows');
    return member;
  }

  async findPayoutAccounts(providerId: string) {
    return this.db.query.providerPayoutAccounts.findMany({
      where: eq(providerPayoutAccounts.providerId, providerId),
    });
  }

  async findDefaultPayoutAccount(providerId: string) {
    return this.db.query.providerPayoutAccounts.findFirst({
      where: and(eq(providerPayoutAccounts.providerId, providerId), eq(providerPayoutAccounts.isDefault, true)),
    });
  }

  async findPayoutAccountById(id: string) {
    return this.db.query.providerPayoutAccounts.findFirst({
      where: eq(providerPayoutAccounts.id, id),
    });
  }

  async createPayoutAccount(data: typeof providerPayoutAccounts.$inferInsert) {
    const [account] = await this.db.insert(providerPayoutAccounts).values(data).returning();
    if (!account) throw new Error('PayoutAccount insert returned no rows');
    return account;
  }

  async updatePayoutAccount(id: string, data: Partial<typeof providerPayoutAccounts.$inferInsert>) {
    const [updated] = await this.db
      .update(providerPayoutAccounts)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(providerPayoutAccounts.id, id))
      .returning();
    return updated ?? null;
  }

  async findCallbackSubscriptions(providerId: string) {
    return this.db.query.providerCallbackSubscriptions.findMany({
      where: eq(providerCallbackSubscriptions.providerId, providerId),
    });
  }

  async findCallbackSubscriptionById(id: string) {
    return this.db.query.providerCallbackSubscriptions.findFirst({
      where: eq(providerCallbackSubscriptions.id, id),
    });
  }

  async findActiveSubscriptionsForEvent(event: string): Promise<(typeof providerCallbackSubscriptions.$inferSelect)[]> {
    const all = await this.db.query.providerCallbackSubscriptions.findMany({
      where: eq(providerCallbackSubscriptions.isActive, true),
    });
    // D1 lacks JSON_CONTAINS; filter in application layer
    return all.filter((sub) => {
      const events = JSON.parse(sub.events) as string[];
      return events.includes(event);
    });
  }

  async createCallbackSubscription(data: typeof providerCallbackSubscriptions.$inferInsert) {
    const [sub] = await this.db.insert(providerCallbackSubscriptions).values(data).returning();
    if (!sub) throw new Error('CallbackSubscription insert returned no rows');
    return sub;
  }

  async updateCallbackSubscription(id: string, data: Partial<typeof providerCallbackSubscriptions.$inferInsert>) {
    const [updated] = await this.db
      .update(providerCallbackSubscriptions)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(providerCallbackSubscriptions.id, id))
      .returning();
    return updated ?? null;
  }
}
