/**
 * Identity routes — /api/v1/identity
 *
 * Manage user identities (email, phone), trusted devices, and verified contacts.
 * All endpoints require authentication.
 *
 * POST   /emails              Add an email identity
 * POST   /phones              Add a phone identity
 * POST   /verify/send         Send verification challenge
 * POST   /verify/confirm      Confirm a verification challenge
 * GET    /                    List current user's identities
 * DELETE /:identityId         Remove an identity
 * GET    /devices             List trusted devices
 * POST   /devices/trust       Register or update a trusted device
 * DELETE /devices/:deviceId   Revoke a trusted device
 * DELETE /devices             Revoke all trusted devices
 */
import { Hono } from 'hono';
import type { Env } from '../../bindings.js';
import type { SessionContext } from '@felix-travel/types';
import { requireAuth } from '@felix-travel/auth';
import { createDbClient } from '@felix-travel/db';
import { success } from '../../lib/response.js';
import { ValidationError } from '../../lib/errors.js';
import { newId } from '../../lib/id.js';

type HonoEnv = {
    Bindings: Env;
    Variables: { session: SessionContext };
};

export const identityRoutes = new Hono<HonoEnv>();

identityRoutes.use('*', requireAuth);

// ─── Identities ──────────────────────────────────────────────────

identityRoutes.post('/emails', async (c) => {
    const session = c.get('session');
    const { email } = await c.req.json<{ email: string }>();
    if (!email) throw new ValidationError('email is required');
    const { createIdentityService } = await import('@felix-travel/identity');
    const svc = createIdentityService({
        db: createDbClient(c.env.DB) as any,
        logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } } as any,
        generateId: () => newId(),
    });
    const identity = await svc.addEmail(session.userId, email, false);
    return c.json(success(identity), 201);
});

identityRoutes.post('/phones', async (c) => {
    const session = c.get('session');
    const { phone } = await c.req.json<{ phone: string; countryCode?: string }>();
    if (!phone) throw new ValidationError('phone is required');
    const { createIdentityService } = await import('@felix-travel/identity');
    const svc = createIdentityService({
        db: createDbClient(c.env.DB) as any,
        logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } } as any,
        generateId: () => newId(),
    });
    const identity = await svc.addPhone(session.userId, phone, false);
    return c.json(success(identity), 201);
});

identityRoutes.post('/verify/send', async (c) => {
    const session = c.get('session');
    const { identityId } = await c.req.json<{ identityId: string }>();
    if (!identityId) throw new ValidationError('identityId is required');
    const { createIdentityService } = await import('@felix-travel/identity');

    const { createEngageSmsClient } = await import('@felix-travel/sdk-tingg/engage');
    const smsClient = createEngageSmsClient({
        username: c.env.TINGG_ENGAGE_USERNAME,
        password: c.env.TINGG_ENGAGE_PASSWORD,
        senderId: c.env.TINGG_ENGAGE_SENDER_ID,
        baseUrl: c.env.TINGG_ENGAGE_BASE_URL,
    });

    const svc = createIdentityService({
        db: createDbClient(c.env.DB) as any,
        logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } } as any,
        generateId: () => newId(),
        sendSms: async (phone: string, message: string) => {
            await smsClient.sendSms(phone, message);
        },
        sendEmail: async (_email: string, _subject: string, body: string) => {
            await c.env.NOTIFICATION_QUEUE.send({ type: 'phone_verify_otp', to: _email, code: body });
        },
    });

    await svc.sendVerification(session.userId, identityId, 'phone_verify');
    return c.json(success({ sent: true }));
});

identityRoutes.post('/verify/confirm', async (c) => {
    const session = c.get('session');
    const { identityId, code } = await c.req.json<{ identityId: string; code: string }>();
    if (!identityId || !code) throw new ValidationError('identityId and code are required');
    const { createIdentityService } = await import('@felix-travel/identity');
    const svc = createIdentityService({
        db: createDbClient(c.env.DB) as any,
        logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } } as any,
        generateId: () => newId(),
    });
    const result = await svc.verifyChallenge(session.userId, 'phone_verify', code);
    return c.json(success(result));
});

identityRoutes.get('/', async (c) => {
    const session = c.get('session');
    const { createIdentityService } = await import('@felix-travel/identity');
    const svc = createIdentityService({
        db: createDbClient(c.env.DB) as any,
        logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } } as any,
        generateId: () => newId(),
    });
    const identities = await svc.getIdentities(session.userId);
    return c.json(success(identities));
});

identityRoutes.delete('/:identityId', async (c) => {
    const session = c.get('session');
    const identityId = c.req.param('identityId');
    const { createIdentityService } = await import('@felix-travel/identity');
    const svc = createIdentityService({
        db: createDbClient(c.env.DB) as any,
        logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } } as any,
        generateId: () => newId(),
    });
    await svc.removeIdentity(session.userId, identityId);
    return c.json(success({ removed: true }));
});

// ─── Trusted devices ─────────────────────────────────────────────

identityRoutes.get('/devices', async (c) => {
    const session = c.get('session');
    const { createTrustedDeviceService } = await import('@felix-travel/identity');
    const svc = createTrustedDeviceService({
        db: createDbClient(c.env.DB) as any,
        logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } } as any,
        generateId: () => newId(),
    });
    const devices = await svc.listDevices(session.userId);
    return c.json(success(devices));
});

identityRoutes.post('/devices/trust', async (c) => {
    const session = c.get('session');
    const body = await c.req.json<{ fingerprintHash: string; label?: string; ipAddress?: string; userAgent?: string }>();
    if (!body.fingerprintHash) throw new ValidationError('fingerprintHash is required');
    const { createTrustedDeviceService } = await import('@felix-travel/identity');
    const svc = createTrustedDeviceService({
        db: createDbClient(c.env.DB) as any,
        logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } } as any,
        generateId: () => newId(),
    });
    const device = await svc.trust(session.userId, body.fingerprintHash, body.label ?? '');
    return c.json(success(device), 201);
});

identityRoutes.delete('/devices/:deviceId', async (c) => {
    const session = c.get('session');
    const deviceId = c.req.param('deviceId');
    const { createTrustedDeviceService } = await import('@felix-travel/identity');
    const svc = createTrustedDeviceService({
        db: createDbClient(c.env.DB) as any,
        logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } } as any,
        generateId: () => newId(),
    });
    await svc.revoke(session.userId, deviceId);
    return c.json(success({ revoked: true }));
});

identityRoutes.delete('/devices', async (c) => {
    const session = c.get('session');
    const { createTrustedDeviceService } = await import('@felix-travel/identity');
    const svc = createTrustedDeviceService({
        db: createDbClient(c.env.DB) as any,
        logger: { info: () => { }, warn: () => { }, error: () => { }, debug: () => { } } as any,
        generateId: () => newId(),
    });
    await svc.revokeAll(session.userId);
    return c.json(success({ revokedAll: true }));
});
