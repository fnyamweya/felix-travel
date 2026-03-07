/**
 * RefundService — partial and full refund flows.
 *
 * Refund allocation logic:
 * 1. Get the booking items
 * 2. If items[] is provided, use explicit allocation
 * 3. Otherwise allocate proportionally across all items by totalPrice
 * 4. For each item: split refund between providerDeduction and platformDeduction
 *    proportional to the item's original split (commission % and provider payable %)
 * 5. Write refund_items records
 * 6. If payout already issued for this booking → post-payout path (reserve account)
 *    Else → pre-payout path (reduce provider payable)
 */
import {
  PaymentsRepository,
  BookingsRepository,
  createDbClient,
} from '@felix-travel/db';
import type { Env } from '../bindings.js';
import type { SessionContext } from '@felix-travel/types';
import { createTinggClient, tinggConfigFromEnv } from '@felix-travel/sdk-tingg';
import { parseEnv } from '@felix-travel/config';
import { AppError, NotFoundError, ForbiddenError } from '../lib/errors.js';
import { newId } from '../lib/id.js';
import { assertCustomerOwnership } from '@felix-travel/auth';
import { LedgerService } from './ledger.service.js';

export class RefundService {
  private readonly paymentsRepo: PaymentsRepository;
  private readonly bookingsRepo: BookingsRepository;
  private readonly ledgerService: LedgerService;
  private readonly env: ReturnType<typeof parseEnv>;

  constructor(db: D1Database, private readonly workerEnv: Env) {
    const client = createDbClient(db);
    this.paymentsRepo = new PaymentsRepository(client);
    this.bookingsRepo = new BookingsRepository(client);
    this.ledgerService = new LedgerService(client);
    this.env = parseEnv(workerEnv as unknown as Record<string, string>);
  }

  async requestRefund(input: {
    paymentId: string;
    amount: number;
    reason: string;
    idempotencyKey: string;
    items?: Array<{ bookingItemId: string; amount: number }>;
  }, session: SessionContext) {
    const payment = await this.paymentsRepo.findById(input.paymentId);
    if (!payment) throw new NotFoundError('Payment', input.paymentId);

    const booking = await this.bookingsRepo.findById(payment.bookingId);
    if (!booking) throw new NotFoundError('Booking', payment.bookingId);

    // Only customers (for their own booking), agents, and admins can request refunds
    if (session.role === 'customer') {
      assertCustomerOwnership(session, booking.customerId);
    } else if (session.role === 'service_provider') {
      if (booking.providerId !== session.userId) throw new ForbiddenError('Cannot request refund for another provider\'s booking');
    }

    if (!['succeeded', 'partially_refunded'].includes(payment.status)) {
      throw new AppError('INVALID_STATE', `Payment in status '${payment.status}' cannot be refunded`, 422);
    }

    if (input.amount > payment.amount) {
      throw new AppError('REFUND_EXCEEDS_PAYMENT', 'Refund amount exceeds original payment amount', 422);
    }

    // Determine if payout was already issued for this booking
    const payoutAlreadyIssued = ['payout_completed', 'payout_processing'].includes(booking.status);

    // Auto-approve small refunds; queue large ones for admin approval
    const needsApproval = input.amount > this.env.REFUND_APPROVAL_THRESHOLD || payoutAlreadyIssued;

    const refundId = newId();

    // Compute item-level allocation
    const bookingItems = await this.bookingsRepo.findItemsByBooking(booking.id);
    const refundItemsData = this.allocateRefund(input.amount, bookingItems, input.items);

    const refund = await this.paymentsRepo.createRefund({
      id: refundId,
      paymentId: input.paymentId,
      bookingId: booking.id,
      requestedBy: session.userId,
      status: needsApproval ? 'pending_approval' : 'approved',
      reason: input.reason,
      amount: input.amount,
      currencyCode: payment.currencyCode,
      idempotencyKey: input.idempotencyKey,
    });

    await this.paymentsRepo.createRefundItems(
      refundItemsData.map((ri) => ({ ...ri, id: newId(), refundId }))
    );

    if (!needsApproval) {
      await this.processApprovedRefund(refundId, session);
    }

    return refund;
  }

  async approveRefund(refundId: string, session: SessionContext) {
    if (session.role !== 'admin') throw new ForbiddenError('Only admins can approve refunds');
    const refund = await this.paymentsRepo.findRefundById(refundId);
    if (!refund) throw new NotFoundError('Refund', refundId);
    if (refund.status !== 'pending_approval') {
      throw new AppError('INVALID_STATE', `Refund is in status '${refund.status}'`, 422);
    }
    await this.paymentsRepo.updateRefund(refundId, { status: 'approved', approvedBy: session.userId });
    return this.processApprovedRefund(refundId, session);
  }

  private async processApprovedRefund(refundId: string, session: SessionContext) {
    const refund = await this.paymentsRepo.findRefundById(refundId);
    if (!refund) throw new NotFoundError('Refund', refundId);

    await this.paymentsRepo.updateRefund(refundId, { status: 'processing' });

    const booking = await this.bookingsRepo.findById(refund.bookingId);
    if (!booking) throw new NotFoundError('Booking', refund.bookingId);

    const payoutAlreadyIssued = ['payout_completed', 'payout_processing'].includes(booking.status);

    try {
      // Call Tingg refund API
      const tingg = createTinggClient(tinggConfigFromEnv(this.workerEnv), this.workerEnv.TOKEN_CACHE_KV);
      const tinggConfig = tinggConfigFromEnv(this.workerEnv);
      const payment = await this.paymentsRepo.findById(refund.paymentId);
      if (!payment?.tinggCheckoutRequestId) {
        throw new AppError('NO_CHECKOUT_ID', 'Payment has no Tingg checkout request ID for refund', 422);
      }

      const response = await tingg.refunds.initiateRefund(
        {
          checkoutRequestID: payment.tinggCheckoutRequestId,
          merchantTransactionID: `RFN-${refund.idempotencyKey}`,
          amount: refund.amount / 100,
          currencyCode: refund.currencyCode,
          serviceCode: tinggConfig.serviceCode,
          callbackURL: tinggConfig.callbackCheckoutUrl,
          reason: refund.reason,
        },
        { correlationId: newId() }
      );

      await this.paymentsRepo.updateRefund(refundId, {
        status: 'succeeded',
        tinggRefundRef: response.results.refundRequestID,
        refundedAt: new Date().toISOString(),
      });

      // Post ledger entries
      await this.ledgerService.postRefundIssuance({
        refundId,
        amount: refund.amount,
        currency: refund.currencyCode,
        postPayout: payoutAlreadyIssued,
      });

      // Update payment and booking status
      const allRefunds = await this.paymentsRepo.findRefundsByPaymentId(refund.paymentId);
      const totalRefunded = allRefunds.filter((r) => r.status === 'succeeded').reduce((s, r) => s + r.amount, 0);
      const payment2 = await this.paymentsRepo.findById(refund.paymentId);
      if (payment2) {
        const newPaymentStatus = totalRefunded >= payment2.amount ? 'refunded' : 'partially_refunded';
        await this.paymentsRepo.update(refund.paymentId, { status: newPaymentStatus });
        const newBookingStatus = totalRefunded >= payment2.amount
          ? 'refunded'
          : 'partially_refunded';
        await this.bookingsRepo.updateStatus(booking.id, newBookingStatus, session.userId, 'Refund processed');
      }

      return await this.paymentsRepo.findRefundById(refundId);
    } catch (err) {
      await this.paymentsRepo.updateRefund(refundId, {
        status: 'failed',
      });
      throw err;
    }
  }

  private allocateRefund(
    totalAmount: number,
    bookingItems: Array<{ id: string; totalPrice: number; providerPayableAmount: number; platformCommissionAmount: number }>,
    explicitItems?: Array<{ bookingItemId: string; amount: number }>
  ): Array<{ bookingItemId: string; amount: number; providerDeduction: number; platformDeduction: number }> {
    if (explicitItems && explicitItems.length > 0) {
      return explicitItems.map((ei) => {
        const item = bookingItems.find((i) => i.id === ei.bookingItemId);
        if (!item) throw new AppError('ITEM_NOT_FOUND', `Booking item ${ei.bookingItemId} not found`, 422);
        const commissionRate = item.platformCommissionAmount / item.totalPrice;
        const platformDeduction = Math.round(ei.amount * commissionRate);
        const providerDeduction = ei.amount - platformDeduction;
        return { bookingItemId: ei.bookingItemId, amount: ei.amount, providerDeduction, platformDeduction };
      });
    }

    // Proportional allocation across all items
    const totalBookingAmount = bookingItems.reduce((s, i) => s + i.totalPrice, 0);
    return bookingItems.map((item, index, arr) => {
      const proportion = item.totalPrice / totalBookingAmount;
      // Ensure rounding doesn't cause total to drift; last item absorbs remainder
      const isLast = index === arr.length - 1;
      const allocated = isLast
        ? totalAmount - arr.slice(0, -1).reduce((s, i) => s + Math.round(totalAmount * (i.totalPrice / totalBookingAmount)), 0)
        : Math.round(totalAmount * proportion);
      const commissionRate = item.totalPrice > 0 ? item.platformCommissionAmount / item.totalPrice : 0;
      const platformDeduction = Math.round(allocated * commissionRate);
      const providerDeduction = allocated - platformDeduction;
      return { bookingItemId: item.id, amount: allocated, providerDeduction, platformDeduction };
    });
  }
}
