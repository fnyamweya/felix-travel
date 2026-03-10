/**
 * Payment routes — /api/v1/payments
 *
 * POST   /checkout           Initiate Tingg checkout for a booking
 * GET    /:paymentId         Get payment status
 * POST   /:paymentId/charge  Initiate STK push / direct charge
 *
 * All financial endpoints require Idempotency-Key header.
 */
import { Hono } from 'hono';
import type { Env } from '../../bindings.js';
import type { SessionContext } from '@felix-travel/types';
import { requireAuth, idempotency, rateLimit } from '@felix-travel/auth';
import { hydratePermissions } from '@felix-travel/auth';
import { createDbClient } from '@felix-travel/db';
import { PaymentService } from '../../services/payment.service.js';
import { success } from '../../lib/response.js';
import { ValidationError } from '../../lib/errors.js';
import { initiateCheckoutSchema, initiateSplitCheckoutSchema } from '@felix-travel/validation';

type HonoEnv = {
    Bindings: Env;
    Variables: { session: SessionContext };
};

export const paymentRoutes = new Hono<HonoEnv>();

const getDb = (env: unknown) => createDbClient((env as Env).DB);

paymentRoutes.use('*', requireAuth);
paymentRoutes.use('*', hydratePermissions(getDb));

function getPaymentService(c: { env: Env }) {
    return new PaymentService(createDbClient(c.env.DB), c.env);
}

paymentRoutes.post(
    '/checkout',
    idempotency(),
    rateLimit({ limit: 10, windowSeconds: 60 }),
    async (c) => {
        const session = c.get('session');
        const body = await c.req.json();
        const parsed = initiateCheckoutSchema.safeParse(body);
        if (!parsed.success) {
            throw new ValidationError('Invalid input', { issues: parsed.error.flatten().fieldErrors });
        }
        const svc = getPaymentService(c);
        const result = await svc.initiateCheckout(parsed.data.bookingId, session, {
            accountNumber: parsed.data.MSISDN ?? '',
            ...(parsed.data.paymentOptionCode !== undefined && { paymentOption: parsed.data.paymentOptionCode }),
            ...(parsed.data.MSISDN !== undefined && { MSISDN: parsed.data.MSISDN }),
        });
        return c.json(success(result), 201);
    }
);

paymentRoutes.get('/:paymentId', async (c) => {
    const session = c.get('session');
    const paymentId = c.req.param('paymentId');
    const svc = getPaymentService(c);
    const payment = await svc.getPaymentStatus(paymentId, session);
    return c.json(success(payment));
});

paymentRoutes.post(
    '/checkout/split',
    idempotency(),
    rateLimit({ limit: 10, windowSeconds: 60 }),
    async (c) => {
        const session = c.get('session');
        const body = await c.req.json();
        const parsed = initiateSplitCheckoutSchema.safeParse(body);
        if (!parsed.success) {
            throw new ValidationError('Invalid input', { issues: parsed.error.flatten().fieldErrors });
        }
        const svc = getPaymentService(c);
        const result = await svc.initiateSplitCheckout(parsed.data.bookingId, session, parsed.data.splits);
        return c.json(success(result), 201);
    }
);
