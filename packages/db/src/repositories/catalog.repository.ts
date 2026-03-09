import { eq, and, like, or, isNull, desc, sql } from 'drizzle-orm';
import type { DbClient } from '../client.js';
import {
  listings,
  destinations,
  mediaAssets,
  amenities,
  listingAmenities,
  inventory,
  pricingRules,
  blackoutDates,
} from '../schema/index.js';

export class CatalogRepository {
  constructor(private readonly db: DbClient) {}

  /* ── Destinations ─────────────────────────────────────── */

  async findAllDestinations() {
    return this.db.query.destinations.findMany({
      where: eq(destinations.isActive, true),
      orderBy: [destinations.sortOrder, destinations.name],
    });
  }

  /* ── Listings ─────────────────────────────────────────── */

  async searchListings(opts: {
    q?: string;
    destinationId?: string;
    type?: string;
    limit: number;
    offset: number;
  }) {
    const conditions = [
      eq(listings.status, 'active'),
      isNull(listings.deletedAt),
    ];

    if (opts.destinationId) {
      conditions.push(eq(listings.destinationId, opts.destinationId));
    }
    if (opts.type) {
      conditions.push(eq(listings.type, opts.type as typeof listings.$inferSelect['type']));
    }
    if (opts.q) {
      const pattern = `%${opts.q}%`;
      conditions.push(
        or(
          like(listings.title, pattern),
          like(listings.shortDescription, pattern),
          like(listings.tags, pattern),
        )!,
      );
    }

    const where = and(...conditions);

    const rows = await this.db.query.listings.findMany({
      where,
      orderBy: [desc(listings.createdAt)],
      limit: opts.limit,
      offset: opts.offset,
    });

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(listings)
      .where(where);
    const total = countResult[0]?.count ?? 0;

    return { rows, total };
  }

  async findListingById(id: string) {
    return this.db.query.listings.findFirst({
      where: and(eq(listings.id, id), isNull(listings.deletedAt)),
    });
  }

  async findListingBySlug(slug: string) {
    return this.db.query.listings.findFirst({
      where: and(eq(listings.slug, slug), isNull(listings.deletedAt)),
    });
  }

  async findMediaForEntity(entityType: string, entityId: string) {
    return this.db.query.mediaAssets.findMany({
      where: and(eq(mediaAssets.entityType, entityType), eq(mediaAssets.entityId, entityId)),
      orderBy: [mediaAssets.sortOrder],
    });
  }

  async findAmenitiesForListing(listingId: string) {
    const rows = await this.db
      .select({ name: amenities.name, icon: amenities.icon, category: amenities.category })
      .from(listingAmenities)
      .innerJoin(amenities, eq(listingAmenities.amenityId, amenities.id))
      .where(eq(listingAmenities.listingId, listingId));
    return rows.map((r) => r.name);
  }

  async findPricingRules(listingId: string) {
    return this.db.query.pricingRules.findMany({
      where: and(eq(pricingRules.listingId, listingId), eq(pricingRules.isActive, true)),
    });
  }

  /* ── Availability ─────────────────────────────────────── */

  async findAvailability(listingId: string, from?: string, to?: string) {
    const conditions = [eq(inventory.listingId, listingId)];
    if (from) conditions.push(sql`${inventory.date} >= ${from}`);
    if (to) conditions.push(sql`${inventory.date} <= ${to}`);

    return this.db.query.inventory.findMany({
      where: and(...conditions),
      orderBy: [inventory.date],
    });
  }

  async findBlackoutDates(listingId: string, from?: string, to?: string) {
    const conditions = [eq(blackoutDates.listingId, listingId)];
    if (from) conditions.push(sql`${blackoutDates.date} >= ${from}`);
    if (to) conditions.push(sql`${blackoutDates.date} <= ${to}`);

    return this.db.query.blackoutDates.findMany({
      where: and(...conditions),
      orderBy: [blackoutDates.date],
    });
  }
}
