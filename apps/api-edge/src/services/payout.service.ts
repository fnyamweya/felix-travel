import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { PayoutsRepository, BookingsRepository, ProvidersRepository, WebhooksRepository } from '@felix-travel/db';
import { createTinggClient, tinggConfigFromEnv } from '@felix-travel/sdk-tingg';
import { NotFoundError, ConflictError, AppError } from '../lib/errors.js';
import { newId } from '../lib/id.js';
import { writeAuditLog } from '../lib/audit.js';
import type { SessionContext } from '@felix-travel/types';
import { LedgerService } from './ledger.service.js';
import type { Env } from '../bindings.js';

export class PayoutService {
  private readonly db: DrizzleD1Database<any>;
  private readonly env: Env;

  constructor(db: DrizzleD1Database<any>, env: Env) {
    this.db = db;
    this.env = env;
  }

  async runPayout(
    providerId: string,
    actor: SessionContext,
    body: {
      idempotencyKey: string;
      currency?: string;
    },
  ) {
    const payoutsRepo = new PayoutsRepository(this.db);
    const bookingsRepo = new BookingsRepository(this.db);
    const providersRepo = new ProvidersRepository(this.db);

    const existing = await payoutsRepo.findByIdempotencyKey(body.idempotencyKey);
    if (existing) return existing;

    // Find the provider's default payout account (required field on payouts table)
    const payoutAccount = await providersRepo.findDefaultPayoutAccount(providerId);
    if (!payoutAccount) {
      throw new AppError('NO_PAYOUT_ACCOUNT', 'Provider has no default payout account configured', 422);
    }

    const eligibleBookings = await bookingsRepo.findEligibleForPayout(
      providerId,
      new Date().toISOString().slice(0, 10)
    );
    if (!eligibleBookings.length) {
      throw new ConflictError('No bookings eligible for payout');
    }

    const totalAmount = eligibleBookings.reduce((sum, b) => sum + (b.subtotalAmount - b.commissionAmount), 0);
    const currencyCode = body.currency ?? payoutAccount.currencyCode;

    // Large payouts require approval; put them on hold for admin review
    const approvalThreshold = parseInt(this.env.PAYOUT_APPROVAL_THRESHOLD ?? '500000', 10);
    const requiresApproval = totalAmount > approvalThreshold;

    const payoutId = newId();

    const payout = await payoutsRepo.create({
      id: payoutId,
      providerId,
      payoutAccountId: payoutAccount.id,
      amount: totalAmount,
      currencyCode,
      status: requiresApproval ? 'on_hold' : 'pending',
      holdReason: requiresApproval ? 'Exceeds auto-approval threshold — pending admin review' : null,
      idempotencyKey: body.idempotencyKey,
    });

    // Link eligible bookings to this payout
    await payoutsRepo.addBookingLinks(
      eligibleBookings.map((b) => ({
        id: newId(),
        payoutId,
        bookingId: b.id,
        amount: b.subtotalAmount - b.commissionAmount,
      }))
    );

    const auditRepo = new WebhooksRepository(this.db as any);
    await writeAuditLog(auditRepo, actor, 'payout.created', 'payout', payoutId);

    if (!requiresApproval) {
      return this.dispatchPayout(payoutId, actor);
    }

    return payout;
  }

  async dispatchPayout(payoutId: string, _actor: SessionContext) {
    const payoutsRepo = new PayoutsRepository(this.db);
    const providersRepo = new ProvidersRepository(this.db);

    const payout = await payoutsRepo.findById(payoutId);
    if (!payout) throw new NotFoundError('Payout', payoutId);
    if (payout.status !== 'pending')
      throw new ConflictError(`Payout is in status '${payout.status}' and cannot be dispatched`);

    // Load payout account details for Tingg
    const payoutAccount = await providersRepo.findPayoutAccountById(payout.payoutAccountId);
    if (!payoutAccount) {
      throw new AppError('PAYOUT_ACCOUNT_MISSING', 'Payout account no longer exists', 422);
    }

    await payoutsRepo.update(payoutId, { status: 'processing' });

    const tinggConfig = tinggConfigFromEnv(this.env);
    const tingg = createTinggClient(tinggConfig, this.env.TOKEN_CACHE_KV);
    const ledgerSvc = new LedgerService(this.db);

    try {
      const payoutResp = await tingg.localPayout.postLocalPayment({
        merchantRef: payout.idempotencyKey,
        serviceCode: tinggConfig.payoutServiceCode,
        amount: payout.amount / 100,
        currencyCode: payout.currencyCode,
        creditPartyIdentifier: payoutAccount.accountNumber,
        creditPartyNetwork: payoutAccount.networkCode,
        countryCode: payoutAccount.countryCode,
        callbackURL: tinggConfig.callbackPayoutUrl,
        narration: `Payout for provider ${payout.providerId}`,
        creditPartyName: payoutAccount.accountName,
      }, { correlationId: newId() });

      const res = payoutResp.results;
      await payoutsRepo.update(payoutId, {
        status: 'processing',
        tinggPaymentRef: res.paymentRef ?? null,
        tinggTransactionRef: res.transactionRef ?? null,
      });

      await ledgerSvc.postPayoutIssuance({
        payoutId,
        amount: payout.amount,
        currency: payout.currencyCode,
      });

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await payoutsRepo.update(payoutId, {
        status: 'failed',
        failureReason: message,
      });

      await ledgerSvc.postPayoutFailureUnwind({
        payoutId,
        amount: payout.amount,
        currency: payout.currencyCode,
      });

      throw new AppError('DISPATCH_FAILED', `Payout dispatch failed: ${message}`, 502);
    }

    return payoutsRepo.findById(payoutId);
  }

  async processPayoutWebhook(payload: Record<string, unknown>) {
    const paymentRef = payload['paymentRef'] as string | undefined;
    if (!paymentRef) throw new AppError('MISSING_FIELD', 'Missing paymentRef in webhook', 400);

    const replayKey = `tingg_payout_webhook:${paymentRef}`;
    const already = await this.env.REPLAY_PROTECTION_KV.get(replayKey);
    if (already) return { skipped: true };

    await this.env.REPLAY_PROTECTION_KV.put(replayKey, '1', { expirationTtl: 172800 });

    const payoutsRepo = new PayoutsRepository(this.db);
    const payout = await payoutsRepo.findByTinggPaymentRef(paymentRef);
    if (!payout) {
      await this.env.REPLAY_PROTECTION_KV.delete(replayKey);
      throw new NotFoundError('Payout', paymentRef);
    }

    const requestStatus = payload['requestStatus'] as string;
    let newStatus: 'succeeded' | 'failed' | 'processing';

    if (requestStatus === 'SUCCESS') {
      newStatus = 'succeeded';
    } else if (requestStatus === 'FAILED' || requestStatus === 'CANCELLED') {
      newStatus = 'failed';
    } else {
      newStatus = 'processing';
    }

    const updateData: Parameters<typeof payoutsRepo.update>[1] = { status: newStatus };
    if (newStatus === 'succeeded') {
      updateData.processedAt = new Date().toISOString();
    }

    await payoutsRepo.update(payout.id, updateData);

    if (newStatus === 'failed') {
      const ledgerSvc = new LedgerService(this.db);
      await ledgerSvc.postPayoutFailureUnwind({
        payoutId: payout.id,
        amount: payout.amount,
        currency: payout.currencyCode,
      });
    }

    return { processed: true, status: newStatus };
  }

  async retryPayout(payoutId: string, actor: SessionContext) {
    const payoutsRepo = new PayoutsRepository(this.db);
    const payout = await payoutsRepo.findById(payoutId);
    if (!payout) throw new NotFoundError('Payout', payoutId);
    if (payout.status !== 'failed') {
      throw new ConflictError('Only failed payouts can be retried');
    }

    await payoutsRepo.update(payoutId, {
      status: 'pending',
      failureReason: null,
    });

    const auditRepo = new WebhooksRepository(this.db as any);
    await writeAuditLog(auditRepo, actor, 'payout.retry', 'payout', payoutId);

    return this.dispatchPayout(payoutId, actor);
  }

  async approvePayout(payoutId: string, actor: SessionContext) {
    const payoutsRepo = new PayoutsRepository(this.db);
    const payout = await payoutsRepo.findById(payoutId);
    if (!payout) throw new NotFoundError('Payout', payoutId);
    if (payout.status !== 'on_hold') {
      throw new ConflictError(`Payout is not on hold — current status: '${payout.status}'`);
    }

    await payoutsRepo.update(payoutId, {
      status: 'pending',
      holdReason: null,
      approvedBy: actor.userId,
    });

    const auditRepo = new WebhooksRepository(this.db as any);
    await writeAuditLog(auditRepo, actor, 'payout.approved', 'payout', payoutId);

    return this.dispatchPayout(payoutId, actor);
  }

  async getById(payoutId: string, actor: SessionContext) {
    const payoutsRepo = new PayoutsRepository(this.db);
    const payout = await payoutsRepo.findById(payoutId);
    if (!payout) throw new NotFoundError('Payout', payoutId);

    if (actor.role === 'service_provider' && payout.providerId !== actor.providerId) {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }

    return payout;
  }

  async list(opts: {
    actor: SessionContext;
    providerId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const payoutsRepo = new PayoutsRepository(this.db);
    const providerId =
      opts.actor.role === 'service_provider' ? opts.actor.providerId ?? undefined : opts.providerId;

    if (providerId) {
      return payoutsRepo.findByProvider(
        providerId,
        opts.limit ?? 50,
        opts.offset ?? 0
      );
    }

    // Admin can see all — use findPendingPayouts as fallback for now
    return payoutsRepo.findPendingPayouts();
  }
}
