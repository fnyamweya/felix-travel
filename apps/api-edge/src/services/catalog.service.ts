import { CatalogRepository, createDbClient } from '@felix-travel/db';
import type { Listing, Destination, AvailabilitySlot, PaginationMeta } from '@felix-travel/types';
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
        const [media, amenityNames] = await Promise.all([
            this.repo.findMediaForEntity('listing', row.id),
            this.repo.findAmenitiesForListing(row.id),
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
            location: null,
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
