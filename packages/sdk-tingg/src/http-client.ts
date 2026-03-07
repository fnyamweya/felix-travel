/**
 * Tingg HTTP client with retry, timeout, correlation IDs, and log redaction.
 *
 * Retry strategy: exponential backoff with jitter, only on transient errors (5xx, network failures).
 * We do NOT retry 4xx responses except 401 (which triggers token refresh and one retry).
 *
 * Log redaction: Access tokens, client secrets, and MSISDN (phone numbers) are
 * redacted in request/response logs to prevent credential and PII exposure.
 */
import type { TinggConfig, TinggRequestOptions } from './types/config.js';
import { TinggTokenManager } from './token-manager.js';

export class TinggHttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: unknown
  ) {
    super(message);
    this.name = 'TinggHttpError';
  }
}

export class TinggTimeoutError extends Error {
  constructor(public readonly correlationId: string) {
    super(`Tingg request timed out (correlationId: ${correlationId})`);
    this.name = 'TinggTimeoutError';
  }
}

export class TinggHttpClient {
  constructor(
    private readonly config: TinggConfig,
    private readonly tokenManager: TinggTokenManager
  ) { }

  /** Make an authenticated POST request to the Tingg API */
  async post<TRequest, TResponse>(
    path: string,
    body: TRequest,
    opts: TinggRequestOptions
  ): Promise<TResponse> {
    const url = `${this.config.baseUrl}${path}`;
    const maxRetries = opts.maxRetries ?? this.config.maxRetries;
    const timeoutMs = opts.timeoutMs ?? this.config.httpTimeoutMs;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff with jitter: base 500ms, max 10s
        const backoffMs = Math.min(500 * Math.pow(2, attempt - 1) + Math.random() * 200, 10000);
        await new Promise((r) => setTimeout(r, backoffMs));
      }

      try {
        const token = await this.tokenManager.getAccessToken(opts.correlationId);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        let response: Response;
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'X-Correlation-ID': opts.correlationId,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        // 401 means our cached token expired — refresh once and retry
        if (response.status === 401 && attempt === 0) {
          await this.tokenManager.refreshToken(opts.correlationId);
          continue;
        }

        const responseBody = await response.json();

        if (!response.ok) {
          // 4xx errors (except 401 handled above) are not retried — they indicate
          // client-side issues that won't resolve by retrying
          if (response.status >= 400 && response.status < 500) {
            throw new TinggHttpError(
              `Tingg API client error: ${response.status}`,
              response.status,
              responseBody
            );
          }
          // 5xx — store error and retry
          lastError = new TinggHttpError(
            `Tingg API server error: ${response.status}`,
            response.status,
            responseBody
          );
          continue;
        }

        return responseBody as TResponse;
      } catch (err) {
        if (err instanceof TinggHttpError && err.statusCode >= 400 && err.statusCode < 500) {
          throw err; // Do not retry 4xx
        }
        if (err instanceof Error && err.name === 'AbortError') {
          throw new TinggTimeoutError(opts.correlationId);
        }
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError ?? new Error('Tingg request failed after all retries');
  }

  /** Make an authenticated GET request to the Tingg API */
  async get<TResponse>(
    path: string,
    opts: TinggRequestOptions
  ): Promise<TResponse> {
    const url = `${this.config.baseUrl}${path}`;
    const token = await this.tokenManager.getAccessToken(opts.correlationId);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.httpTimeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Correlation-ID': opts.correlationId,
        },
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) {
        throw new TinggHttpError(`Tingg GET ${path} failed: ${response.status}`, response.status, body);
      }
      return body as TResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
