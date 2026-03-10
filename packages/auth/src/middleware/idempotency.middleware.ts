/**
 * Idempotency middleware for financial operations.
 *
 * Clients MUST send an Idempotency-Key header on all financial endpoints.
 * The first successful response is cached in KV and replayed on duplicate requests.
 *
 * Key design decisions:
 * - Cache window is configurable (default 24h)
 * - Cached responses are returned with a X-Idempotency-Replay: true header
 * - In-flight requests use a lock key to prevent concurrent duplicates
 * - The response body must be serializable (all financial API responses are JSON)
 */
import type { Context, Next } from 'hono';

const LOCK_TTL_SECONDS = 60;

interface CachedResponse {
  status: number;
  body: unknown;
  cachedAt: string;
}

export function idempotency(ttlSeconds = 86400) {
  return async (c: Context, next: Next) => {
    const idempotencyKv = (c.env as { IDEMPOTENCY_KV: KVNamespace }).IDEMPOTENCY_KV;
    const key = c.req.header('Idempotency-Key');
    if (!key) {
      return c.json(
        { success: false, error: { code: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key header is required for this operation' } },
        400
      );
    }
    const cacheKey = `idem:${c.req.path}:${key}`;
    const lockKey = `idem_lock:${c.req.path}:${key}`;

    // Check for cached response from a previous identical request
    const cached = await idempotencyKv.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as CachedResponse;
      c.header('X-Idempotency-Replay', 'true');
      return c.json(parsed.body, parsed.status as Parameters<typeof c.json>[1]);
    }

    // Acquire lock to prevent concurrent duplicate submissions
    const lockAcquired = await idempotencyKv.get(lockKey);
    if (lockAcquired) {
      return c.json(
        { success: false, error: { code: 'CONCURRENT_REQUEST', message: 'A request with this idempotency key is already processing' } },
        409
      );
    }
    await idempotencyKv.put(lockKey, '1', { expirationTtl: LOCK_TTL_SECONDS });

    try {
      await next();
      // Only cache 2xx responses — do not cache 4xx/5xx
      const status = c.res.status;
      if (status >= 200 && status < 300) {
        const body = await c.res.clone().json();
        const toCache: CachedResponse = { status, body, cachedAt: new Date().toISOString() };
        await idempotencyKv.put(cacheKey, JSON.stringify(toCache), { expirationTtl: ttlSeconds });
      }
    } finally {
      // Always release lock regardless of outcome
      await idempotencyKv.delete(lockKey);
    }
  };
}
