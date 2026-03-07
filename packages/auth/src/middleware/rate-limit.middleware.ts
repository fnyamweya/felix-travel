/**
 * Rate limiting middleware using Cloudflare KV.
 *
 * Uses a sliding window counter. The key is the rate limit scope
 * (e.g. IP address or user ID) combined with the endpoint type.
 *
 * KV is eventually consistent so brief bursts slightly above the limit
 * are possible — this is acceptable for soft rate limits. For hard
 * financial rate limits, use idempotency keys additionally.
 */
import type { Context, Next } from 'hono';

interface RateLimitOptions {
  /** Maximum requests in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** How to key the rate limit — defaults to IP */
  keyFn?: (c: Context) => string;
}

export function rateLimit(opts: RateLimitOptions) {
  return async (c: Context, next: Next) => {
    const rateLimitKv = (c.env as { RATE_LIMIT_KV: KVNamespace }).RATE_LIMIT_KV;
    if (!rateLimitKv) {
      // If KV is not wired in the context, skip rate limiting (e.g., unit tests)
      await next();
      return;
    }
    const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
    const key = opts.keyFn ? opts.keyFn(c) : `rl:${c.req.path}:${ip}`;
    const existing = await rateLimitKv.get(key);
    const count = existing ? parseInt(existing, 10) : 0;
    if (count >= opts.limit) {
      return c.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
        429
      );
    }
    await rateLimitKv.put(key, String(count + 1), { expirationTtl: opts.windowSeconds });
    await next();
  };
}
