/**
 * @module worker-env
 *
 * Cloudflare Worker bindings type definition.
 *
 * In Cloudflare Workers, infrastructure bindings (D1, KV, R2, Queues) are
 * injected into the worker's `env` object at runtime — they are NOT process.env
 * variables. This module types those bindings so every route handler and service
 * receives a fully typed context.
 *
 * The `WorkerEnv` interface must match the `[vars]`, `[[kv_namespaces]]`,
 * `[[d1_databases]]`, `[[r2_buckets]]`, and `[[queues]]` declarations
 * in wrangler.toml exactly. Drift between this file and wrangler.toml will
 * cause runtime binding-not-found errors.
 */

export interface WorkerEnv {
  // ----------------------------------------------------------------
  // Core env vars (also available as text bindings in wrangler.toml)
  // ----------------------------------------------------------------
  APP_ENV: string;
  APP_NAME: string;
  APP_BASE_URL: string;
  CUSTOMER_APP_URL: string;
  DASHBOARD_APP_URL: string;
  API_BASE_URL: string;
  DEFAULT_TIMEZONE: string;
  DEFAULT_CURRENCY: string;
  PLATFORM_COUNTRY_CODE: string;

  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_ACCESS_TTL_SECONDS: string;
  JWT_REFRESH_TTL_SECONDS: string;
  JWT_PRIVATE_KEY: string;
  JWT_PUBLIC_KEY: string;
  SESSION_COOKIE_NAME: string;
  SESSION_COOKIE_SECURE: string;
  SESSION_COOKIE_DOMAIN: string;
  MAGIC_LINK_TTL_MINUTES: string;
  PASSWORD_RESET_TTL_MINUTES: string;
  OTP_TTL_MINUTES: string;
  PASSWORD_HASH_COST: string;
  HMAC_WEBHOOK_SIGNING_ALGO: string;
  INTERNAL_EVENT_SIGNING_SECRET: string;
  CSRF_SECRET: string;
  ENCRYPTION_KEY: string;
  MFA_ENCRYPTION_KEY: string;
  AUDIT_LOG_RETENTION_DAYS: string;

  EMAIL_PROVIDER: string;
  EMAIL_FROM: string;
  RESEND_API_KEY?: string;
  SMS_PROVIDER: string;
  SMS_SENDER_ID?: string;
  AT_API_KEY?: string;
  AT_USERNAME?: string;

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
  TINGG_WEBHOOK_IP_ALLOWLIST?: string;
  TINGG_DEFAULT_PAYMENT_OPTION_CODE?: string;

  R2_PUBLIC_BASE_URL: string;
  MEDIA_MAX_UPLOAD_MB: string;
  MEDIA_ALLOWED_MIME_TYPES: string;

  RECONCILIATION_CRON_SCHEDULE: string;
  PAYOUT_CRON_SCHEDULE: string;
  PENDING_PAYMENT_POLL_CRON_SCHEDULE: string;
  PENDING_PAYOUT_POLL_CRON_SCHEDULE: string;
  LOG_LEVEL: string;
  ENABLE_REQUEST_LOGGING: string;
  ENABLE_SQL_LOGGING: string;
  FEATURE_ENABLE_CROSS_BORDER_PAYOUTS: string;
  FEATURE_ENABLE_PROVIDER_CALLBACKS: string;
  FEATURE_ENABLE_AGENT_QUOTES: string;
  FEATURE_ENABLE_CARD_PAYMENTS: string;
  FEATURE_ENABLE_EMAIL_NOTIFICATIONS: string;
  FEATURE_ENABLE_SMS_NOTIFICATIONS: string;

  DEFAULT_SETTLEMENT_DELAY_DAYS: string;
  REFUND_APPROVAL_THRESHOLD: string;
  PAYOUT_APPROVAL_THRESHOLD: string;
  MAX_IDEMPOTENCY_TTL_HOURS: string;
  MAX_WEBHOOK_RETRY_ATTEMPTS: string;
  PROVIDER_CALLBACK_TIMEOUT_MS: string;

  // ----------------------------------------------------------------
  // Identity and auth toggles
  // ----------------------------------------------------------------
  ENABLE_EMAIL_LOGIN: string;
  ENABLE_PHONE_LOGIN: string;
  ENABLE_MAGIC_LINK_LOGIN: string;
  ENABLE_PHONE_OTP_LOGIN: string;
  ENABLE_TOTP_MFA: string;
  ENABLE_SMS_MFA: string;
  MFA_REQUIRED_FOR_PRIVILEGED_ROLES: string;
  TRUSTED_DEVICE_TTL_DAYS: string;
  PHONE_VERIFICATION_TTL_MINUTES: string;
  STEP_UP_CHALLENGE_TTL_MINUTES: string;
  MFA_RECOVERY_CODE_COUNT: string;

  // ----------------------------------------------------------------
  // Risk engine
  // ----------------------------------------------------------------
  RISK_ENGINE_ENABLED: string;
  RISK_SCORE_STEP_UP_SMS_THRESHOLD: string;
  RISK_SCORE_STEP_UP_TOTP_THRESHOLD: string;
  RISK_SCORE_MANUAL_REVIEW_THRESHOLD: string;
  RISK_SCORE_DENY_THRESHOLD: string;

  // ----------------------------------------------------------------
  // Tingg Engage (SMS delivery)
  // ----------------------------------------------------------------
  TINGG_ENGAGE_BASE_URL: string;
  TINGG_ENGAGE_USERNAME: string;
  TINGG_ENGAGE_PASSWORD: string;
  TINGG_ENGAGE_SENDER_ID: string;

  // ----------------------------------------------------------------
  // Observability
  // ----------------------------------------------------------------
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT: string;
  SENTRY_TRACES_SAMPLE_RATE: string;
  OTEL_EXPORT_ENABLED: string;
  OTEL_EXPORTER_ENDPOINT?: string;
  OTEL_SERVICE_NAME: string;
  OTEL_SERVICE_VERSION: string;
  OTEL_HEADERS?: string;

  // ----------------------------------------------------------------
  // Cloudflare D1 database binding
  // ----------------------------------------------------------------
  /** Primary relational database — all application data lives here */
  DB: D1Database;

  // ----------------------------------------------------------------
  // Cloudflare R2 bucket binding
  // ----------------------------------------------------------------
  /** Object storage for media uploads (images, PDFs, etc.) */
  MEDIA_BUCKET: R2Bucket;

  // ----------------------------------------------------------------
  // Cloudflare KV namespace bindings
  // ----------------------------------------------------------------
  /**
   * General cache (token cache, lightweight lookups).
   * Not suitable for idempotency — use IDEMPOTENCY_KV for that.
   */
  CACHE_KV: KVNamespace;

  /**
   * Idempotency key store for financial operations.
   * Separate namespace so TTL policies don't interfere with other caches.
   */
  IDEMPOTENCY_KV: KVNamespace;

  /**
   * JWT and OAuth token cache.
   * Tingg access tokens are cached here to avoid redundant auth calls.
   */
  TOKEN_CACHE_KV: KVNamespace;

  /**
   * Webhook replay protection store.
   * Inbound Tingg webhook event IDs are stored here to detect duplicates.
   * TTL should match the expected webhook delivery window.
   */
  REPLAY_PROTECTION_KV: KVNamespace;

  /**
   * Rate limit counters.
   * Stores per-IP / per-user sliding window counters.
   */
  RATE_LIMIT_KV: KVNamespace;

  // ----------------------------------------------------------------
  // Cloudflare Queue bindings
  // ----------------------------------------------------------------
  /**
   * Queue for sending outbound webhook payloads to service providers.
   * Consumer applies retry with exponential backoff.
   */
  OUTBOUND_WEBHOOK_QUEUE: Queue;

  /**
   * Queue for async reconciliation jobs.
   * Decouples reconciliation from request/response cycle.
   */
  RECONCILIATION_QUEUE: Queue;

  /**
   * Queue for email/SMS notification dispatch.
   * Prevents notification failures from blocking payment flows.
   */
  NOTIFICATION_QUEUE: Queue;

  // ----------------------------------------------------------------
  // Additional KV namespaces for new capabilities
  // ----------------------------------------------------------------

  /**
   * Policy compilation cache — stores compiled workflow graphs
   * for maker-checker engine. Invalidated on policy publish.
   */
  POLICY_CACHE_KV: KVNamespace;

  /**
   * Trusted device fingerprint store.
   * Maps device fingerprint hashes to trust records with TTL.
   */
  TRUSTED_DEVICE_KV: KVNamespace;

  /**
   * Risk engine signal cache. Stores recent risk signals
   * (failed logins, impossible travel flags) for quick lookups.
   */
  RISK_CACHE_KV: KVNamespace;

  // ----------------------------------------------------------------
  // Additional Queue bindings
  // ----------------------------------------------------------------

  /**
   * Queue for approval workflow events (notifications, escalation
   * checks, timeout handling, delegation expiry).
   */
  APPROVAL_QUEUE: Queue;

  /**
   * Queue for payment-related async work (webhook processing,
   * delayed polling, retry).
   */
  PAYMENT_QUEUE: Queue;

  /**
   * Queue for payout-related async work (webhook processing,
   * delayed polling, payout dispatch).
   */
  PAYOUT_QUEUE: Queue;
}
