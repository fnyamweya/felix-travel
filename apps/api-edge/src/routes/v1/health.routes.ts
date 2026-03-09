import { Hono } from 'hono';
import type { Env } from '../../bindings.js';
import { parseEnv } from '@felix-travel/config';
import { hashPassword } from '@felix-travel/auth';
import { createDbClient } from '@felix-travel/db';
import { users } from '@felix-travel/db';
import { eq } from 'drizzle-orm';

type HonoEnv = { Bindings: Env };

export const healthRoute = new Hono<HonoEnv>();

healthRoute.get('/', async (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

healthRoute.get('/deep', async (c) => {
    const checks: Record<string, { ok: boolean; error?: string }> = {};

    // Check env parsing
    try {
        parseEnv(c.env as unknown as Record<string, string>);
        checks.env = { ok: true };
    } catch (e: any) {
        checks.env = { ok: false, error: e.message?.slice(0, 500) };
    }

    // Check D1 database
    try {
        const result = await c.env.DB.prepare('SELECT 1 AS ok').first();
        checks.d1 = { ok: !!result };
    } catch (e: any) {
        checks.d1 = { ok: false, error: e.message?.slice(0, 300) };
    }

    // Check bindings
    const missingBindings = [
        !c.env.DB && 'DB',
        !c.env.RATE_LIMIT_KV && 'RATE_LIMIT_KV',
        !c.env.CACHE_KV && 'CACHE_KV',
    ].filter(Boolean).join(', ');
    checks.bindings = missingBindings
        ? { ok: false, error: missingBindings }
        : { ok: true };

    const allOk = Object.values(checks).every((ch) => ch.ok);
    return c.json({ status: allOk ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() }, allOk ? 200 : 503);
});

/**
 * POST /api/v1/health/bootstrap
 *
 * One-time admin bootstrap: sets the password for the system admin user
 * (usr_admin_001 / system@felix.co.ke) which was created by migrations
 * without a password hash.
 *
 * Requires the ADMIN_BOOTSTRAP_SECRET env var to be set.
 * Only works when the admin user has no password hash (first-time setup).
 */
healthRoute.post('/bootstrap', async (c) => {
    const secret = c.env.ADMIN_BOOTSTRAP_SECRET;
    if (!secret) {
        return c.json({ success: false, error: 'Bootstrap not configured' }, 404);
    }

    const body = await c.req.json<{ secret: string; email: string; password: string }>();

    // Constant-time comparison to prevent timing attacks
    const encoder = new TextEncoder();
    const a = encoder.encode(body.secret ?? '');
    const b = encoder.encode(secret);
    if (a.byteLength !== b.byteLength || !crypto.subtle.timingSafeEqual(a, b)) {
        return c.json({ success: false, error: 'Invalid bootstrap secret' }, 403);
    }

    if (!body.password || body.password.length < 12) {
        return c.json({ success: false, error: 'Password must be at least 12 characters' }, 400);
    }

    const db = createDbClient(c.env.DB);
    const adminUser = await db.query.users.findFirst({
        where: eq(users.id, 'usr_admin_001'),
    });

    if (!adminUser) {
        return c.json({ success: false, error: 'System admin user not found in database' }, 404);
    }

    if (adminUser.passwordHash) {
        return c.json({ success: false, error: 'Admin password already set — bootstrap disabled' }, 409);
    }

    const passwordHash = await hashPassword(body.password);

    await db.update(users).set({
        passwordHash,
        email: body.email || adminUser.email,
        emailVerified: true,
    }).where(eq(users.id, 'usr_admin_001'));

    return c.json({
        success: true,
        message: 'Admin account bootstrapped successfully',
        email: body.email || adminUser.email,
    });
});
