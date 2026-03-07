export interface TinggConfig {
  environment: 'sandbox' | 'production';
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  serviceCode: string;
  payoutServiceCode: string;
  collectionCountryCode: string;
  collectionCurrencyCode: string;
  callbackCheckoutUrl: string;
  callbackPayoutUrl: string;
  successRedirectUrl: string;
  failRedirectUrl: string;
  tokenCacheTtlSeconds: number;
  httpTimeoutMs: number;
  maxRetries: number;
}

export interface TinggRequestOptions {
  /** Correlation ID for tracing across logs */
  correlationId: string;
  /** Override default timeout */
  timeoutMs?: number;
  /** Override default max retries */
  maxRetries?: number;
}
