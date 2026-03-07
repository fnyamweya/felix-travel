import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { PaymentsRepository, WebhooksRepository } from '@felix-travel/db';
import { BookingsRepository } from '@felix-travel/db';
import { createTinggClient, tinggConfigFromEnv } from '@felix-travel/sdk-tingg';
import { NotFoundError, ConflictError, AppError } from '../lib/errors.js';
import { newId, generateMerchantTxId } from '../lib/id.js';
import { writeAuditLog } from '../lib/audit.js';
import type { SessionContext } from '@felix-travel/types';
import { LedgerService } from './ledger.service.js';
import type { Env } from '../bindings.js';

export class PaymentService {
  private readonly db: DrizzleD1Database<any>;
  private readonly env: Env;

  constructor(db: DrizzleD1Database<any>, env: Env) {
    this.db = db;
    this.env = env;
  }

  async initiateCheckout(
    bookingId: string,
    actor: SessionContext,
    body: {
      accountNumber: string;
      paymentOption?: string;
      MSISDN?: string;
      callbackURL?: string;
    },
  ) {
    const bookingsRepo = new BookingsRepository(this.db);
    const paymentsRepo = new PaymentsRepository(this.db);

    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking', bookingId);
    if (booking.status !== 'confirmed')
      throw new ConflictError('Booking must be confirmed before payment');
    if (actor.role === 'customer' && booking.customerId !== actor.userId)
      throw new AppError('FORBIDDEN', 'Access denied', 403);

    const existing = await paymentsRepo.findByBookingId(bookingId);
    if (existing && (existing.status === 'succeeded' || existing.status === 'processing'))
      throw new ConflictError('Payment already in progress or completed');

    const tinggMerchantTxId = generateMerchantTxId(bookingId);
    const paymentId = newId();
    const idempotencyKey = `checkout:${bookingId}:${tinggMerchantTxId}`;

    await paymentsRepo.create({
      id: paymentId,
      bookingId,
      customerId: booking.customerId,
      tinggMerchantTxId,
      amount: booking.totalAmount,
      currencyCode: booking.currencyCode,
      status: 'initiated',
      idempotencyKey,
      method: 'mobile_money',
    });

    const tinggConfig = tinggConfigFromEnv(this.env);
    const tingg = createTinggClient(tinggConfig, this.env.TOKEN_CACHE_KV);

    const checkoutResp = await tingg.checkout.initiateCheckout({
      merchantTransactionID: tinggMerchantTxId,
      requestAmount: booking.totalAmount / 100,
      currencyCode: booking.currencyCode,
      accountNumber: body.accountNumber,
      serviceCode: tinggConfig.serviceCode,
      callbackURL: body.callbackURL ?? tinggConfig.callbackCheckoutUrl,
      successRedirectURL: tinggConfig.successRedirectUrl,
      failRedirectURL: tinggConfig.failRedirectUrl,
      countryCode: tinggConfig.collectionCountryCode,
      ...(body.MSISDN !== undefined && { MSISDN: body.MSISDN }),
      ...(body.paymentOption !== undefined && { paymentOptions: body.paymentOption }),
    }, { correlationId: newId() });

    const results = checkoutResp.results;
    await paymentsRepo.update(paymentId, {
      tinggCheckoutRequestId: results.checkoutRequestID ?? null,
      checkoutUrl: results.checkoutURL ?? null,
      status: results.requestStatus === 'SUCCESS' ? 'processing' : 'failed',
    });

    const auditRepo = new WebhooksRepository(this.db as any);
    await writeAuditLog(auditRepo, actor, 'payment.checkout_initiated', 'payment', paymentId);

    return { paymentId, checkoutURL: results.checkoutURL, checkoutRequestID: results.checkoutRequestID };
  }

  async processCheckoutWebhook(payload: Record<string, unknown>) {
    const checkoutRequestID = payload['checkoutRequestID'] as string | undefined;
    if (!checkoutRequestID) throw new AppError('MISSING_FIELD', 'Missing checkoutRequestID', 400);

    const replayKey = `tingg_webhook:${checkoutRequestID}`;
    const already = await this.env.REPLAY_PROTECTION_KV.get(replayKey);
    if (already) return { skipped: true };

    await this.env.REPLAY_PROTECTION_KV.put(replayKey, '1', { expirationTtl: 172800 });

    const paymentsRepo = new PaymentsRepository(this.db);
    const bookingsRepo = new BookingsRepository(this.db);

    const payment = await paymentsRepo.findByMerchantTxId(payload['merchantTransactionID'] as string);
    if (!payment) {
      await this.env.REPLAY_PROTECTION_KV.delete(replayKey);
      throw new NotFoundError('Payment', String(payload['merchantTransactionID']));
    }

    const requestStatus = (payload['requestStatus'] as string) ?? '';
    const paidAmountRaw = typeof payload['paidAmount'] === 'number' ? payload['paidAmount'] : 0;

    let newPaymentStatus: 'processing' | 'succeeded' | 'failed';
    if (requestStatus === 'SUCCESS') {
      newPaymentStatus = 'succeeded';
    } else if (requestStatus === 'PENDING' || requestStatus === 'PROCESSING') {
      newPaymentStatus = 'processing';
    } else {
      newPaymentStatus = 'failed';
    }

    const updateFields: Record<string, unknown> = { status: newPaymentStatus };
    if (newPaymentStatus === 'succeeded') {
      updateFields['paidAt'] = new Date().toISOString();
      if (payload['tinggTransactionRef']) {
        updateFields['tinggTransactionRef'] = payload['tinggTransactionRef'];
      }
    }
    if (newPaymentStatus === 'failed' && payload['failureReason']) {
      updateFields['failureReason'] = String(payload['failureReason']);
    }

    await paymentsRepo.update(payment.id, updateFields as Parameters<typeof paymentsRepo.update>[1]);

    if (newPaymentStatus === 'succeeded') {
      await bookingsRepo.updateStatus(payment.bookingId, 'paid', 'system');

      const booking = await bookingsRepo.findById(payment.bookingId);
      if (booking) {
        const amount = paidAmountRaw > 0 ? Math.round(paidAmountRaw * 100) : payment.amount;
        const ledgerSvc = new LedgerService(this.db);
        await ledgerSvc.postPaymentReceived({
          paymentId: payment.id,
          bookingId: payment.bookingId,
          amount,
          currency: booking.currencyCode,
        });
      }

      if (payment.tinggCheckoutRequestId) {
        try {
          const tingg = createTinggClient(tinggConfigFromEnv(this.env), this.env.TOKEN_CACHE_KV);
          await tingg.checkout.acknowledgePayment(
            {
              checkoutRequestID: payment.tinggCheckoutRequestId,
              serviceCode: tinggConfigFromEnv(this.env).serviceCode,
            },
            { correlationId: newId() }
          );
        } catch {
          // Acknowledge best-effort — do not fail the webhook
        }
      }
    }

    return { processed: true, paymentStatus: newPaymentStatus };
  }

  async getPaymentStatus(paymentId: string, actor: SessionContext) {
    const paymentsRepo = new PaymentsRepository(this.db);
    const payment = await paymentsRepo.findById(paymentId);
    if (!payment) throw new NotFoundError('Payment', paymentId);

    if (actor.role === 'customer') {
      const bookingsRepo = new BookingsRepository(this.db);
      const booking = await bookingsRepo.findById(payment.bookingId);
      if (!booking || booking.customerId !== actor.userId)
        throw new AppError('FORBIDDEN', 'Access denied', 403);
    }

    // Lazily poll Tingg for pending payments
    if (payment.status === 'processing' && payment.tinggCheckoutRequestId) {
      try {
        const tinggConfig = tinggConfigFromEnv(this.env);
        const tingg = createTinggClient(tinggConfig, this.env.TOKEN_CACHE_KV);
        const statusResp = await tingg.checkout.queryStatus(
          {
            checkoutRequestID: payment.tinggCheckoutRequestId,
            serviceCode: tinggConfig.serviceCode,
          },
          { correlationId: newId() }
        );
        const res = statusResp.results;

        if (res.requestStatus === 'SUCCESS') {
          await paymentsRepo.update(payment.id, {
            status: 'succeeded',
            paidAt: new Date().toISOString(),
          });
          const bookingsRepo = new BookingsRepository(this.db);
          const booking = await bookingsRepo.findById(payment.bookingId);
          if (booking) {
            const ledgerSvc = new LedgerService(this.db);
            await ledgerSvc.postPaymentReceived({
              paymentId: payment.id,
              bookingId: payment.bookingId,
              amount: payment.amount,
              currency: booking.currencyCode,
            });
          }
          return { ...payment, status: 'succeeded' as const };
        } else if (res.requestStatus === 'FAILED' || res.requestStatus === 'CANCELLED') {
          await paymentsRepo.update(payment.id, { status: 'failed' });
          return { ...payment, status: 'failed' as const };
        }
      } catch {
        // Poll best-effort — return current status
      }
    }

    return payment;
  }

  async pollPendingPayments() {
    const paymentsRepo = new PaymentsRepository(this.db);
    const pending = await paymentsRepo.findPendingPayments();
    let updated = 0;
    const bookingsRepo = new BookingsRepository(this.db);

    for (const payment of pending) {
      if (!payment.tinggCheckoutRequestId) continue;
      try {
        const tinggConfig = tinggConfigFromEnv(this.env);
        const tingg = createTinggClient(tinggConfig, this.env.TOKEN_CACHE_KV);
        const statusResp = await tingg.checkout.queryStatus(
          {
            checkoutRequestID: payment.tinggCheckoutRequestId,
            serviceCode: tinggConfig.serviceCode,
          },
          { correlationId: newId() }
        );
        const res = statusResp.results;

        if (res.requestStatus === 'SUCCESS') {
          await paymentsRepo.update(payment.id, {
            status: 'succeeded',
            paidAt: new Date().toISOString(),
          });
          const booking = await bookingsRepo.findById(payment.bookingId);
          if (booking) {
            const ledgerSvc = new LedgerService(this.db);
            await ledgerSvc.postPaymentReceived({
              paymentId: payment.id,
              bookingId: payment.bookingId,
              amount: payment.amount,
              currency: booking.currencyCode,
            });
          }
          updated++;
        } else if (res.requestStatus === 'FAILED' || res.requestStatus === 'CANCELLED') {
          await paymentsRepo.update(payment.id, { status: 'failed' });
          updated++;
        }
      } catch {
        // Continue to next payment — best-effort polling
      }
    }
    return { polled: pending.length, updated };
  }
}
