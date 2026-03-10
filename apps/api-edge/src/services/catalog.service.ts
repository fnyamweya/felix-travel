import { CatalogRepository, createDbClient } from '@felix-travel/db';
import type { Listing, Destination, AvailabilitySlot, ListingCategory, PaginationMeta } from '@felix-travel/types';
import { newId } from '../lib/id.js';
import { NotFoundError } from '../lib/errors.js';

export class CatalogService {
    private readonly repo: CatalogRepository;

    constructor(db: D1Database) {
        const client = createDbClient(db);
        this.repo = new CatalogRepository(client);
    }

    async getDestinations(): Promise<Destination[]> {
        const rows = await this.repo.findAllDestinations();
        return rows.map((d) => ({
            id: d.id,
            name: d.name,
            slug: d.slug,
            countryCode: d.countryCode,
            description: d.description ?? null,
            imageUrl: d.imageUrl ?? null,
            isActive: d.isActive,
        }));
    }

    async getListingCategories(): Promise<ListingCategory[]> {
        const rows = await this.repo.findAllListingCategories();
        return rows.map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
            parentId: category.parentId ?? null,
            iconUrl: category.iconUrl ?? null,
        }));
    }

    async searchListings(params: {
        q?: string;
        destinationId?: string;
        type?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{ listings: Listing[]; meta: PaginationMeta }> {
        const page = Math.max(1, params.page ?? 1);
        const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
        const offset = (page - 1) * pageSize;

        const searchOpts: Parameters<CatalogRepository['searchListings']>[0] = {
            limit: pageSize,
            offset,
        };
        if (params.q) searchOpts.q = params.q;
        if (params.destinationId) searchOpts.destinationId = params.destinationId;
        if (params.type) searchOpts.type = params.type;

        const { rows, total } = await this.repo.searchListings(searchOpts);

        const listings = await Promise.all(rows.map((r) => this.enrichListing(r)));
        const totalPages = Math.ceil(total / pageSize);

        return {
            listings,
            meta: {
                page,
                pageSize,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    }

    async getListing(id: string): Promise<Listing> {
        const row = await this.repo.findListingById(id) ?? await this.repo.findListingBySlug(id);
        if (!row) throw new NotFoundError('Listing', id);
        return this.enrichListing(row);
    }

    async getProviderListings(providerId: string): Promise<Listing[]> {
        const rows = await this.repo.findListingsByProvider(providerId);
        return Promise.all(rows.map((row) => this.enrichListing(row)));
    }

    async createProviderListing(providerId: string, data: {
        categoryId: string;
        destinationId: string;
        type: Listing['type'];
        title: string;
        slug: string;
        shortDescription: string;
        description: string;
        basePriceAmount: number;
        currencyCode: string;
        durationMinutes?: number;
        maxCapacity?: number;
        minGuests?: number;
        isInstantBooking?: boolean;
        tags?: string[];
    }): Promise<Listing> {
        const listing = await this.repo.createListing({
            id: newId(),
            providerId,
            categoryId: data.categoryId,
            destinationId: data.destinationId,
            type: data.type,
            status: 'draft',
            title: data.title,
            slug: data.slug,
            shortDescription: data.shortDescription,
            description: data.description,
            coverImageUrl: null,
            basePriceAmount: data.basePriceAmount,
            currencyCode: data.currencyCode,
            durationMinutes: data.durationMinutes ?? null,
            maxCapacity: data.maxCapacity ?? null,
            minGuests: data.minGuests ?? 1,
            isInstantBooking: data.isInstantBooking ?? false,
            tags: JSON.stringify(data.tags ?? []),
            deletedAt: null,
        });
        return this.enrichListing(listing);
    }

    async updateProviderListing(providerId: string, listingId: string, data: Partial<{
        categoryId: string;
        destinationId: string;
        type: Listing['type'];
        status: Listing['status'];
        title: string;
        slug: string;
        shortDescription: string;
        description: string;
        basePriceAmount: number;
        currencyCode: string;
        durationMinutes: number;
        maxCapacity: number;
        minGuests: number;
        isInstantBooking: boolean;
        tags: string[];
    }>): Promise<Listing> {
        const existing = await this.repo.findListingById(listingId);
        if (!existing || existing.providerId !== providerId) throw new NotFoundError('Listing', listingId);

        const updated = await this.repo.updateListing(listingId, {
            ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
            ...(data.destinationId !== undefined && { destinationId: data.destinationId }),
            ...(data.type !== undefined && { type: data.type }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.title !== undefined && { title: data.title }),
            ...(data.slug !== undefined && { slug: data.slug }),
            ...(data.shortDescription !== undefined && { shortDescription: data.shortDescription }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.basePriceAmount !== undefined && { basePriceAmount: data.basePriceAmount }),
            ...(data.currencyCode !== undefined && { currencyCode: data.currencyCode }),
            ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
            ...(data.maxCapacity !== undefined && { maxCapacity: data.maxCapacity }),
            ...(data.minGuests !== undefined && { minGuests: data.minGuests }),
            ...(data.isInstantBooking !== undefined && { isInstantBooking: data.isInstantBooking }),
            ...(data.tags !== undefined && { tags: JSON.stringify(data.tags) }),
        });

        if (!updated) throw new NotFoundError('Listing', listingId);
        return this.enrichListing(updated);
    }

    async createPricingRuleForListing(providerId: string, listingId: string, data: {
        name: string;
        priceAmount: number;
        currencyCode: string;
        unitType: 'per_person' | 'per_group' | 'per_night' | 'per_day' | 'per_vehicle' | 'flat';
        minUnits?: number;
        maxUnits?: number;
    }) {
        const listing = await this.repo.findListingById(listingId);
        if (!listing || listing.providerId !== providerId) throw new NotFoundError('Listing', listingId);

        return this.repo.createPricingRule({
            id: newId(),
            listingId,
            name: data.name,
            priceAmount: data.priceAmount,
            currencyCode: data.currencyCode,
            unitType: data.unitType,
            minUnits: data.minUnits ?? 1,
            maxUnits: data.maxUnits ?? null,
            isActive: true,
        });
    }

    async createBlackoutDateForListing(providerId: string, listingId: string, data: { date: string; reason?: string }) {
        const listing = await this.repo.findListingById(listingId);
        if (!listing || listing.providerId !== providerId) throw new NotFoundError('Listing', listingId);

        return this.repo.createBlackoutDate({
            id: newId(),
            listingId,
            date: data.date,
            reason: data.reason ?? null,
        });
    }

    async updateListingInventory(providerId: string, listingId: string, data: { date: string; totalCapacity: number; isAvailable?: boolean }) {
        const listing = await this.repo.findListingById(listingId);
        if (!listing || listing.providerId !== providerId) throw new NotFoundError('Listing', listingId);

        return this.repo.upsertInventory({
            id: newId(),
            listingId,
            date: data.date,
            totalCapacity: data.totalCapacity,
            bookedCount: 0,
            remainingCapacity: data.totalCapacity,
            isAvailable: data.isAvailable ?? true,
        });
    }

    async getAvailability(
        listingId: string,
        params?: { from?: string; to?: string },
    ): Promise<AvailabilitySlot[]> {
        const listing = await this.repo.findListingById(listingId);
        if (!listing) throw new NotFoundError('Listing', listingId);

        const [slots, blackouts] = await Promise.all([
            this.repo.findAvailability(listingId, params?.from, params?.to),
            this.repo.findBlackoutDates(listingId, params?.from, params?.to),
        ]);

        const blackoutSet = new Set(blackouts.map((b) => b.date));

        return slots.map((s) => ({
            date: s.date,
            available: s.isAvailable && !blackoutSet.has(s.date),
            remainingCapacity: s.remainingCapacity,
            price: null, // pricing computed separately if seasonal rates apply
        }));
    }

    private async enrichListing(row: {
        id: string;
        providerId: string;
        categoryId: string;
        destinationId: string;
        type: string;
        status: string;
        title: string;
        slug: string;
        shortDescription: string;
        description: string;
        coverImageUrl: string | null;
        basePriceAmount: number;
        currencyCode: string;
        durationMinutes: number | null;
        maxCapacity: number | null;
        minGuests: number;
        isInstantBooking: boolean;
        tags: string;
        createdAt: string;
        updatedAt: string;
    }): Promise<Listing> {
        const [media, amenityNames, destination] = await Promise.all([
            this.repo.findMediaForEntity('listing', row.id),
            this.repo.findAmenitiesForListing(row.id),
            this.repo.findDestinationById(row.destinationId),
        ]);

        let tags: string[] = [];
        try {
            tags = JSON.parse(row.tags);
        } catch {
            /* ignore malformed tags */
        }

        return {
            id: row.id,
            providerId: row.providerId,
            categoryId: row.categoryId,
            destinationId: row.destinationId,
            type: row.type as Listing['type'],
            status: row.status as Listing['status'],
            title: row.title,
            slug: row.slug,
            shortDescription: row.shortDescription,
            description: row.description,
            coverImageUrl: row.coverImageUrl,
            location: destination?.name ?? null,
            mediaAssets: media.map((m) => ({
                id: m.id,
                entityType: m.entityType,
                entityId: m.entityId,
                purpose: m.purpose as 'cover' | 'gallery' | 'document' | 'avatar',
                url: m.url,
                mimeType: m.mimeType,
                sizeBytes: m.sizeBytes,
                sortOrder: m.sortOrder,
                createdAt: m.createdAt,
            })),
            basePrice: { amount: row.basePriceAmount, currency: row.currencyCode },
            currencyCode: row.currencyCode,
            durationMinutes: row.durationMinutes,
            maxCapacity: row.maxCapacity,
            minGuests: row.minGuests,
            isInstantBooking: row.isInstantBooking,
            tags,
            amenities: amenityNames,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
}
