import { Hono } from 'hono';
import type { Env } from '../../bindings.js';
import { parseEnv } from '@felix-travel/config';

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
