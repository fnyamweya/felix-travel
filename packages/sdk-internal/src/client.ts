/**
 * Internal API client.
 *
 * Typed HTTP client for the felix-travel API edge worker.
 * Used by both customer and dashboard frontends.
 *
 * Token handling:
 * - Access token stored in memory (not localStorage) to prevent XSS theft
 * - Refresh token stored in httpOnly cookie (set by server)
 * - On 401, automatically attempts token refresh once before failing
 */
import type { ApiResponse, ApiErrorResponse, TokenPair } from '@felix-travel/types';

export interface ClientConfig {
  baseUrl: string;
  /** Called when session expires and refresh fails — use to redirect to login */
  onAuthFailure?: () => void;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class FelixApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<void> | null = null;

  constructor(private readonly config: ClientConfig) { }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  clearTokens(): void {
    this.accessToken = null;
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      idempotencyKey?: string;
      params?: Record<string, string | number | boolean | undefined>;
    } = {}
  ): Promise<T> {
    const url = new URL(`${this.config.baseUrl}${path}`);
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

    const response = await fetch(url.toString(), {
      method,
      headers,
      credentials: 'include', // sends httpOnly refresh token cookie
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    // Token expired — attempt refresh once
    if (response.status === 401 && this.accessToken) {
      if (!this.refreshPromise) {
        this.refreshPromise = this.performTokenRefresh().finally(() => {
          this.refreshPromise = null;
        });
      }
      await this.refreshPromise;
      // Retry original request with new token
      return this.request<T>(method, path, options);
    }

    const data = await response.json() as ApiResponse<T> | ApiErrorResponse;

    if (!data.success) {
      const err = (data as ApiErrorResponse).error;
      throw new ApiError(err.code, err.message, response.status, err.details);
    }

    return (data as ApiResponse<T>).data;
  }

  private async performTokenRefresh(): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Refresh failed');
      const data = await response.json() as ApiResponse<TokenPair>;
      if (data.success) {
        this.accessToken = data.data.accessToken;
      }
    } catch {
      this.accessToken = null;
      this.config.onAuthFailure?.();
    }
  }

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('GET', path, { params });
  }

  post<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    return this.request<T>('POST', path, { body, idempotencyKey });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, { body });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, { body });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}
