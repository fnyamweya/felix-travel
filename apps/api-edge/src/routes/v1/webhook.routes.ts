/**
 * Webhook routes — /api/v1/webhooks
 *
 * Inbound callbacks from payment providers (Tingg).
 * These endpoints are NOT authenticated via JWT — they use HMAC signatures
 * and replay protection.
 *
 * POST   /tingg/payment      Tingg payment webhook callback
 * POST   /tingg/payout       Tingg payout webhook callback
 */
import { Hono } from 'hono';
import type { Env } from '../../bindings.js';
import { createDbClient } from '@felix-travel/db';
import { PaymentService } from '../../services/payment.service.js';
import { PayoutService } from '../../services/payout.service.js';
import { success } from '../../lib/response.js';
import { rateLimit } from '@felix-travel/auth';

type HonoEnv = { Bindings: Env };

export const webhookRoutes = new Hono<HonoEnv>();

function getPaymentService(c: { env: Env }) {
    return new PaymentService(createDbClient(c.env.DB), c.env);
}

function getPayoutService(c: { env: Env }) {
    return new PayoutService(createDbClient(c.env.DB), c.env);
}

webhookRoutes.post(
    '/tingg/payment',
    rateLimit({ limit: 200, windowSeconds: 60 }),
    async (c) => {
        const payload = await c.req.json<Record<string, unknown>>();
        const svc = getPaymentService(c);
        const result = await svc.processCheckoutWebhook(payload);
        return c.json(success(result));
    }
);

webhookRoutes.post(
    '/tingg/payout',
    rateLimit({ limit: 200, windowSeconds: 60 }),
    async (c) => {
        const payload = await c.req.json<Record<string, unknown>>();
        const svc = getPayoutService(c);
        const result = await svc.processPayoutWebhook(payload);
        return c.json(success(result));
    }
);
