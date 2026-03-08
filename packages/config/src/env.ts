/**
 * @module env
 * Typed, validated environment configuration for felix-travel.
 *
 * All runtime configuration MUST be accessed through this module.
 * Direct process.env access elsewhere is prohibited by ESLint rule.
 *
 * Uses Zod for parse-and-validate semantics. The app fails fast on
 * boot if any required variable is missing or malformed — this is
 * intentional to catch misconfigured deployments immediately.
 */
import { z } from 'zod';

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Coerce "true"/"false" strings (common in env vars) to boolean */
const booleanFromString = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

/** Accept a numeric string and cast to number */
const numberFromString = z.string().transform((v, ctx) => {
  const n = Number(v);
  if (Number.isNaN(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Expected number, got "${v}"` });
    return z.NEVER;
  }
  return n;
});

// ----------------------------------------------------------------
// Schema sections — each section corresponds to a logical group
// ----------------------------------------------------------------

const coreSchema = z.object({
  /** deployment environment gate — controls feature flags and logging verbosity */
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']),
  APP_NAME: z.string().min(1),
  /** public base URL of the API worker (no trailing slash) */
  APP_BASE_URL: z.string().url(),
  CUSTOMER_APP_URL: z.string().url(),
  DASHBOARD_APP_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  /** IANA timezone string used for scheduling and display */
  DEFAULT_TIMEZONE: z.string().default('Africa/Nairobi'),
  /** ISO 4217 currency for platform-level defaults */
  DEFAULT_CURRENCY: z.string().length(3).default('KES'),
  /** ISO 3166-1 alpha-2 country of platform home jurisdiction */
  PLATFORM_COUNTRY_CODE: z.string().length(2).default('KE'),
});

const authSchema = z.object({
  JWT_ISSUER: z.string().url(),
  JWT_AUDIENCE: z.string().min(1),
  JWT_ACCESS_TTL_SECONDS: numberFromString.pipe(z.number().int().positive()).default('900'),
  JWT_REFRESH_TTL_SECONDS: numberFromString.pipe(z.number().int().positive()).default('2592000'),
  /** Base64-encoded RSA-2048 private key for RS256 JWT signing */
  JWT_PRIVATE_KEY: z.string().min(100),
  /** Base64-encoded RSA-2048 public key for RS256 JWT verification */
  JWT_PUBLIC_KEY: z.string().min(100),
  SESSION_COOKIE_NAME: z.string().default('felix_session'),
  SESSION_COOKIE_SECURE: booleanFromString.default('false'),
  SESSION_COOKIE_DOMAIN: z.string().default('localhost'),
  MAGIC_LINK_TTL_MINUTES: numberFromString.pipe(z.number().int().positive()).default('15'),
  PASSWORD_RESET_TTL_MINUTES: numberFromString.pipe(z.number().int().positive()).default('60'),
  OTP_TTL_MINUTES: numberFromString.pipe(z.number().int().positive()).default('10'),
  /**
   * Bcrypt cost factor. Lower values speed up tests but weaken security.
   * Never go below 10 in production.
   */
  PASSWORD_HASH_COST: numberFromString.pipe(z.number().int().min(4).max(20)).default('12'),
  /** HMAC algo for outbound webhook signatures — SHA-256 is strongly preferred */
  HMAC_WEBHOOK_SIGNING_ALGO: z.enum(['SHA-256', 'SHA-512']).default('SHA-256'),
  /** Signs internal queue messages to prevent injection attacks */
  INTERNAL_EVENT_SIGNING_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  /** AES-256 key for encrypting sensitive fields at rest (base64) */
  ENCRYPTION_KEY: z.string().min(32),
  AUDIT_LOG_RETENTION_DAYS: numberFromString.pipe(z.number().int().positive()).default('365'),
});

const emailSchema = z.object({
  EMAIL_PROVIDER: z.enum(['resend', 'sendgrid', 'mailgun', 'smtp', 'disabled']).default('disabled'),
  EMAIL_FROM: z.string().email().or(z.string().regex(/^.+ <.+@.+>$/)),
  // Resend key is only required when EMAIL_PROVIDER=resend
  RESEND_API_KEY: z.string().optional(),
  SMS_PROVIDER: z.enum(['africas_talking', 'twilio', 'disabled']).default('disabled'),
  SMS_SENDER_ID: z.string().optional(),
  AT_API_KEY: z.string().optional(),
  AT_USERNAME: z.string().optional(),
});

const tinggSchema = z.object({
  TINGG_ENVIRONMENT: z.enum(['sandbox', 'production']),
  TINGG_BASE_URL: z.string().url(),
  /** OAuth2 client id issued by Tingg — treat as a secret */
  TINGG_CLIENT_ID: z.string().min(1).default('NOT_CONFIGURED'),
  /** OAuth2 client secret — MUST be a secret binding, never exposed to browser */
  TINGG_CLIENT_SECRET: z.string().min(1).default('NOT_CONFIGURED'),
  TINGG_SERVICE_CODE: z.string().min(1),
  TINGG_PAYOUT_SERVICE_CODE: z.string().min(1),
  TINGG_COLLECTION_COUNTRY_CODE: z.string().length(2),
  TINGG_COLLECTION_CURRENCY_CODE: z.string().length(3),
  /** Where Tingg will POST checkout/payment events (must be public HTTPS in production) */
  TINGG_CALLBACK_CHECKOUT_URL: z.string().url(),
  TINGG_CALLBACK_PAYOUT_URL: z.string().url(),
  TINGG_SUCCESS_REDIRECT_URL: z.string().url(),
  TINGG_FAIL_REDIRECT_URL: z.string().url(),
  /**
   * Keep slightly under actual token TTL (3600s) to avoid using a nearly-expired
   * token on an in-flight request — 3300s (55min) is a safe conservative value.
   */
  TINGG_TOKEN_CACHE_TTL_SECONDS: numberFromString.pipe(z.number().int().positive().max(3599)).default('3300'),
  TINGG_HTTP_TIMEOUT_MS: numberFromString.pipe(z.number().int().positive()).default('30000'),
  TINGG_MAX_RETRIES: numberFromString.pipe(z.number().int().min(0).max(10)).default('3'),
  /**
   * Optional comma-separated IP CIDR allowlist for validating Tingg webhook source IPs.
   * If omitted, source IP validation is skipped (relying on payload signature only).
   */
  TINGG_WEBHOOK_IP_ALLOWLIST: z.string().optional(),
  TINGG_DEFAULT_PAYMENT_OPTION_CODE: z.string().optional(),
});

const storageSchema = z.object({
  /** Public CDN base URL for R2 — used to construct media asset URLs */
  R2_PUBLIC_BASE_URL: z.string().url(),
  MEDIA_MAX_UPLOAD_MB: numberFromString.pipe(z.number().int().positive().max(100)).default('20'),
  MEDIA_ALLOWED_MIME_TYPES: z
    .string()
    .default('image/jpeg,image/png,image/webp,image/gif,application/pdf'),
});

const operationsSchema = z.object({
  RECONCILIATION_CRON_SCHEDULE: z.string().default('0 2 * * *'),
  PAYOUT_CRON_SCHEDULE: z.string().default('0 9 * * 1-5'),
  PENDING_PAYMENT_POLL_CRON_SCHEDULE: z.string().default('*/5 * * * *'),
  PENDING_PAYOUT_POLL_CRON_SCHEDULE: z.string().default('*/10 * * * *'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ENABLE_REQUEST_LOGGING: booleanFromString.default('false'),
  /** SQL logging may expose PII in query parameters — keep off in production */
  ENABLE_SQL_LOGGING: booleanFromString.default('false'),
  FEATURE_ENABLE_CROSS_BORDER_PAYOUTS: booleanFromString.default('false'),
  FEATURE_ENABLE_PROVIDER_CALLBACKS: booleanFromString.default('true'),
  FEATURE_ENABLE_AGENT_QUOTES: booleanFromString.default('true'),
  FEATURE_ENABLE_CARD_PAYMENTS: booleanFromString.default('false'),
  FEATURE_ENABLE_EMAIL_NOTIFICATIONS: booleanFromString.default('false'),
  FEATURE_ENABLE_SMS_NOTIFICATIONS: booleanFromString.default('false'),
});

const rbacSchema = z.object({
  /**
   * Days after service delivery before a payout is eligible.
   * Provides a buffer for post-trip refund requests.
   */
  DEFAULT_SETTLEMENT_DELAY_DAYS: numberFromString.pipe(z.number().int().min(0)).default('3'),
  /**
   * Refunds above this amount (in minor currency units, e.g. cents/smallest unit)
   * are queued for admin approval rather than auto-processed.
   */
  REFUND_APPROVAL_THRESHOLD: numberFromString.pipe(z.number().int().positive()).default('100000'),
  PAYOUT_APPROVAL_THRESHOLD: numberFromString.pipe(z.number().int().positive()).default('500000'),
  /** After this TTL, idempotency keys are evicted from KV */
  MAX_IDEMPOTENCY_TTL_HOURS: numberFromString.pipe(z.number().int().positive()).default('24'),
  MAX_WEBHOOK_RETRY_ATTEMPTS: numberFromString.pipe(z.number().int().min(1).max(20)).default('5'),
  PROVIDER_CALLBACK_TIMEOUT_MS: numberFromString.pipe(z.number().int().positive()).default('10000'),
});

// ----------------------------------------------------------------
// Identity and auth toggles
// ----------------------------------------------------------------
const identitySchema = z.object({
  /** Allow login via email + password */
  ENABLE_EMAIL_LOGIN: booleanFromString.default('true'),
  /** Allow login via phone + password */
  ENABLE_PHONE_LOGIN: booleanFromString.default('true'),
  /** Allow passwordless login via email magic link */
  ENABLE_MAGIC_LINK_LOGIN: booleanFromString.default('true'),
  /** Allow login via phone OTP (sends OTP via Tingg Engage) */
  ENABLE_PHONE_OTP_LOGIN: booleanFromString.default('false'),
  /** Enable TOTP (authenticator app) as an MFA method */
  ENABLE_TOTP_MFA: booleanFromString.default('true'),
  /** Enable SMS OTP as an MFA method (via Tingg Engage) */
  ENABLE_SMS_MFA: booleanFromString.default('true'),
  /** If true, privileged roles must enroll MFA before sensitive actions */
  MFA_REQUIRED_FOR_PRIVILEGED_ROLES: booleanFromString.default('true'),
  /** How long a trusted device designation lasts before requiring re-verification */
  TRUSTED_DEVICE_TTL_DAYS: numberFromString.pipe(z.number().int().positive()).default('30'),
  /** Time window for phone verification challenges */
  PHONE_VERIFICATION_TTL_MINUTES: numberFromString.pipe(z.number().int().positive()).default('10'),
  /** Time window for step-up auth challenges */
  STEP_UP_CHALLENGE_TTL_MINUTES: numberFromString.pipe(z.number().int().positive()).default('5'),
  /** Number of one-time recovery codes generated during MFA enrollment */
  MFA_RECOVERY_CODE_COUNT: numberFromString.pipe(z.number().int().min(6).max(16)).default('10'),
});

// ----------------------------------------------------------------
// Risk engine
// ----------------------------------------------------------------
const riskSchema = z.object({
  RISK_ENGINE_ENABLED: booleanFromString.default('true'),
  /** Score above which SMS step-up is required */
  RISK_SCORE_STEP_UP_SMS_THRESHOLD: numberFromString.pipe(z.number().int().min(0).max(100)).default('40'),
  /** Score above which TOTP step-up is required (stricter than SMS) */
  RISK_SCORE_STEP_UP_TOTP_THRESHOLD: numberFromString.pipe(z.number().int().min(0).max(100)).default('60'),
  /** Score above which a human must review */
  RISK_SCORE_MANUAL_REVIEW_THRESHOLD: numberFromString.pipe(z.number().int().min(0).max(100)).default('80'),
  /** Score above which the action is denied outright */
  RISK_SCORE_DENY_THRESHOLD: numberFromString.pipe(z.number().int().min(0).max(100)).default('95'),
});

// ----------------------------------------------------------------
// Tingg Engage (SMS delivery)
// ----------------------------------------------------------------
const tinggEngageSchema = z.object({
  /** Base URL for Tingg Engage API v2 */
  TINGG_ENGAGE_BASE_URL: z.string().url().default('https://api.tingg.africa/v2/engage'),
  /** HTTP Basic auth username for Engage */
  TINGG_ENGAGE_USERNAME: z.string().min(1).default('NOT_CONFIGURED'),
  /** HTTP Basic auth password for Engage — MUST be a secret */
  TINGG_ENGAGE_PASSWORD: z.string().min(1).default('NOT_CONFIGURED'),
  /** Sender ID shown in SMS messages */
  TINGG_ENGAGE_SENDER_ID: z.string().min(1).default('FELIX'),
});

// ----------------------------------------------------------------
// Observability/telemetry
// ----------------------------------------------------------------
const observabilitySchema = z.object({
  /** Sentry DSN for error reporting — leave empty to disable */
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default('development'),
  SENTRY_TRACES_SAMPLE_RATE: numberFromString.pipe(z.number().min(0).max(1)).default('0.1'),
  /** Enable OTLP trace export */
  OTEL_EXPORT_ENABLED: booleanFromString.default('false'),
  /** HTTP OTLP endpoint for trace export */
  OTEL_EXPORTER_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default('felix-travel-api'),
  OTEL_SERVICE_VERSION: z.string().default('0.0.1'),
  /** Comma-separated key=value pairs for OTLP auth headers */
  OTEL_HEADERS: z.string().optional(),
});

/** Master schema — union of all sections */
export const envSchema = coreSchema
  .merge(authSchema)
  .merge(emailSchema)
  .merge(tinggSchema)
  .merge(storageSchema)
  .merge(operationsSchema)
  .merge(rbacSchema)
  .merge(identitySchema)
  .merge(riskSchema)
  .merge(tinggEngageSchema)
  .merge(observabilitySchema);

export type Env = z.infer<typeof envSchema>;

// ----------------------------------------------------------------
// Parsing and singleton
// ----------------------------------------------------------------

let _env: Env | undefined;

/**
 * Parse and validate all environment variables.
 *
 * Call once on worker startup (or test setup). Throws with detailed
 * Zod error messages if any required variable is missing or invalid.
 * Subsequent calls return the cached result.
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const formatted = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`[felix-travel] Invalid environment configuration:\n${formatted}`);
  }
  _env = result.data;
  return _env;
}

/**
 * Access the validated env singleton.
 * Must call parseEnv() before using getEnv() in any context.
 */
export function getEnv(): Env {
  if (!_env) {
    throw new Error(
      '[felix-travel] getEnv() called before parseEnv(). Call parseEnv(env) in your worker fetch handler.'
    );
  }
  return _env;
}

/** Expose feature flag accessors for clean call-site usage */
export const features = {
  crossBorderPayouts: () => getEnv().FEATURE_ENABLE_CROSS_BORDER_PAYOUTS,
  providerCallbacks: () => getEnv().FEATURE_ENABLE_PROVIDER_CALLBACKS,
  agentQuotes: () => getEnv().FEATURE_ENABLE_AGENT_QUOTES,
  cardPayments: () => getEnv().FEATURE_ENABLE_CARD_PAYMENTS,
  emailNotifications: () => getEnv().FEATURE_ENABLE_EMAIL_NOTIFICATIONS,
  smsNotifications: () => getEnv().FEATURE_ENABLE_SMS_NOTIFICATIONS,
  emailLogin: () => getEnv().ENABLE_EMAIL_LOGIN,
  phoneLogin: () => getEnv().ENABLE_PHONE_LOGIN,
  magicLinkLogin: () => getEnv().ENABLE_MAGIC_LINK_LOGIN,
  phoneOtpLogin: () => getEnv().ENABLE_PHONE_OTP_LOGIN,
  totpMfa: () => getEnv().ENABLE_TOTP_MFA,
  smsMfa: () => getEnv().ENABLE_SMS_MFA,
  mfaRequiredForPrivilegedRoles: () => getEnv().MFA_REQUIRED_FOR_PRIVILEGED_ROLES,
  riskEngine: () => getEnv().RISK_ENGINE_ENABLED,
};

/** Helper: derive allowed MIME types as an array */
export function getAllowedMimeTypes(): string[] {
  return getEnv().MEDIA_ALLOWED_MIME_TYPES.split(',').map((t) => t.trim());
}

/** Helper: derive Tingg webhook IP allowlist as an array (empty = skip check) */
export function getTinggIpAllowlist(): string[] {
  const raw = getEnv().TINGG_WEBHOOK_IP_ALLOWLIST;
  if (!raw) return [];
  return raw.split(',').map((ip) => ip.trim()).filter(Boolean);
}
