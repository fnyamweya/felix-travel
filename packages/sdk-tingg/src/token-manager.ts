/**
 * Tingg OAuth2 Token Manager
 *
 * Tingg uses client_credentials OAuth2 tokens that expire after ~3600 seconds.
 * We cache the token in Cloudflare KV with a TTL slightly shorter than the
 * actual expiry (configurable via TINGG_TOKEN_CACHE_TTL_SECONDS) to avoid
 * using a near-expired token on an in-flight request.
 *
 * The cache key is scoped to the environment (sandbox vs production) so that
 * switching environments does not reuse stale tokens.
 */
import type { TinggConfig } from './types/config.js';

const TOKEN_CACHE_KEY_PREFIX = 'tingg_token';

interface CachedToken {
  accessToken: string;
  cachedAt: number;
  expiresIn: number;
}

export class TinggTokenManager {
  constructor(
    private readonly config: TinggConfig,
    private readonly tokenCacheKv: KVNamespace
  ) { }

  /** Get a valid access token, fetching a new one if the cache is empty or expired */
  async getAccessToken(correlationId: string): Promise<string> {
    const cacheKey = `${TOKEN_CACHE_KEY_PREFIX}:${this.config.environment}`;

    const cached = await this.tokenCacheKv.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as CachedToken;
      return parsed.accessToken;
    }

    // Cache miss — fetch a new token from Tingg
    const token = await this.fetchNewToken(correlationId);

    // Store with TTL from config (never the full expiry — leave margin)
    await this.tokenCacheKv.put(
      cacheKey,
      JSON.stringify({ accessToken: token, cachedAt: Date.now(), expiresIn: this.config.tokenCacheTtlSeconds }),
      { expirationTtl: this.config.tokenCacheTtlSeconds }
    );

    return token;
  }

  /** Force-refresh the token (call after 401 responses) */
  async refreshToken(correlationId: string): Promise<string> {
    const cacheKey = `${TOKEN_CACHE_KEY_PREFIX}:${this.config.environment}`;
    await this.tokenCacheKv.delete(cacheKey);
    return this.getAccessToken(correlationId);
  }

  private async fetchNewToken(correlationId: string): Promise<string> {
    const tokenUrl = `${this.config.baseUrl}/oauth/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.httpTimeoutMs);

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Correlation-ID': correlationId,
        },
        body: body.toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new TinggAuthError(`Tingg auth failed: ${response.status} ${text}`);
      }

      const data = await response.json() as { access_token?: string };
      if (!data.access_token) {
        throw new TinggAuthError('Tingg auth response missing access_token');
      }
      return data.access_token;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class TinggAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TinggAuthError';
  }
}
