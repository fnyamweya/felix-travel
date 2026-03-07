/**
 * WebhookService — outbound callbacks to service providers.
 *
 * Each provider can subscribe to specific platform events via registered callback URLs.
 * When an event occurs, we:
 * 1. Find all active subscriptions for the event
 * 2. Create a WebhookDelivery record for each subscription
 * 3. Enqueue the delivery to OUTBOUND_WEBHOOK_QUEUE
 * 4. The queue consumer signs and delivers the payload with retry logic
 *
 * Signature format (in header X-Felix-Signature):
 *   HMAC-SHA256(secret, `${timestamp}.${body}`)
 * Header X-Felix-Timestamp: Unix timestamp when signature was computed
 *
 * Providers verify by recomputing HMAC with their shared secret.
 */
import { ProvidersRepository, WebhooksRepository, createDbClient } from '@felix-travel/db';
import type { Env } from '../bindings.js';
import type { ProviderWebhookEvent } from '@felix-travel/types';
import { signWebhookPayload } from '@felix-travel/auth';
import { parseEnv } from '@felix-travel/config';
import { newId } from '../lib/id.js';
import { NotFoundError } from '../lib/errors.js';

export class WebhookService {
  private readonly providersRepo: ProvidersRepository;
  private readonly webhooksRepo: WebhooksRepository;
  private readonly env: ReturnType<typeof parseEnv>;

  constructor(db: D1Database, workerEnv: Env) {
    const client = createDbClient(db);
    this.providersRepo = new ProvidersRepository(client);
    this.webhooksRepo = new WebhooksRepository(client);
    this.env = parseEnv(workerEnv as unknown as Record<string, string>);
  }

  /** Dispatch an event to all matching provider subscriptions */
  async dispatchEvent(
    event: ProviderWebhookEvent,
    payload: Record<string, unknown>,
    outboundQueue: Queue
  ): Promise<void> {
    if (!this.env.FEATURE_ENABLE_PROVIDER_CALLBACKS) return;

    const subscriptions = await this.providersRepo.findActiveSubscriptionsForEvent(event);

    for (const sub of subscriptions) {
      const deliveryId = newId();
      const payloadWithMeta = {
        id: deliveryId,
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      };

      await this.webhooksRepo.createDelivery({
        id: deliveryId,
        subscriptionId: sub.id,
        event,
        payload: JSON.stringify(payloadWithMeta),
        status: 'pending',
        nextRetryAt: new Date().toISOString(),
      });

      // Enqueue for async delivery — prevents blocking the main request thread
      await outboundQueue.send({
        deliveryId,
        subscriptionId: sub.id,
        attempt: 1,
      });
    }
  }

  /** Deliver a single webhook with signature. Called by queue consumer. */
  async deliverWebhook(deliveryId: string): Promise<void> {
    const delivery = await this.webhooksRepo.findDeliveryById(deliveryId);
    if (!delivery) throw new Error(`Delivery ${deliveryId} not found`);

    const sub = await this.providersRepo.findCallbackSubscriptionById(delivery.subscriptionId);
    if (!sub || !sub.isActive) {
      await this.webhooksRepo.updateDelivery(deliveryId, { status: 'failed', errorMessage: 'Subscription inactive' });
      return;
    }

    const body = delivery.payload;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signWebhookPayload(sub.secretHash, timestamp, body, 'SHA-256');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), sub.timeoutMs);

    try {
      const response = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Felix-Signature': `sha256=${signature}`,
          'X-Felix-Timestamp': String(timestamp),
          'X-Felix-Delivery-ID': deliveryId,
          'X-Felix-Event': delivery.event,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const responseBody = await response.text().catch(() => '');
      const isSuccess = response.status >= 200 && response.status < 300;

      await this.webhooksRepo.updateDelivery(deliveryId, {
        status: isSuccess ? 'delivered' : 'failed',
        attempts: delivery.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
        responseStatus: response.status,
        responseBody: responseBody.slice(0, 500),
        errorMessage: isSuccess ? null : `HTTP ${response.status}`,
        // Schedule retry with exponential backoff if failed and retries remain
        nextRetryAt: (!isSuccess && delivery.attempts + 1 < sub.maxRetries)
          ? new Date(Date.now() + Math.min(1000 * Math.pow(2, delivery.attempts), 3600000)).toISOString()
          : null,
      });

      if (!isSuccess && delivery.attempts + 1 < sub.maxRetries) {
        await this.webhooksRepo.updateDelivery(deliveryId, { status: 'retrying' });
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const attempts = delivery.attempts + 1;
      await this.webhooksRepo.updateDelivery(deliveryId, {
        status: attempts < sub.maxRetries ? 'retrying' : 'failed',
        attempts,
        lastAttemptAt: new Date().toISOString(),
        errorMessage: err instanceof Error ? err.message : String(err),
        nextRetryAt: attempts < sub.maxRetries
          ? new Date(Date.now() + Math.min(1000 * Math.pow(2, attempts), 3600000)).toISOString()
          : null,
      });
    }
  }

  async redeliverWebhook(deliveryId: string) {
    const delivery = await this.webhooksRepo.findDeliveryById(deliveryId);
    if (!delivery) throw new NotFoundError('WebhookDelivery', deliveryId);
    // Reset for redelivery
    await this.webhooksRepo.updateDelivery(deliveryId, {
      status: 'pending',
      nextRetryAt: new Date().toISOString(),
    });
    return delivery;
  }
}
