/**
 * TinggClient — the main entry point for all Tingg API operations.
 *
 * Instantiate once per Worker request with the environment bindings.
 * The client composes all adapter sub-clients.
 *
 * Usage:
 *   const tingg = createTinggClient(config, env.TOKEN_CACHE_KV);
 *   const result = await tingg.checkout.initiateCheckout(payload, { correlationId });
 */
import type { TinggConfig } from './types/config.js';
import { TinggTokenManager } from './token-manager.js';
import { TinggHttpClient } from './http-client.js';
import { TinggCheckoutAdapter } from './collections/checkout.js';
import { TinggRefundAdapter } from './collections/refunds.js';
import { TinggOtpAdapter } from './collections/otp.js';
import { TinggLocalPayoutAdapter } from './payouts/local-payout.js';
import { TinggRemittanceAdapter } from './payouts/remittance.js';

export interface TinggClient {
  checkout: TinggCheckoutAdapter;
  refunds: TinggRefundAdapter;
  otp: TinggOtpAdapter;
  localPayout: TinggLocalPayoutAdapter;
  remittance: TinggRemittanceAdapter;
}

export function createTinggClient(
  config: TinggConfig,
  tokenCacheKv: KVNamespace
): TinggClient {
  const tokenManager = new TinggTokenManager(config, tokenCacheKv);
  const http = new TinggHttpClient(config, tokenManager);
  return {
    checkout: new TinggCheckoutAdapter(http),
    refunds: new TinggRefundAdapter(http),
    otp: new TinggOtpAdapter(http),
    localPayout: new TinggLocalPayoutAdapter(http, config),
    remittance: new TinggRemittanceAdapter(http),
  };
}

/** Build TinggConfig from validated environment variables */
export function tinggConfigFromEnv(env: {
  TINGG_ENVIRONMENT: string;
  TINGG_BASE_URL: string;
  TINGG_CLIENT_ID: string;
  TINGG_CLIENT_SECRET: string;
  TINGG_SERVICE_CODE: string;
  TINGG_PAYOUT_SERVICE_CODE: string;
  TINGG_COLLECTION_COUNTRY_CODE: string;
  TINGG_COLLECTION_CURRENCY_CODE: string;
  TINGG_CALLBACK_CHECKOUT_URL: string;
  TINGG_CALLBACK_PAYOUT_URL: string;
  TINGG_SUCCESS_REDIRECT_URL: string;
  TINGG_FAIL_REDIRECT_URL: string;
  TINGG_TOKEN_CACHE_TTL_SECONDS: string;
  TINGG_HTTP_TIMEOUT_MS: string;
  TINGG_MAX_RETRIES: string;
}): TinggConfig {
  return {
    environment: env.TINGG_ENVIRONMENT as 'sandbox' | 'production',
    baseUrl: env.TINGG_BASE_URL,
    clientId: env.TINGG_CLIENT_ID,
    clientSecret: env.TINGG_CLIENT_SECRET,
    serviceCode: env.TINGG_SERVICE_CODE,
    payoutServiceCode: env.TINGG_PAYOUT_SERVICE_CODE,
    collectionCountryCode: env.TINGG_COLLECTION_COUNTRY_CODE,
    collectionCurrencyCode: env.TINGG_COLLECTION_CURRENCY_CODE,
    callbackCheckoutUrl: env.TINGG_CALLBACK_CHECKOUT_URL,
    callbackPayoutUrl: env.TINGG_CALLBACK_PAYOUT_URL,
    successRedirectUrl: env.TINGG_SUCCESS_REDIRECT_URL,
    failRedirectUrl: env.TINGG_FAIL_REDIRECT_URL,
    tokenCacheTtlSeconds: parseInt(env.TINGG_TOKEN_CACHE_TTL_SECONDS, 10),
    httpTimeoutMs: parseInt(env.TINGG_HTTP_TIMEOUT_MS, 10),
    maxRetries: parseInt(env.TINGG_MAX_RETRIES, 10),
  };
}
