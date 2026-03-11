import { eq, and, asc } from 'drizzle-orm';
import type { DbClient } from '../client.js';
import { countries, currencies, countryCurrencies, regions, regionClosure } from '../schema/index.js';

export class GeographyRepository {
  constructor(private readonly db: DbClient) {}

  // ─── Countries ──────────────────────────────────────────────────────
  async listCountries(opts?: { activeOnly?: boolean; continent?: string }) {
    const conditions = [];
    if (opts?.activeOnly !== false) conditions.push(eq(countries.isActive, true));
    if (opts?.continent) conditions.push(eq(countries.continent, opts.continent as any));
    return this.db.query.countries.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: [asc(countries.sortOrder), asc(countries.name)],
    });
  }

  async getCountryByCode(code: string) {
    return this.db.query.countries.findFirst({ where: eq(countries.code, code.toUpperCase()) });
  }

  async createCountry(data: typeof countries.$inferInsert) {
    const [row] = await this.db.insert(countries).values(data).returning();
    return row!;
  }

  async updateCountry(code: string, data: Partial<typeof countries.$inferInsert>) {
    const [row] = await this.db
      .update(countries)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(countries.code, code.toUpperCase()))
      .returning();
    return row;
  }

  // ─── Currencies ─────────────────────────────────────────────────────
  async listCurrencies(opts?: { activeOnly?: boolean }) {
    const conditions = [];
    if (opts?.activeOnly !== false) conditions.push(eq(currencies.isActive, true));
    return this.db.query.currencies.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: [asc(currencies.sortOrder), asc(currencies.name)],
    });
  }

  async getCurrencyByCode(code: string) {
    return this.db.query.currencies.findFirst({ where: eq(currencies.code, code.toUpperCase()) });
  }

  async createCurrency(data: typeof currencies.$inferInsert) {
    const [row] = await this.db.insert(currencies).values(data).returning();
    return row!;
  }

  // ─── Country-Currency mappings ──────────────────────────────────────
  async getCurrenciesForCountry(countryCode: string) {
    return this.db.query.countryCurrencies.findMany({
      where: eq(countryCurrencies.countryCode, countryCode.toUpperCase()),
    });
  }

  async linkCountryCurrency(data: typeof countryCurrencies.$inferInsert) {
    const [row] = await this.db.insert(countryCurrencies).values(data).returning();
    return row!;
  }

  // ─── Regions ────────────────────────────────────────────────────────
  async listRegions(countryCode: string, opts?: { parentId?: string | null }) {
    const conditions = [eq(regions.countryCode, countryCode.toUpperCase())];
    if (opts?.parentId !== undefined) {
      if (opts.parentId === null) {
        conditions.push(eq(regions.level, 1));
      } else {
        conditions.push(eq(regions.parentId, opts.parentId));
      }
    }
    return this.db.query.regions.findMany({
      where: and(...conditions),
      orderBy: [asc(regions.sortOrder), asc(regions.name)],
    });
  }

  async getRegionById(id: string) {
    return this.db.query.regions.findFirst({ where: eq(regions.id, id) });
  }

  async createRegion(data: typeof regions.$inferInsert) {
    const [row] = await this.db.insert(regions).values(data).returning();
    if (!row) throw new Error('Region insert returned no rows');

    // Self-reference in closure table
    await this.db.insert(regionClosure).values({
      id: crypto.randomUUID(),
      ancestorId: row.id,
      descendantId: row.id,
      depth: 0,
    });

    // If parent, copy parent's ancestors for transitive closure
    if (data.parentId) {
      const parentClosures = await this.db.query.regionClosure.findMany({
        where: eq(regionClosure.descendantId, data.parentId),
      });
      for (const pc of parentClosures) {
        await this.db.insert(regionClosure).values({
          id: crypto.randomUUID(),
          ancestorId: pc.ancestorId,
          descendantId: row.id,
          depth: pc.depth + 1,
        });
      }
    }

    return row;
  }

  async getDescendants(regionId: string) {
    const closures = await this.db.query.regionClosure.findMany({
      where: and(eq(regionClosure.ancestorId, regionId)),
    });
    const ids = closures.filter((c) => c.depth > 0).map((c) => c.descendantId);
    if (!ids.length) return [];
    const results = [];
    for (const id of ids) {
      const r = await this.db.query.regions.findFirst({ where: eq(regions.id, id) });
      if (r) results.push(r);
    }
    return results;
  }

  async getAncestors(regionId: string) {
    const closures = await this.db.query.regionClosure.findMany({
      where: and(eq(regionClosure.descendantId, regionId)),
    });
    const ids = closures.filter((c) => c.depth > 0).map((c) => c.ancestorId);
    if (!ids.length) return [];
    const results = [];
    for (const id of ids) {
      const r = await this.db.query.regions.findFirst({ where: eq(regions.id, id) });
      if (r) results.push(r);
    }
    return results;
  }
}
