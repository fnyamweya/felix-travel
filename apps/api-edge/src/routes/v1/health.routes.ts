import { Hono } from 'hono';
import type { Env } from '../../bindings.js';

type HonoEnv = { Bindings: Env };

export const healthRoute = new Hono<HonoEnv>();

healthRoute.get('/', async (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});
