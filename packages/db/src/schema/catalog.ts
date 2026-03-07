import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { serviceProviders } from './providers.js';

export const destinations = sqliteTable(
  'destinations',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    countryCode: text('country_code').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ slugIdx: uniqueIndex('destinations_slug_idx').on(t.slug) })
);

export const listingCategories = sqliteTable(
  'listing_categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    parentId: text('parent_id'),
    iconUrl: text('icon_url'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ slugIdx: uniqueIndex('listing_categories_slug_idx').on(t.slug) })
);

export const listings = sqliteTable(
  'listings',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id').notNull().references(() => serviceProviders.id),
    categoryId: text('category_id').notNull().references(() => listingCategories.id),
    destinationId: text('destination_id').notNull().references(() => destinations.id),
    type: text('type', { enum: ['tour', 'hotel', 'rental', 'transfer', 'car', 'package'] }).notNull(),
    status: text('status', { enum: ['draft', 'pending_review', 'active', 'inactive', 'archived'] }).notNull().default('draft'),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    shortDescription: text('short_description').notNull(),
    description: text('description').notNull(),
    coverImageUrl: text('cover_image_url'),
    basePriceAmount: integer('base_price_amount').notNull(),
    currencyCode: text('currency_code').notNull().default('KES'),
    durationMinutes: integer('duration_minutes'),
    maxCapacity: integer('max_capacity'),
    minGuests: integer('min_guests').notNull().default(1),
    isInstantBooking: integer('is_instant_booking', { mode: 'boolean' }).notNull().default(false),
    tags: text('tags').notNull().default('[]'),
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    providerIdx: index('listings_provider_idx').on(t.providerId),
    statusIdx: index('listings_status_idx').on(t.status),
    slugIdx: uniqueIndex('listings_slug_idx').on(t.slug),
    destIdx: index('listings_destination_idx').on(t.destinationId),
  })
);

export const amenities = sqliteTable('amenities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon'),
  category: text('category'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const listingAmenities = sqliteTable(
  'listing_amenities',
  {
    listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    amenityId: text('amenity_id').notNull().references(() => amenities.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: uniqueIndex('listing_amenities_pk').on(t.listingId, t.amenityId) })
);

export const mediaAssets = sqliteTable(
  'media_assets',
  {
    id: text('id').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    purpose: text('purpose', { enum: ['cover', 'gallery', 'document', 'avatar'] }).notNull(),
    r2Key: text('r2_key').notNull(),
    url: text('url').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    uploadedBy: text('uploaded_by'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ entityIdx: index('media_assets_entity_idx').on(t.entityType, t.entityId) })
);

export const pricingRules = sqliteTable(
  'pricing_rules',
  {
    id: text('id').primaryKey(),
    listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    priceAmount: integer('price_amount').notNull(),
    currencyCode: text('currency_code').notNull(),
    unitType: text('unit_type', { enum: ['per_person', 'per_group', 'per_night', 'per_day', 'per_vehicle', 'flat'] }).notNull(),
    minUnits: integer('min_units').notNull().default(1),
    maxUnits: integer('max_units'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ listingIdx: index('pricing_rules_listing_idx').on(t.listingId) })
);

export const seasonalRates = sqliteTable(
  'seasonal_rates',
  {
    id: text('id').primaryKey(),
    listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    priceAmount: integer('price_amount').notNull(),
    currencyCode: text('currency_code').notNull(),
    isMultiplier: integer('is_multiplier', { mode: 'boolean' }).notNull().default(false),
    multiplier: real('multiplier'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ listingDateIdx: index('seasonal_rates_listing_date_idx').on(t.listingId, t.startDate) })
);

export const blackoutDates = sqliteTable(
  'blackout_dates',
  {
    id: text('id').primaryKey(),
    listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    reason: text('reason'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ listingDateIdx: uniqueIndex('blackout_dates_listing_date_idx').on(t.listingId, t.date) })
);

export const inventory = sqliteTable(
  'inventory',
  {
    id: text('id').primaryKey(),
    listingId: text('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    totalCapacity: integer('total_capacity').notNull(),
    bookedCount: integer('booked_count').notNull().default(0),
    remainingCapacity: integer('remaining_capacity').notNull(),
    isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ listingDateIdx: uniqueIndex('inventory_listing_date_idx').on(t.listingId, t.date) })
);
