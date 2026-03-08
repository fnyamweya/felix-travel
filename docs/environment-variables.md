# Environment Variables

All runtime configuration is parsed and validated on worker startup via the `parseEnv()` function in `@felix-travel/config`. The application fails fast if any required variable is missing or malformed.

> **Never access environment variables directly.** Use `getEnv()` from `@felix-travel/config` after calling `parseEnv()` once during initialization.

---

## Core

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_ENV` | **Yes** | — | Deployment environment. One of: `development`, `test`, `staging`, `production`. Controls feature flags and logging verbosity. |
| `APP_NAME` | **Yes** | — | Human-readable application name. |
| `APP_BASE_URL` | **Yes** | — | Public base URL of the API worker (no trailing slash). Must be a valid URL. |
| `CUSTOMER_APP_URL` | **Yes** | — | Public URL of the customer-facing web app. |
| `DASHBOARD_APP_URL` | **Yes** | — | Public URL of the admin/provider dashboard. |
| `API_BASE_URL` | **Yes** | — | Base URL for internal API calls. |
| `DEFAULT_TIMEZONE` | No | `Africa/Nairobi` | IANA timezone string used for scheduling and display. |
| `DEFAULT_CURRENCY` | No | `KES` | ISO 4217 currency code for platform-level defaults. Must be exactly 3 characters. |
| `PLATFORM_COUNTRY_CODE` | No | `KE` | ISO 3166-1 alpha-2 country of platform home jurisdiction. Must be exactly 2 characters. |

---

## Authentication & Security

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_ISSUER` | **Yes** | — | JWT `iss` claim. Must be a valid URL. |
| `JWT_AUDIENCE` | **Yes** | — | JWT `aud` claim. |
| `JWT_ACCESS_TTL_SECONDS` | No | `900` | Access token lifetime in seconds. |
| `JWT_REFRESH_TTL_SECONDS` | No | `2592000` | Refresh token lifetime in seconds (default: 30 days). |
| `JWT_PRIVATE_KEY` | **Yes** | — | Base64-encoded RSA-2048 private key for RS256 JWT signing. Minimum 100 characters. |
| `JWT_PUBLIC_KEY` | **Yes** | — | Base64-encoded RSA-2048 public key for RS256 JWT verification. Minimum 100 characters. |
| `SESSION_COOKIE_NAME` | No | `felix_session` | Name of the session cookie. |
| `SESSION_COOKIE_SECURE` | No | `false` | Whether to set the `Secure` flag on the session cookie. Use `true` in production. |
| `SESSION_COOKIE_DOMAIN` | No | `localhost` | Domain scope for the session cookie. |
| `MAGIC_LINK_TTL_MINUTES` | No | `15` | How long a magic link remains valid. |
| `PASSWORD_RESET_TTL_MINUTES` | No | `60` | How long a password reset link remains valid. |
| `OTP_TTL_MINUTES` | No | `10` | How long a one-time password remains valid. |
| `PASSWORD_HASH_COST` | No | `12` | Bcrypt cost factor (4–20). Never go below 10 in production. |
| `HMAC_WEBHOOK_SIGNING_ALGO` | No | `SHA-256` | HMAC algorithm for outbound webhook signatures. One of: `SHA-256`, `SHA-512`. |
| `INTERNAL_EVENT_SIGNING_SECRET` | **Yes** | — | Signs internal queue messages to prevent injection. Minimum 32 characters. |
| `CSRF_SECRET` | **Yes** | — | CSRF protection secret. Minimum 32 characters. |
| `ENCRYPTION_KEY` | **Yes** | — | AES-256 key for encrypting sensitive fields at rest (base64). Minimum 32 characters. |
| `AUDIT_LOG_RETENTION_DAYS` | No | `365` | How many days to retain audit log entries. |

---

## Identity & Login

| Variable | Required | Default | Description |
|---|---|---|---|
| `ENABLE_EMAIL_LOGIN` | No | `true` | Allow login via email + password. |
| `ENABLE_PHONE_LOGIN` | No | `true` | Allow login via phone + password. |
| `ENABLE_MAGIC_LINK_LOGIN` | No | `true` | Allow passwordless login via email magic link. |
| `ENABLE_PHONE_OTP_LOGIN` | No | `false` | Allow login via phone OTP (sends OTP via Tingg Engage). |
| `ENABLE_TOTP_MFA` | No | `true` | Enable TOTP (authenticator app) as an MFA method. |
| `ENABLE_SMS_MFA` | No | `true` | Enable SMS OTP as an MFA method (via Tingg Engage). |
| `MFA_REQUIRED_FOR_PRIVILEGED_ROLES` | No | `true` | If true, privileged roles must enroll MFA before sensitive actions. |
| `TRUSTED_DEVICE_TTL_DAYS` | No | `30` | How long a trusted device designation lasts before requiring re-verification. |
| `PHONE_VERIFICATION_TTL_MINUTES` | No | `10` | Time window for phone verification challenges. |
| `STEP_UP_CHALLENGE_TTL_MINUTES` | No | `5` | Time window for step-up auth challenges. |
| `MFA_RECOVERY_CODE_COUNT` | No | `10` | Number of one-time recovery codes generated during MFA enrollment (6–16). |

---

## Email & SMS

| Variable | Required | Default | Description |
|---|---|---|---|
| `EMAIL_PROVIDER` | No | `disabled` | Email delivery provider. One of: `resend`, `sendgrid`, `mailgun`, `smtp`, `disabled`. |
| `EMAIL_FROM` | **Yes** | — | Sender address for outbound emails. Accepts `user@example.com` or `Name <user@example.com>`. |
| `RESEND_API_KEY` | No | — | API key for Resend. Required when `EMAIL_PROVIDER=resend`. |
| `SMS_PROVIDER` | No | `disabled` | SMS delivery provider. One of: `africas_talking`, `twilio`, `disabled`. |
| `SMS_SENDER_ID` | No | — | Sender ID for SMS messages. |
| `AT_API_KEY` | No | — | Africa's Talking API key. |
| `AT_USERNAME` | No | — | Africa's Talking username. |

---

## Tingg Payments

| Variable | Required | Default | Description |
|---|---|---|---|
| `TINGG_ENVIRONMENT` | **Yes** | — | One of: `sandbox`, `production`. |
| `TINGG_BASE_URL` | **Yes** | — | Tingg API base URL. |
| `TINGG_CLIENT_ID` | **Yes** | — | OAuth2 client ID issued by Tingg. Treat as a secret. |
| `TINGG_CLIENT_SECRET` | **Yes** | — | OAuth2 client secret. **Must be a secret binding, never exposed to browser.** |
| `TINGG_SERVICE_CODE` | **Yes** | — | Tingg service code for collections. |
| `TINGG_PAYOUT_SERVICE_CODE` | **Yes** | — | Tingg service code for payouts. |
| `TINGG_COLLECTION_COUNTRY_CODE` | **Yes** | — | ISO 3166-1 alpha-2 country code for collections. |
| `TINGG_COLLECTION_CURRENCY_CODE` | **Yes** | — | ISO 4217 currency code for collections. |
| `TINGG_CALLBACK_CHECKOUT_URL` | **Yes** | — | URL where Tingg will POST checkout/payment events. Must be public HTTPS in production. |
| `TINGG_CALLBACK_PAYOUT_URL` | **Yes** | — | URL where Tingg will POST payout events. |
| `TINGG_SUCCESS_REDIRECT_URL` | **Yes** | — | URL to redirect customers after successful payment. |
| `TINGG_FAIL_REDIRECT_URL` | **Yes** | — | URL to redirect customers after failed payment. |
| `TINGG_TOKEN_CACHE_TTL_SECONDS` | No | `3300` | How long to cache Tingg OAuth tokens. Keep under 3600s to avoid expired tokens (max: 3599). |
| `TINGG_HTTP_TIMEOUT_MS` | No | `30000` | HTTP request timeout for Tingg API calls in milliseconds. |
| `TINGG_MAX_RETRIES` | No | `3` | Maximum retry attempts for failed Tingg API calls (0–10). |
| `TINGG_WEBHOOK_IP_ALLOWLIST` | No | — | Comma-separated IP CIDR allowlist for validating Tingg webhook source IPs. If omitted, relies on payload signature only. |
| `TINGG_DEFAULT_PAYMENT_OPTION_CODE` | No | — | Default Tingg payment option code. |

---

## Tingg Engage (SMS)

| Variable | Required | Default | Description |
|---|---|---|---|
| `TINGG_ENGAGE_BASE_URL` | No | `https://api.tingg.africa/v2/engage` | Base URL for the Tingg Engage API v2. |
| `TINGG_ENGAGE_USERNAME` | **Yes** | — | HTTP Basic auth username for Engage. |
| `TINGG_ENGAGE_PASSWORD` | **Yes** | — | HTTP Basic auth password for Engage. **Must be a secret.** |
| `TINGG_ENGAGE_SENDER_ID` | No | `FELIX` | Sender ID shown in SMS messages. |

---

## Storage

| Variable | Required | Default | Description |
|---|---|---|---|
| `R2_PUBLIC_BASE_URL` | **Yes** | — | Public CDN base URL for R2 — used to construct media asset URLs. |
| `MEDIA_MAX_UPLOAD_MB` | No | `20` | Maximum upload file size in megabytes (max: 100). |
| `MEDIA_ALLOWED_MIME_TYPES` | No | `image/jpeg,image/png,image/webp,image/gif,application/pdf` | Comma-separated list of allowed MIME types for uploads. |

---

## Operations & Feature Flags

| Variable | Required | Default | Description |
|---|---|---|---|
| `RECONCILIATION_CRON_SCHEDULE` | No | `0 2 * * *` | Cron schedule for reconciliation jobs (default: daily at 2 AM). |
| `PAYOUT_CRON_SCHEDULE` | No | `0 9 * * 1-5` | Cron schedule for payout processing (default: weekdays at 9 AM). |
| `PENDING_PAYMENT_POLL_CRON_SCHEDULE` | No | `*/5 * * * *` | Cron schedule for polling pending payments (default: every 5 min). |
| `PENDING_PAYOUT_POLL_CRON_SCHEDULE` | No | `*/10 * * * *` | Cron schedule for polling pending payouts (default: every 10 min). |
| `LOG_LEVEL` | No | `info` | Minimum log level. One of: `debug`, `info`, `warn`, `error`. |
| `ENABLE_REQUEST_LOGGING` | No | `false` | Log all incoming HTTP requests. |
| `ENABLE_SQL_LOGGING` | No | `false` | Log SQL queries. **May expose PII in query parameters — keep off in production.** |
| `FEATURE_ENABLE_CROSS_BORDER_PAYOUTS` | No | `false` | Enable cross-border payout processing. |
| `FEATURE_ENABLE_PROVIDER_CALLBACKS` | No | `true` | Enable provider webhook callbacks. |
| `FEATURE_ENABLE_AGENT_QUOTES` | No | `true` | Enable agent-based quoting. |
| `FEATURE_ENABLE_CARD_PAYMENTS` | No | `false` | Enable card payment option. |
| `FEATURE_ENABLE_EMAIL_NOTIFICATIONS` | No | `false` | Send transactional email notifications. |
| `FEATURE_ENABLE_SMS_NOTIFICATIONS` | No | `false` | Send transactional SMS notifications. |

---

## Business Rules

| Variable | Required | Default | Description |
|---|---|---|---|
| `DEFAULT_SETTLEMENT_DELAY_DAYS` | No | `3` | Days after service delivery before a payout is eligible. Provides a buffer for post-trip refund requests. |
| `REFUND_APPROVAL_THRESHOLD` | No | `100000` | Refunds above this amount (in minor currency units) are queued for admin approval. |
| `PAYOUT_APPROVAL_THRESHOLD` | No | `500000` | Payouts above this amount (in minor currency units) are queued for admin approval. |
| `MAX_IDEMPOTENCY_TTL_HOURS` | No | `24` | After this TTL, idempotency keys are evicted from KV. |
| `MAX_WEBHOOK_RETRY_ATTEMPTS` | No | `5` | Maximum retry attempts for webhook delivery (1–20). |
| `PROVIDER_CALLBACK_TIMEOUT_MS` | No | `10000` | Timeout for outbound provider callback HTTP requests in milliseconds. |

---

## Risk Engine

| Variable | Required | Default | Description |
|---|---|---|---|
| `RISK_ENGINE_ENABLED` | No | `true` | Enable the risk scoring engine. |
| `RISK_SCORE_STEP_UP_SMS_THRESHOLD` | No | `40` | Score (0–100) above which SMS step-up verification is required. |
| `RISK_SCORE_STEP_UP_TOTP_THRESHOLD` | No | `60` | Score (0–100) above which TOTP step-up verification is required. |
| `RISK_SCORE_MANUAL_REVIEW_THRESHOLD` | No | `80` | Score (0–100) above which a human must review the action. |
| `RISK_SCORE_DENY_THRESHOLD` | No | `95` | Score (0–100) above which the action is denied outright. |

---

## Observability

| Variable | Required | Default | Description |
|---|---|---|---|
| `SENTRY_DSN` | No | — | Sentry DSN for error reporting. Leave empty to disable. |
| `SENTRY_ENVIRONMENT` | No | `development` | Sentry environment tag. |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `0.1` | Sentry traces sample rate (0.0–1.0). |
| `OTEL_EXPORT_ENABLED` | No | `false` | Enable OpenTelemetry trace export. |
| `OTEL_EXPORTER_ENDPOINT` | No | — | HTTP OTLP endpoint for trace export. Required when `OTEL_EXPORT_ENABLED=true`. |
| `OTEL_SERVICE_NAME` | No | `felix-travel-api` | Service name reported in traces. |
| `OTEL_SERVICE_VERSION` | No | `0.0.1` | Service version reported in traces. |
| `OTEL_HEADERS` | No | — | Comma-separated `key=value` pairs for OTLP auth headers. |

---

## Cloudflare Workers Variables vs Secrets

In Cloudflare Workers, configuration values are split into two categories:

- **Variables** (`[vars]` in `wrangler.toml`) — Non-sensitive configuration that is checked into source control. These are plain-text key/value pairs visible in the wrangler config and the Cloudflare dashboard.
- **Secrets** (`wrangler secret put`) — Sensitive values that are encrypted at rest and never appear in source control or build logs. Secrets are set via the Wrangler CLI or the Cloudflare dashboard.

Both are injected into the worker's `env` object at runtime and are typed by the `WorkerEnv` interface in `@felix-travel/config`.

### Variables (set in `wrangler.toml`)

These are safe to commit. They are defined in `apps/api-edge/wrangler.toml` under `[vars]`:

| Variable | Example | Notes |
|---|---|---|
| `APP_ENV` | `development` | Override per environment (`staging`, `production`). |
| `APP_NAME` | `Felix Travel` | |
| `LOG_LEVEL` | `debug` | Use `info` or `warn` in production. |
| `DEFAULT_CURRENCY` | `KES` | |
| `DEFAULT_TIMEZONE` | `Africa/Nairobi` | |
| `PLATFORM_COUNTRY_CODE` | `KE` | |

All other non-sensitive env vars with defaults (feature flags, cron schedules, TTLs, etc.) can also be added to `[vars]` or configured in the Cloudflare dashboard under **Workers & Pages → Settings → Variables**.

### Secrets (set via `wrangler secret put`)

These **must never** appear in `wrangler.toml` or source control. Set them with:

```bash
cd apps/api-edge
npx wrangler secret put <SECRET_NAME>
```

Or configure via the Cloudflare dashboard under **Workers & Pages → Settings → Variables → Encrypt**.

| Secret | Description |
|---|---|
| `JWT_PRIVATE_KEY` | Base64-encoded RSA-2048 private key for JWT signing. |
| `JWT_PUBLIC_KEY` | Base64-encoded RSA-2048 public key for JWT verification. |
| `INTERNAL_EVENT_SIGNING_SECRET` | HMAC key for internal queue message signing. Min 32 chars. |
| `CSRF_SECRET` | CSRF protection secret. Min 32 chars. |
| `ENCRYPTION_KEY` | AES-256 key for encrypting sensitive fields at rest. Min 32 chars. |
| `MFA_ENCRYPTION_KEY` | Encryption key for MFA secrets (TOTP seeds, recovery codes). |
| `TINGG_CLIENT_ID` | Tingg OAuth2 client ID. |
| `TINGG_CLIENT_SECRET` | Tingg OAuth2 client secret. |
| `TINGG_ENGAGE_USERNAME` | HTTP Basic auth username for Tingg Engage SMS API. |
| `TINGG_ENGAGE_PASSWORD` | HTTP Basic auth password for Tingg Engage SMS API. |
| `RESEND_API_KEY` | Resend email API key (if `EMAIL_PROVIDER=resend`). |
| `AT_API_KEY` | Africa's Talking API key (if `SMS_PROVIDER=africas_talking`). |
| `SENTRY_DSN` | Sentry error reporting DSN. |

---

## Cloudflare Infrastructure Bindings

These are not env vars — they are Cloudflare resource bindings declared in `wrangler.toml` and injected into the worker's `env` object. They require the corresponding resources to be created in your Cloudflare account first.

### D1 Database

| Binding | Resource | Description |
|---|---|---|
| `DB` | `felix-travel-db` | Primary relational database. All application data lives here. |

Create with: `npx wrangler d1 create felix-travel-db`

### R2 Bucket

| Binding | Resource | Description |
|---|---|---|
| `MEDIA_BUCKET` | `felix-travel-media` | Object storage for media uploads (images, PDFs, etc.). |

Create with: `npx wrangler r2 bucket create felix-travel-media`

### KV Namespaces

| Binding | Description |
|---|---|
| `CACHE_KV` | General cache for lightweight lookups. Not for idempotency. |
| `IDEMPOTENCY_KV` | Idempotency key store for financial operations. Separate namespace to avoid TTL conflicts. |
| `TOKEN_CACHE_KV` | JWT and OAuth token cache (Tingg access tokens cached here). |
| `REPLAY_PROTECTION_KV` | Webhook replay protection. Stores inbound event IDs to detect duplicates. |
| `RATE_LIMIT_KV` | Per-IP / per-user sliding window rate limit counters. |
| `POLICY_CACHE_KV` | Compiled workflow graphs for the maker-checker engine. Invalidated on policy publish. |
| `TRUSTED_DEVICE_KV` | Trusted device fingerprint store. Maps device hashes to trust records with TTL. |
| `RISK_CACHE_KV` | Risk engine signal cache (failed logins, impossible travel flags). |

Create each with: `npx wrangler kv namespace create <NAME>`

Then update the `id` fields in `wrangler.toml` with the returned namespace IDs.

### Queues

| Binding | Queue Name | Description |
|---|---|---|
| `OUTBOUND_WEBHOOK_QUEUE` | `felix-travel-outbound-webhooks` | Sends outbound webhook payloads to providers. Consumer retries with exponential backoff. |
| `RECONCILIATION_QUEUE` | `felix-travel-reconciliation` | Async reconciliation jobs. Decoupled from request/response cycle. |
| `NOTIFICATION_QUEUE` | `felix-travel-notifications` | Email/SMS notification dispatch. Prevents notification failures from blocking payments. |
| `APPROVAL_QUEUE` | `felix-travel-approval` | Approval workflow events (notifications, escalation, timeout handling). |
| `PAYMENT_QUEUE` | `felix-travel-payment` | Payment async work (webhook processing, delayed polling, retry). |
| `PAYOUT_QUEUE` | `felix-travel-payout` | Payout async work (webhook processing, dispatch). |

Create each with: `npx wrangler queues create <queue-name>`

### Cron Triggers

Defined in `wrangler.toml` under `[triggers]`:

| Schedule | Purpose |
|---|---|
| `*/5 * * * *` | Poll pending payments. |
| `*/10 * * * *` | Poll pending payouts. |
| `0 2 * * *` | Daily reconciliation (2 AM). |
| `0 9 * * 1-5` | Weekday payout processing (9 AM). |

---

## Custom Domains

All services are deployed under subdomains of `felix.co.ke`. The zone must be active in Cloudflare under the same account.

| Service | Subdomain | Type |
|---|---|---|
| Customer web app | `travel.felix.co.ke` | Cloudflare Pages custom domain |
| Dashboard web app | `travel-dash.felix.co.ke` | Cloudflare Pages custom domain |
| API worker | `travel-apis.felix.co.ke` | Worker custom domain (via `routes` in `wrangler.toml`) |

### How it works

- **API worker**: The `routes` field in `wrangler.toml` declares `travel-apis.felix.co.ke` as a `custom_domain`. When you run `wrangler deploy`, Cloudflare automatically creates the DNS CNAME record and provisions TLS. No manual DNS setup needed.
- **Pages projects**: Custom domains are added via the Cloudflare API during the Setup Infrastructure workflow, or manually via **Pages → project → Custom domains → Set up a custom domain**. Cloudflare provisions the DNS record and TLS certificate automatically.

### Prerequisites

1. The zone `felix.co.ke` must be added to the same Cloudflare account and be in **Active** status.
2. The `CLOUDFLARE_API_TOKEN` must have **Zone → DNS → Edit** permission for this zone (required for Cloudflare to create CNAME records for custom domains).

### DNS records (auto-managed)

Cloudflare creates these automatically when custom domains are configured:

| Type | Name | Target |
|---|---|---|
| CNAME | `travel-apis` | `felix-travel-api.workers.dev` |
| CNAME | `travel` | `felix-travel-web-customer.pages.dev` |
| CNAME | `travel-dash` | `felix-travel-web-dashboard.pages.dev` |

---

## GitHub Actions Secrets

The CI/CD workflows require these secrets configured in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Used By | Description |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | `deploy-api.yml`, `deploy-web.yml` | Cloudflare API token (see permissions below). |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy-api.yml`, `deploy-web.yml` | Cloudflare account ID. Found in the dashboard URL or **Workers & Pages → Overview**. |
| `CF_D1_DATABASE_ID` | `deploy-api.yml` | D1 database ID for migration application. Found via `npx wrangler d1 list`. |
| `CF_PAGES_PROJECT_WEB_CUSTOMER` | `deploy-web.yml` | Cloudflare Pages project name for the customer web app. |
| `CF_PAGES_PROJECT_WEB_DASHBOARD` | `deploy-web.yml` | Cloudflare Pages project name for the dashboard web app. |

---

## Cloudflare API Token Permissions

Create a custom API token at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → **Custom token**.

The token used in CI (`CLOUDFLARE_API_TOKEN`) needs the following permissions:

### Required Permissions

| Resource | Permission | Reason |
|---|---|---|
| **Account → Workers Scripts** | Edit | Deploy the API worker via `wrangler deploy`. |
| **Account → Workers KV Storage** | Edit | Create and manage KV namespaces. |
| **Account → Workers R2 Storage** | Edit | Manage the media R2 bucket. |
| **Account → Workers Queues** | Edit | Create and manage queues. |
| **Account → D1** | Edit | Apply D1 database migrations. |
| **Account → Cloudflare Pages** | Edit | Deploy web-customer and web-dashboard via Pages. |

### Zone Scope

Required for custom domains (`travel.felix.co.ke`, `travel-dash.felix.co.ke`, `travel-apis.felix.co.ke`):

| Resource | Permission | Reason |
|---|---|---|
| **Zone → Workers Routes** | Edit | Bind the API worker to `travel-apis.felix.co.ke`. |
| **Zone → DNS** | Edit | Auto-create CNAME records for all custom domains. |

### Token Settings

- **Account Resources**: Include → Your account (or the specific account).
- **Zone Resources**: Include → `felix.co.ke` zone.
- **Client IP Address Filtering**: Optionally restrict to GitHub Actions IP ranges for added security.
- **TTL**: Set an expiration date and rotate regularly.

### Minimal Token (Worker Deploy Only)

If you only need to deploy the API worker (no Pages, no D1 migrations in CI):

| Resource | Permission |
|---|---|
| **Account → Workers Scripts** | Edit |
| **Account → Workers KV Storage** | Edit |
| **Account → Workers R2 Storage** | Edit |
| **Account → Workers Queues** | Edit |

---

## Automated Setup

### Option A: GitHub Actions Workflows (recommended)

The repository includes workflows that automate infrastructure provisioning and secret/variable management entirely within CI.

#### One-time infrastructure setup

Run the **Setup Infrastructure** workflow manually from GitHub → Actions → Setup Infrastructure → Run workflow:

- Creates all Cloudflare resources (D1 database, 8 KV namespaces, R2 bucket, 6 queues, 2 Pages projects)
- Sets worker **secrets** from GitHub Actions secrets
- Sets worker **variables** from GitHub Actions variables

**Prerequisites — set these in GitHub → Settings → Secrets and variables → Actions:**

| Type | Name | Description |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | API token with Workers + Pages permissions |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | CF account ID |
| Secret | `JWT_PRIVATE_KEY` | Base64-encoded RSA-2048 private key |
| Secret | `JWT_PUBLIC_KEY` | Base64-encoded RSA-2048 public key |
| Secret | `INTERNAL_EVENT_SIGNING_SECRET` | Queue message signing secret |
| Secret | `CSRF_SECRET` | CSRF protection secret |
| Secret | `ENCRYPTION_KEY` | AES-256 encryption key |
| Secret | `MFA_ENCRYPTION_KEY` | MFA encryption key |
| Secret | `TINGG_CLIENT_ID` | Tingg API client ID |
| Secret | `TINGG_CLIENT_SECRET` | Tingg API client secret |
| Secret | `TINGG_ENGAGE_USERNAME` | Tingg Engage SMS username |
| Secret | `TINGG_ENGAGE_PASSWORD` | Tingg Engage SMS password |
| Secret | `RESEND_API_KEY` | Resend email API key |
| Secret | `AT_API_KEY` | Africa's Talking API key |
| Secret | `AT_USERNAME` | Africa's Talking username |
| Secret | `SENTRY_DSN` | Sentry DSN for error tracking |
| Variable | `APP_ENV` | `production` / `staging` |
| Variable | `APP_NAME` | e.g. `Felix Travel` |
| Variable | `APP_BASE_URL` | e.g. `https://api.felix.travel` |
| Variable | `CUSTOMER_APP_URL` | e.g. `https://felix.travel` |
| Variable | `DASHBOARD_APP_URL` | e.g. `https://dashboard.felix.travel` |
| Variable | `API_BASE_URL` | e.g. `https://api.felix.travel` |
| Variable | `JWT_ISSUER` | JWT issuer URL |
| Variable | `JWT_AUDIENCE` | JWT audience string |

#### On every deploy

The **Deploy API** workflow (`.github/workflows/deploy-api.yml`) runs automatically on push to `main` and:

1. Applies D1 migrations
2. Syncs all worker secrets from GitHub Actions secrets
3. Deploys the worker with `wrangler deploy`

This ensures worker secrets stay in sync with GitHub — update a GH secret and the next deploy propagates it automatically.

### Option B: Local scripts

Two scripts automate provisioning from a local machine. They are idempotent — safe to re-run.

#### 1. Cloudflare Infrastructure + Secrets

Creates all Cloudflare resources, patches `wrangler.toml` with real resource IDs, and sets worker secrets:

```bash
cp .env.example .env.local   # then fill in real values
export ENV_FILE=.env.local

bash scripts/cf-setup.sh
# or for a specific wrangler environment:
bash scripts/cf-setup.sh --env production
# preview without changes:
bash scripts/cf-setup.sh --dry-run
```

The script will prompt for `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` if they are not already in the environment.

#### 2. GitHub Actions Secrets

Sets all CI/CD secrets in the GitHub repository via the `gh` CLI:

```bash
bash scripts/gh-secrets-setup.sh
```

The script prompts for Cloudflare credentials interactively (API token is hidden), resolves the D1 database ID automatically, then sets all five GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CF_D1_DATABASE_ID`
- `CF_PAGES_PROJECT_WEB_CUSTOMER`
- `CF_PAGES_PROJECT_WEB_DASHBOARD`

You can also pre-export the values to skip the prompts:

```bash
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="..."
bash scripts/gh-secrets-setup.sh
```
