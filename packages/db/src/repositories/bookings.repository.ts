import { eq, and, desc, inArray, lte, isNull } from 'drizzle-orm';
import type { DbClient } from '../client.js';
import { bookings, bookingItems, travelers, bookingStatusHistory, bookingQuotes } from '../schema/index.js';

export class BookingsRepository {
  constructor(private readonly db: DbClient) { }

  async findById(id: string) {
    return this.db.query.bookings.findFirst({
      where: and(eq(bookings.id, id), isNull(bookings.deletedAt)),
    });
  }

  async findByReference(reference: string) {
    return this.db.query.bookings.findFirst({
      where: and(eq(bookings.reference, reference), isNull(bookings.deletedAt)),
    });
  }

  async findByCustomer(customerId: string, limit = 20, offset = 0) {
    return this.db.query.bookings.findMany({
      where: and(eq(bookings.customerId, customerId), isNull(bookings.deletedAt)),
      orderBy: [desc(bookings.createdAt)],
      limit,
      offset,
    });
  }

  async findByProvider(providerId: string, limit = 50, offset = 0) {
    return this.db.query.bookings.findMany({
      where: and(eq(bookings.providerId, providerId), isNull(bookings.deletedAt)),
      orderBy: [desc(bookings.createdAt)],
      limit,
      offset,
    });
  }

  async findEligibleForPayout(providerId: string, eligibleBeforeDate: string) {
    return this.db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.providerId, providerId),
          inArray(bookings.status, ['paid', 'confirmed']),
          lte(bookings.serviceDate, eligibleBeforeDate),
          isNull(bookings.deletedAt)
        )
      )
      .orderBy(bookings.serviceDate);
  }

  async create(data: typeof bookings.$inferInsert) {
    const [booking] = await this.db.insert(bookings).values(data).returning();
    if (!booking) throw new Error('Booking insert returned no rows');
    return booking;
  }

  async update(id: string, data: Partial<typeof bookings.$inferInsert>) {
    const [updated] = await this.db
      .update(bookings)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(bookings.id, id))
      .returning();
    return updated ?? null;
  }

  async updateStatus(id: string, status: typeof bookings.$inferSelect['status'], changedBy?: string, reason?: string) {
    const current = await this.findById(id);
    if (!current) throw new Error(`Booking ${id} not found`);
    const [updated] = await this.db
      .update(bookings)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(bookings.id, id))
      .returning();
    await this.db.insert(bookingStatusHistory).values({
      id: crypto.randomUUID(),
      bookingId: id,
      fromStatus: current.status,
      toStatus: status,
      changedBy: changedBy ?? null,
      reason: reason ?? null,
    });
    return updated ?? null;
  }

  async createItems(items: (typeof bookingItems.$inferInsert)[]) {
    if (items.length === 0) return [];
    return this.db.insert(bookingItems).values(items).returning();
  }

  async findItemsByBooking(bookingId: string) {
    return this.db.select().from(bookingItems).where(eq(bookingItems.bookingId, bookingId));
  }

  async createTravelers(travelersList: (typeof travelers.$inferInsert)[]) {
    if (travelersList.length === 0) return [];
    return this.db.insert(travelers).values(travelersList).returning();
  }

  async createQuote(data: typeof bookingQuotes.$inferInsert) {
    const [quote] = await this.db.insert(bookingQuotes).values(data).returning();
    if (!quote) throw new Error('Quote insert returned no rows');
    return quote;
  }

  async findQuoteById(id: string) {
    return this.db.query.bookingQuotes.findFirst({ where: eq(bookingQuotes.id, id) });
  }

  async getStatusHistory(bookingId: string) {
    return this.db
      .select()
      .from(bookingStatusHistory)
      .where(eq(bookingStatusHistory.bookingId, bookingId))
      .orderBy(bookingStatusHistory.createdAt);
  }
}
