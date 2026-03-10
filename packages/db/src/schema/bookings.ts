import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { serviceProviders } from './providers.js';
import { listings, pricingRules } from './catalog.js';

export const bookingQuotes = sqliteTable(
  'booking_quotes',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id').notNull().references(() => users.id),
    listingId: text('listing_id').notNull().references(() => listings.id),
    serviceDate: text('service_date').notNull(),
    guestCount: integer('guest_count').notNull(),
    itemsSnapshot: text('items_snapshot').notNull(),
    subtotalAmount: integer('subtotal_amount').notNull(),
    commissionAmount: integer('commission_amount').notNull(),
    taxAmount: integer('tax_amount').notNull().default(0),
    totalAmount: integer('total_amount').notNull(),
    currencyCode: text('currency_code').notNull(),
    expiresAt: text('expires_at').notNull(),
    convertedToBookingId: text('converted_to_booking_id'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ customerIdx: index('booking_quotes_customer_idx').on(t.customerId) })
);

export const bookings = sqliteTable(
  'bookings',
  {
    id: text('id').primaryKey(),
    reference: text('reference').notNull(),
    customerId: text('customer_id').notNull().references(() => users.id),
    agentId: text('agent_id').references(() => users.id),
    providerId: text('provider_id').notNull().references(() => serviceProviders.id),
    listingId: text('listing_id').notNull().references(() => listings.id),
    quoteId: text('quote_id').references(() => bookingQuotes.id),
    status: text('status', {
      enum: ['draft', 'quoted', 'pending_payment', 'payment_processing', 'paid', 'provider_accepted', 'provider_on_hold', 'provider_rejected', 'confirmed', 'partially_refunded', 'refunded', 'cancelled', 'failed', 'payout_pending', 'payout_processing', 'payout_completed'],
    }).notNull().default('draft'),
    serviceDate: text('service_date').notNull(),
    serviceDateEnd: text('service_date_end'),
    guestCount: integer('guest_count').notNull(),
    subtotalAmount: integer('subtotal_amount').notNull(),
    commissionAmount: integer('commission_amount').notNull(),
    taxAmount: integer('tax_amount').notNull().default(0),
    totalAmount: integer('total_amount').notNull(),
    currencyCode: text('currency_code').notNull(),
    specialRequests: text('special_requests'),
    internalNotes: text('internal_notes'),
    cancellationReason: text('cancellation_reason'),
    expiresAt: text('expires_at'),
    confirmedAt: text('confirmed_at'),
    cancelledAt: text('cancelled_at'),
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    referenceIdx: uniqueIndex('bookings_reference_idx').on(t.reference),
    customerIdx: index('bookings_customer_idx').on(t.customerId),
    providerIdx: index('bookings_provider_idx').on(t.providerId),
    statusIdx: index('bookings_status_idx').on(t.status),
    serviceDateIdx: index('bookings_service_date_idx').on(t.serviceDate),
  })
);

export const bookingItems = sqliteTable(
  'booking_items',
  {
    id: text('id').primaryKey(),
    bookingId: text('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
    listingId: text('listing_id').notNull().references(() => listings.id),
    pricingRuleId: text('pricing_rule_id').references(() => pricingRules.id),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').notNull(),
    totalPrice: integer('total_price').notNull(),
    providerId: text('provider_id').notNull().references(() => serviceProviders.id),
    providerPayableAmount: integer('provider_payable_amount').notNull(),
    platformCommissionAmount: integer('platform_commission_amount').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ bookingIdx: index('booking_items_booking_idx').on(t.bookingId) })
);

export const travelers = sqliteTable(
  'travelers',
  {
    id: text('id').primaryKey(),
    bookingId: text('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    dateOfBirth: text('date_of_birth'),
    passportNumber: text('passport_number'),
    nationality: text('nationality'),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ bookingIdx: index('travelers_booking_idx').on(t.bookingId) })
);

export const bookingStatusHistory = sqliteTable(
  'booking_status_history',
  {
    id: text('id').primaryKey(),
    bookingId: text('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    changedBy: text('changed_by'),
    reason: text('reason'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ bookingIdx: index('booking_status_history_booking_idx').on(t.bookingId) })
);

/**
 * Booking-level charge overrides — allows admins to override a specific
 * charge amount on a booking (or booking item). The override replaces the
 * engine-computed amount when calculating the final breakdown.
 */
export const bookingChargeOverrides = sqliteTable(
  'booking_charge_overrides',
  {
    id: text('id').primaryKey(),
    bookingId: text('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
    bookingItemId: text('booking_item_id'),
    chargeDefinitionId: text('charge_definition_id').notNull(),
    /** null = use engine value; set = override with this fixed amount (minor units) */
    overrideAmount: integer('override_amount'),
    /** null = use engine value; set = override rate in basis points */
    overrideRateBps: integer('override_rate_bps'),
    /** If true the entire charge is waived for this booking */
    isWaived: integer('is_waived', { mode: 'boolean' }).notNull().default(false),
    reason: text('reason').notNull(),
    createdBy: text('created_by').notNull().references(() => users.id),
    approvedBy: text('approved_by'),
    status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    bookingIdx: index('booking_charge_overrides_booking_idx').on(t.bookingId),
    chargeDefIdx: index('booking_charge_overrides_charge_def_idx').on(t.chargeDefinitionId),
  })
);
