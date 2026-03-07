/**
 * Outbound webhook queue consumer — delivers provider callback webhooks.
 *
 * Each message contains a deliveryId and subscriptionId. The consumer
 * delegates to WebhookService.deliverWebhook() which handles signing,
 * delivery, retries, and status tracking.
 */
import type { Env } from '../bindings.js';
import { WebhookService } from '../services/webhook.service.js';

interface WebhookMessage {
    deliveryId: string;
    subscriptionId: string;
    attempt: number;
}

export async function handleWebhookBatch(
    batch: MessageBatch<WebhookMessage>,
    env: Env,
): Promise<void> {
    const svc = new WebhookService(env.DB, env);

    for (const msg of batch.messages) {
        try {
            await svc.deliverWebhook(msg.body.deliveryId);
            msg.ack();
        } catch (err) {
            console.error(`Webhook delivery failed for ${msg.body.deliveryId}:`, err);
            msg.retry();
        }
    }
}
