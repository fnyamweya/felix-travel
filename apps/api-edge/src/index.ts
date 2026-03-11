/**
 * API entry point — Cloudflare Workers Hono application.
 *
 * Mounts all v1 routes under /api/v1/ with global middleware chain:
 *   1. CORS
 *   2. Telemetry (correlation ID, request logging, error reporting)
 *   3. Rate limiting
 *   4. Route-level auth & permissions
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './bindings.js';
import type { SessionContext } from '@felix-travel/types';
import { telemetryMiddleware } from '@felix-travel/telemetry';
import { authRoutes } from './routes/v1/auth.routes.js';
import { bookingRoutes } from './routes/v1/booking.routes.js';
import { paymentRoutes } from './routes/v1/payment.routes.js';
import { payoutRoutes } from './routes/v1/payout.routes.js';
import { refundRoutes } from './routes/v1/refund.routes.js';
import { webhookRoutes } from './routes/v1/webhook.routes.js';
import { approvalRoutes } from './routes/v1/approval.routes.js';
import { identityRoutes } from './routes/v1/identity.routes.js';
import { adminRoutes } from './routes/v1/admin.routes.js';
import { healthRoute } from './routes/v1/health.routes.js';
import { chargeRoutes } from './routes/v1/charge.routes.js';
import { catalogRoutes } from './routes/v1/catalog.routes.js';
import { providerRoutes } from './routes/v1/provider.routes.js';
import { geographyRoutes } from './routes/v1/geography.routes.js';
import { errorHandler } from './middleware/error-handler.js';

type AppEnv = {
    Bindings: Env;
    Variables: {
        session: SessionContext;
    };
};

const app = new Hono<AppEnv>();

// ─── Global middleware ───────────────────────────────────────────
app.use('*', cors({
    origin: (origin) => origin, // reflect origin for credentialed requests
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Idempotency-Key', 'X-Correlation-Id'],
    exposeHeaders: ['X-Correlation-Id', 'X-Request-Id'],
    maxAge: 86400,
    credentials: true,
}));

app.use('*', telemetryMiddleware({ serviceName: 'felix-api-edge' }));

// ─── Error handler ───────────────────────────────────────────────
app.onError(errorHandler);

// ─── Health ──────────────────────────────────────────────────────
app.route('/api/v1/health', healthRoute);

// ─── V1 API routes ──────────────────────────────────────────────
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/identity', identityRoutes);
app.route('/api/v1/bookings', bookingRoutes);
app.route('/api/v1/payments', paymentRoutes);
app.route('/api/v1/payouts', payoutRoutes);
app.route('/api/v1/refunds', refundRoutes);
app.route('/api/v1/webhooks', webhookRoutes);
app.route('/api/v1/approvals', approvalRoutes);
app.route('/api/v1/admin', adminRoutes);
app.route('/api/v1/charges', chargeRoutes);
app.route('/api/v1/catalog', catalogRoutes);
app.route('/api/v1/providers', providerRoutes);
app.route('/api/v1/geography', geographyRoutes);

// ─── 404 fallthrough ────────────────────────────────────────────
app.notFound((c) =>
    c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }, 404)
);

// ─── Queue consumers ─────────────────────────────────────────────
import { handleNotificationBatch } from './jobs/notification.consumer.js';
import { handleWebhookBatch } from './jobs/webhook.consumer.js';
import { handleApprovalBatch } from './jobs/approval.consumer.js';
import { handleScheduled } from './jobs/scheduled.js';

export default {
    fetch: app.fetch,

    async queue(batch: MessageBatch<unknown>, env: Env) {
        switch (batch.queue) {
            case 'felix-travel-notifications':
                return handleNotificationBatch(batch as MessageBatch<any>, env);
            case 'felix-travel-outbound-webhooks':
                return handleWebhookBatch(batch as MessageBatch<any>, env);
            case 'felix-travel-approval':
                return handleApprovalBatch(batch as MessageBatch<any>, env);
            default:
                console.log(`Unhandled queue: ${batch.queue}`);
                for (const msg of batch.messages) msg.ack();
        }
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        ctx.waitUntil(handleScheduled(event, env));
    },
};
