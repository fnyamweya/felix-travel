/**
 * BookingService — core booking lifecycle management.
 *
 * State machine:
 *   draft → pending_payment (on confirm)
 *   pending_payment → payment_processing (on checkout)
 *   payment_processing → paid (on payment success webhook)
 *   paid → confirmed (on provider confirmation or instant booking)
 *   confirmed → payout_pending (after settlement delay passes)
 *   payout_pending → payout_processing → payout_completed
 *   any → cancelled (customer/admin cancellation)
 *   paid/confirmed → partially_refunded / refunded
 *
 * Commission calculation:
 *   provider_payable = item_total × (1 - commission_bps / 10000)
 *   platform_commission = item_total × (commission_bps / 10000)
 */
import {
  BookingsRepository,
  CatalogRepository,
  createDbClient,
} from '@felix-travel/db';
import { ChargesRepository, ChargeService } from '@felix-travel/charges';
import type { Env } from '../bindings.js';
import type { SessionContext } from '@felix-travel/types';
import { AppError, NotFoundError, ForbiddenError } from '../lib/errors.js';
import { newId, generateBookingReference } from '../lib/id.js';
import { assertProviderOwnership } from '@felix-travel/auth';

export class BookingService {
  private readonly bookingsRepo: BookingsRepository;
  private readonly catalogRepo: CatalogRepository;
  private readonly chargeService: ChargeService;

  constructor(db: D1Database, _env: Env) {
    const client = createDbClient(db);
    this.bookingsRepo = new BookingsRepository(client);
    this.catalogRepo = new CatalogRepository(client);
    this.chargeService = new ChargeService(new ChargesRepository(client), client);
  }

  async createDraft(
    input: {
      listingId: string;
      serviceDate: string;
      guestCount: number;
      travelers: Array<{ firstName: string; lastName: string; isPrimary: boolean; dateOfBirth?: string; passportNumber?: string; nationality?: string }>;
      specialRequests?: string;
    },
    session: SessionContext
  ) {
    const listing = await this.catalogRepo.findListingById(input.listingId);
    if (!listing) throw new NotFoundError('Listing', input.listingId);

    const subtotalAmount = listing.basePriceAmount * input.guestCount;
    const totalAmount = subtotalAmount; // charges applied on confirm

    const bookingId = newId();
    const reference = generateBookingReference(Math.floor(Math.random() * 99999));

    const booking = await this.bookingsRepo.create({
      id: bookingId,
      reference,
      customerId: session.userId,
      agentId: session.role === 'agent' ? session.userId : null,
      providerId: listing.providerId,
      listingId: input.listingId,
      status: 'draft',
      serviceDate: input.serviceDate,
      guestCount: input.guestCount,
      subtotalAmount,
      commissionAmount: 0,
      taxAmount: 0,
      totalAmount,
      currencyCode: listing.currencyCode,
      specialRequests: input.specialRequests ?? null,
    });

    await this.bookingsRepo.createTravelers(
      input.travelers.map((t) => ({
        id: newId(),
        bookingId,
        firstName: t.firstName,
        lastName: t.lastName,
        isPrimary: t.isPrimary,
        dateOfBirth: t.dateOfBirth ?? null,
        passportNumber: t.passportNumber ?? null,
        nationality: t.nationality ?? null,
      }))
    );

    return booking;
  }

  async getById(id: string, session: SessionContext) {
    const booking = await this.bookingsRepo.findById(id);
    if (!booking) throw new NotFoundError('Booking', id);

    // Enforce access control based on role
    if (session.role === 'customer') {
      if (booking.customerId !== session.userId) throw new ForbiddenError();
    } else if (session.role === 'service_provider') {
      assertProviderOwnership(session, booking.providerId);
    }
    // agents and admins can read all bookings in scope

    return booking;
  }

  async getByReference(reference: string, session: SessionContext) {
    const booking = await this.bookingsRepo.findByReference(reference);
    if (!booking) throw new NotFoundError('Booking', reference);
    if (session.role === 'customer' && booking.customerId !== session.userId) {
      throw new ForbiddenError();
    }
    return booking;
  }

  async listMyBookings(session: SessionContext, page = 1, pageSize = 20) {
    const bookings = await this.bookingsRepo.findByCustomer(session.userId, pageSize, (page - 1) * pageSize);
    return bookings;
  }

  async confirm(bookingId: string, session: SessionContext) {
    const booking = await this.bookingsRepo.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking', bookingId);
    if (session.role === 'customer' && booking.customerId !== session.userId) {
      throw new ForbiddenError();
    }
    if (!['draft', 'quoted'].includes(booking.status)) {
      throw new AppError('INVALID_STATE', `Booking in status '${booking.status}' cannot be confirmed`, 422);
    }

    const updated = await this.bookingsRepo.updateStatus(bookingId, 'pending_payment', session.userId, 'Customer confirmed booking');

    // Apply booking-level charges (commission, taxes, fees) when booking has a real subtotal.
    // For draft bookings created with subtotalAmount=0 (stub), this is a no-op.
    if (booking.subtotalAmount > 0) {
      await this.chargeService.applyBookingCharges(bookingId, {
        scope: 'booking_level',
        timing: 'booking_confirm',
        bookingSubtotal: booking.subtotalAmount,
        currencyCode: booking.currencyCode,
        jurisdictionCountry: 'KE', // TODO: derive from provider.countryCode
      });
    }

    return updated;
  }

  async cancel(bookingId: string, reason: string, session: SessionContext) {
    const booking = await this.bookingsRepo.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking', bookingId);

    const cancellableStatuses = ['draft', 'quoted', 'pending_payment', 'paid', 'confirmed'];
    if (!cancellableStatuses.includes(booking.status)) {
      throw new AppError('INVALID_STATE', `Booking in status '${booking.status}' cannot be cancelled`, 422);
    }

    if (session.role === 'customer' && booking.customerId !== session.userId) {
      throw new ForbiddenError();
    }
    if (session.role === 'service_provider') {
      assertProviderOwnership(session, booking.providerId);
    }

    return this.bookingsRepo.update(bookingId, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: new Date().toISOString(),
    });
  }

  async listByProvider(providerId: string, session: SessionContext, page = 1, pageSize = 50) {
    if (session.role !== 'admin') {
      assertProviderOwnership(session, providerId);
    }
    return this.bookingsRepo.findByProvider(providerId, pageSize, (page - 1) * pageSize);
  }
}
