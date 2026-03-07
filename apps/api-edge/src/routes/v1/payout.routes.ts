/**
 * Payout routes — /api/v1/payouts
 *
 * POST   /                    Run a payout batch for a provider
 * GET    /:payoutId           Get payout status
 * POST   /:payoutId/dispatch  Dispatch an approved payout
 *
 * Payouts above the approval threshold require maker-checker workflow.
 * All endpoints require Idempotency-Key header.
 */
import { Hono } from 'hono';
import type { Env } from '../../bindings.js';
import type { SessionContext } from '@felix-travel/types';
import { requireAuth, idempotency, authorize } from '@felix-travel/auth';
import { hydratePermissions } from '@felix-travel/auth';
import { createDbClient } from '@felix-travel/db';
import { PayoutService } from '../../services/payout.service.js';
import { success } from '../../lib/response.js';
import { ValidationError } from '../../lib/errors.js';
import { runPayoutSchema } from '@felix-travel/validation';

type HonoEnv = {
    Bindings: Env;
    Variables: { session: SessionContext };
};

export const payoutRoutes = new Hono<HonoEnv>();

const getDb = (env: unknown) => createDbClient((env as Env).DB);

payoutRoutes.use('*', requireAuth);
payoutRoutes.use('*', hydratePermissions(getDb));

function getPayoutService(c: { env: Env }) {
    return new PayoutService(createDbClient(c.env.DB), c.env);
}

payoutRoutes.post(
    '/',
    idempotency(),
    async (c) => {
        const session = c.get('session');
        authorize(session, 'payout:run');
        const body = await c.req.json();
        const parsed = runPayoutSchema.safeParse(body);
        if (!parsed.success) {
            throw new ValidationError('Invalid input', { issues: parsed.error.flatten().fieldErrors });
        }
        // Provider must only trigger payouts for their own account
        if (session.role === 'service_provider' && parsed.data.providerId !== session.userId) {
            throw new ValidationError('Forbidden: cannot run payout for another provider');
        }
        const svc = getPayoutService(c);
        const payout = await svc.runPayout(parsed.data.providerId, session, {
            idempotencyKey: parsed.data.idempotencyKey,
            currency: 'KES',
        });
        return c.json(success(payout), 201);
    }
);

payoutRoutes.get('/:payoutId', async (c) => {
    const session = c.get('session');
    authorize(session, 'payout:view:own');
    const payoutId = c.req.param('payoutId')!;
    const svc = getPayoutService(c);
    const payout = await svc.getById(payoutId, session);
    return c.json(success(payout));
});

payoutRoutes.post(
    '/:payoutId/dispatch',
    idempotency(),
    async (c) => {
        const session = c.get('session');
        authorize(session, 'payout:approve');
        const payoutId = c.req.param('payoutId')!;
        const svc = getPayoutService(c);
        const payout = await svc.dispatchPayout(payoutId, session);
        return c.json(success(payout));
    }
);
