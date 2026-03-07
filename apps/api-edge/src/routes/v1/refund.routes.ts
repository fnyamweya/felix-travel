/**
 * Refund routes — /api/v1/refunds
 *
 * POST   /                  Request a refund
 * POST   /:refundId/approve Approve a pending refund (admin)
 * GET    /:refundId         Get refund details
 *
 * All financial endpoints require Idempotency-Key header.
 */
import { Hono } from 'hono';
import type { Env } from '../../bindings.js';
import type { SessionContext } from '@felix-travel/types';
import { requireAuth, idempotency, authorize } from '@felix-travel/auth';
import { hydratePermissions } from '@felix-travel/auth';
import { createDbClient } from '@felix-travel/db';
import { RefundService } from '../../services/refund.service.js';
import { success } from '../../lib/response.js';
import { ValidationError } from '../../lib/errors.js';
import { initiateRefundSchema } from '@felix-travel/validation';

type HonoEnv = {
    Bindings: Env;
    Variables: { session: SessionContext };
};

export const refundRoutes = new Hono<HonoEnv>();

const getDb = (env: unknown) => createDbClient((env as Env).DB);

refundRoutes.use('*', requireAuth);
refundRoutes.use('*', hydratePermissions(getDb));

function getRefundService(c: { env: Env }) {
    return new RefundService(c.env.DB, c.env);
}

refundRoutes.post(
    '/',
    idempotency(),
    async (c) => {
        const session = c.get('session');
        authorize(session, 'payment:refund:request');
        const body = await c.req.json();
        const parsed = initiateRefundSchema.safeParse(body);
        if (!parsed.success) {
            throw new ValidationError('Invalid input', { issues: parsed.error.flatten().fieldErrors });
        }
        const svc = getRefundService(c);
        const refund = await svc.requestRefund({
            paymentId: parsed.data.paymentId,
            amount: parsed.data.amount,
            reason: parsed.data.reason,
            idempotencyKey: parsed.data.idempotencyKey,
            ...(parsed.data.items !== undefined && { items: parsed.data.items }),
        }, session);
        return c.json(success(refund), 201);
    }
);

refundRoutes.post(
    '/:refundId/approve',
    idempotency(),
    async (c) => {
        const session = c.get('session');
        authorize(session, 'payment:refund:approve');
        const refundId = c.req.param('refundId')!;
        const svc = getRefundService(c);
        const refund = await svc.approveRefund(refundId, session);
        return c.json(success(refund));
    }
);
