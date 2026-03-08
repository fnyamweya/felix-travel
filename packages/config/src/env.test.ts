import { describe, it, expect } from 'vitest';
import { parseEnv } from './env.js';

/** Minimal valid environment for all required (non-defaulted) fields */
const baseEnv: Record<string, string> = {
  APP_ENV: 'test',
  APP_NAME: 'Felix Travel Test',
  APP_BASE_URL: 'http://localhost:8787',
  CUSTOMER_APP_URL: 'http://localhost:3000',
  DASHBOARD_APP_URL: 'http://localhost:3001',
  API_BASE_URL: 'http://localhost:8787',
  JWT_ISSUER: 'http://localhost:8787',
  JWT_AUDIENCE: 'test',
  JWT_PRIVATE_KEY: 'a'.repeat(100),
  JWT_PUBLIC_KEY: 'a'.repeat(100),
  INTERNAL_EVENT_SIGNING_SECRET: 'a'.repeat(32),
  CSRF_SECRET: 'a'.repeat(32),
  ENCRYPTION_KEY: 'a'.repeat(32),
  EMAIL_FROM: 'test@example.com',
  TINGG_ENVIRONMENT: 'sandbox',
  TINGG_BASE_URL: 'https://api.tingg.africa/v3',
  TINGG_CLIENT_ID: 'test_client_id',
  TINGG_CLIENT_SECRET: 'test_client_secret',
  TINGG_SERVICE_CODE: 'TEST_SVC',
  TINGG_PAYOUT_SERVICE_CODE: 'TEST_PAYOUT',
  TINGG_COLLECTION_COUNTRY_CODE: 'KE',
  TINGG_COLLECTION_CURRENCY_CODE: 'KES',
  TINGG_CALLBACK_CHECKOUT_URL: 'https://api.test.com/webhooks/tingg/checkout',
  TINGG_CALLBACK_PAYOUT_URL: 'https://api.test.com/webhooks/tingg/payout',
  TINGG_SUCCESS_REDIRECT_URL: 'https://test.com/payment/success',
  TINGG_FAIL_REDIRECT_URL: 'https://test.com/payment/failed',
  TINGG_ENGAGE_USERNAME: 'test_engage_user',
  TINGG_ENGAGE_PASSWORD: 'test_engage_pass',
  R2_PUBLIC_BASE_URL: 'https://media.test.com',
};

describe('parseEnv', () => {
  it('parses a valid environment without errors', () => {
    const env = parseEnv(baseEnv);
    expect(env.APP_ENV).toBe('test');
    expect(env.DEFAULT_CURRENCY).toBe('KES'); // default applied
    expect(env.PASSWORD_HASH_COST).toBe(12); // coerced to number
    expect(env.FEATURE_ENABLE_PROVIDER_CALLBACKS).toBe(true); // coerced boolean
  });

  it('throws when APP_ENV is invalid', () => {
    expect(() => parseEnv({ ...baseEnv, APP_ENV: 'local' })).toThrow(
      'Invalid environment configuration'
    );
  });

  it('throws when JWT_PRIVATE_KEY is too short', () => {
    expect(() => parseEnv({ ...baseEnv, JWT_PRIVATE_KEY: 'tooshort' })).toThrow(
      'Invalid environment configuration'
    );
  });

  it('throws when TINGG_TOKEN_CACHE_TTL_SECONDS exceeds 3599', () => {
    expect(() =>
      parseEnv({ ...baseEnv, TINGG_TOKEN_CACHE_TTL_SECONDS: '3600' })
    ).toThrow('Invalid environment configuration');
  });

  it('throws when INTERNAL_EVENT_SIGNING_SECRET is shorter than 32 chars', () => {
    expect(() =>
      parseEnv({ ...baseEnv, INTERNAL_EVENT_SIGNING_SECRET: 'short' })
    ).toThrow('Invalid environment configuration');
  });

  it('throws when PASSWORD_HASH_COST exceeds max', () => {
    expect(() =>
      parseEnv({ ...baseEnv, PASSWORD_HASH_COST: '25' })
    ).toThrow('Invalid environment configuration');
  });

  it('throws when APP_BASE_URL is not a valid URL', () => {
    expect(() =>
      parseEnv({ ...baseEnv, APP_BASE_URL: 'not-a-url' })
    ).toThrow('Invalid environment configuration');
  });

  it('coerces boolean strings correctly', () => {
    const env1 = parseEnv({ ...baseEnv, FEATURE_ENABLE_CROSS_BORDER_PAYOUTS: 'true' });
    expect(env1.FEATURE_ENABLE_CROSS_BORDER_PAYOUTS).toBe(true);

    const env2 = parseEnv({ ...baseEnv, FEATURE_ENABLE_CROSS_BORDER_PAYOUTS: '0' });
    expect(env2.FEATURE_ENABLE_CROSS_BORDER_PAYOUTS).toBe(false);
  });

  it('applies numeric defaults correctly', () => {
    const env = parseEnv(baseEnv);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.MAX_WEBHOOK_RETRY_ATTEMPTS).toBe(5);
    expect(env.DEFAULT_SETTLEMENT_DELAY_DAYS).toBe(3);
  });

  it('uses default when optional Tingg field is missing', () => {
    const { TINGG_CLIENT_SECRET: _removed, ...withoutSecret } = baseEnv;
    const env = parseEnv(withoutSecret);
    expect(env.TINGG_CLIENT_SECRET).toBe('NOT_CONFIGURED');
  });

  it('throws when DEFAULT_CURRENCY is not exactly 3 chars', () => {
    expect(() => parseEnv({ ...baseEnv, DEFAULT_CURRENCY: 'KESH' })).toThrow(
      'Invalid environment configuration'
    );
  });
});
