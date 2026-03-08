#!/usr/bin/env bash
# ============================================================
# Felix Travel — Cloudflare Infrastructure Setup
# ============================================================
#
# Creates all Cloudflare resources (D1, KV, R2, Queues, Pages),
# patches wrangler.toml with real IDs, and sets worker secrets.
#
# Prerequisites:
#   - wrangler CLI installed (npx wrangler)
#   - gh CLI authenticated (gh auth login)
#   - .env.local (or .env) with secret values (see .env.example)
#
# CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are read from
# GitHub secrets via `gh secret`, environment variables, or
# interactive prompt (in that order).
#
# Usage:
#   bash scripts/cf-setup.sh [--env production]
#
# Options:
#   --env <name>    Wrangler environment to use (default: none / top-level)
#   --dry-run       Print what would be done without making changes
#   --skip-secrets  Skip setting worker secrets
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WRANGLER_TOML="$ROOT_DIR/apps/api-edge/wrangler.toml"
ENV_FILE="${ENV_FILE:-.env.local}"
WRANGLER_ENV=""
DRY_RUN=false
SKIP_SECRETS=false

# -----------------------------------------------------------
# Parse arguments
# -----------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) WRANGLER_ENV="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --skip-secrets) SKIP_SECRETS=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

ENV_FLAG=""
if [[ -n "$WRANGLER_ENV" ]]; then
  ENV_FLAG="--env $WRANGLER_ENV"
fi

# -----------------------------------------------------------
# Helpers
# -----------------------------------------------------------
log()  { printf "\033[1;34m▸ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m⚠ %s\033[0m\n" "$*"; }
err()  { printf "\033[1;31m✗ %s\033[0m\n" "$*" >&2; }

run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

require_var() {
  if [[ -z "${!1:-}" ]]; then
    err "Required env var $1 is not set. Export it or add it to $ENV_FILE."
    exit 1
  fi
}

# -----------------------------------------------------------
# Resolve credentials: env var → gh secret → interactive prompt
# -----------------------------------------------------------
resolve_credential() {
  local var_name="$1"
  local prompt_text="$2"
  local is_secret="${3:-true}"

  # Already in environment
  if [[ -n "${!var_name:-}" ]]; then
    return
  fi

  # Try reading from gh variable (non-secrets) or prompt
  if [[ "$is_secret" == "false" ]] && command -v gh &>/dev/null; then
    local gh_val
    gh_val=$(gh variable get "$var_name" 2>/dev/null || true)
    if [[ -n "$gh_val" ]]; then
      export "$var_name=$gh_val"
      log "Loaded $var_name from GitHub variables"
      return
    fi
  fi

  # Interactive prompt
  if [[ -t 0 ]]; then
    if [[ "$is_secret" == "true" ]]; then
      read -rsp "$prompt_text: " "$var_name"
      echo
    else
      read -rp "$prompt_text: " "$var_name"
    fi
    export "$var_name=${!var_name}"
  else
    err "$var_name is not set and stdin is not a terminal. Export it or set it as a GitHub secret."
    exit 1
  fi
}

# -----------------------------------------------------------
# Pre-flight checks
# -----------------------------------------------------------
if ! command -v npx &>/dev/null; then
  err "npx not found. Install Node.js and pnpm first."
  exit 1
fi

resolve_credential CLOUDFLARE_API_TOKEN "Enter Cloudflare API token" true
resolve_credential CLOUDFLARE_ACCOUNT_ID "Enter Cloudflare account ID" false

log "Cloudflare account: $CLOUDFLARE_ACCOUNT_ID"
log "Wrangler toml:      $WRANGLER_TOML"
[[ -n "$WRANGLER_ENV" ]] && log "Wrangler env: $WRANGLER_ENV"

# -----------------------------------------------------------
# Load env file for secrets (if present)
# -----------------------------------------------------------
if [[ -f "$ROOT_DIR/$ENV_FILE" ]]; then
  log "Loading secrets from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_DIR/$ENV_FILE"
  set +a
else
  warn "$ENV_FILE not found — secrets must be exported in the shell"
fi

# ============================================================
# 1. D1 Database
# ============================================================
log "Creating D1 database: felix-travel-db"
D1_OUTPUT=$(npx wrangler d1 create felix-travel-db 2>&1 || true)

if echo "$D1_OUTPUT" | grep -q "already exists"; then
  warn "D1 database felix-travel-db already exists"
  D1_ID=$(npx wrangler d1 list --json 2>/dev/null | grep -o '"uuid":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
  if [[ -z "$D1_ID" ]]; then
    D1_ID=$(npx wrangler d1 list 2>/dev/null | grep felix-travel-db | awk '{print $1}' || true)
  fi
else
  D1_ID=$(echo "$D1_OUTPUT" | grep -oP 'database_id\s*=\s*"\K[^"]+' || true)
  if [[ -z "$D1_ID" ]]; then
    D1_ID=$(echo "$D1_OUTPUT" | grep -oP '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1 || true)
  fi
fi

if [[ -n "$D1_ID" ]]; then
  ok "D1 database ID: $D1_ID"
  run sed -i "s/database_id = \"YOUR_D1_DATABASE_ID\"/database_id = \"$D1_ID\"/" "$WRANGLER_TOML"
else
  err "Could not extract D1 database ID. Set it manually in wrangler.toml."
fi

# ============================================================
# 2. KV Namespaces
# ============================================================
KV_NAMESPACES=(
  "CACHE_KV"
  "IDEMPOTENCY_KV"
  "TOKEN_CACHE_KV"
  "REPLAY_PROTECTION_KV"
  "RATE_LIMIT_KV"
  "POLICY_CACHE_KV"
  "TRUSTED_DEVICE_KV"
  "RISK_CACHE_KV"
)

for KV_NAME in "${KV_NAMESPACES[@]}"; do
  TITLE="felix-travel-${KV_NAME//_/-}"
  TITLE=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]')
  log "Creating KV namespace: $TITLE"

  KV_OUTPUT=$(npx wrangler kv namespace create "$KV_NAME" $ENV_FLAG 2>&1 || true)

  if echo "$KV_OUTPUT" | grep -q "already exists"; then
    warn "KV namespace $TITLE already exists"
    KV_ID=$(npx wrangler kv namespace list 2>/dev/null | grep -B2 "$KV_NAME" | grep -oP '[0-9a-f]{32}' | head -1 || true)
  else
    KV_ID=$(echo "$KV_OUTPUT" | grep -oP 'id\s*=\s*"\K[^"]+' || true)
    if [[ -z "$KV_ID" ]]; then
      KV_ID=$(echo "$KV_OUTPUT" | grep -oP '[0-9a-f]{32}' | head -1 || true)
    fi
  fi

  PLACEHOLDER="YOUR_${KV_NAME}_ID"
  if [[ -n "$KV_ID" ]]; then
    ok "$KV_NAME ID: $KV_ID"
    run sed -i "s/id = \"$PLACEHOLDER\"/id = \"$KV_ID\"/" "$WRANGLER_TOML"
  else
    err "Could not extract KV ID for $KV_NAME. Set $PLACEHOLDER manually."
  fi
done

# ============================================================
# 3. R2 Bucket
# ============================================================
log "Creating R2 bucket: felix-travel-media"
R2_OUTPUT=$(npx wrangler r2 bucket create felix-travel-media 2>&1 || true)

if echo "$R2_OUTPUT" | grep -q "already exists"; then
  warn "R2 bucket felix-travel-media already exists"
else
  ok "R2 bucket created: felix-travel-media"
fi

# ============================================================
# 4. Queues
# ============================================================
QUEUES=(
  "felix-travel-outbound-webhooks"
  "felix-travel-reconciliation"
  "felix-travel-notifications"
  "felix-travel-approval"
  "felix-travel-payment"
  "felix-travel-payout"
)

for Q_NAME in "${QUEUES[@]}"; do
  log "Creating queue: $Q_NAME"
  Q_OUTPUT=$(npx wrangler queues create "$Q_NAME" 2>&1 || true)

  if echo "$Q_OUTPUT" | grep -q "already exists"; then
    warn "Queue $Q_NAME already exists"
  else
    ok "Queue created: $Q_NAME"
  fi
done

# ============================================================
# 5. Cloudflare Pages Projects
# ============================================================
PAGES_PROJECTS=(
  "felix-travel-web-customer"
  "felix-travel-web-dashboard"
)

for PJ_NAME in "${PAGES_PROJECTS[@]}"; do
  log "Creating Pages project: $PJ_NAME"
  PJ_OUTPUT=$(npx wrangler pages project create "$PJ_NAME" --production-branch main 2>&1 || true)

  if echo "$PJ_OUTPUT" | grep -qi "already exists\|duplicate"; then
    warn "Pages project $PJ_NAME already exists"
  else
    ok "Pages project created: $PJ_NAME"
  fi
done

# ============================================================
# 6. Worker Secrets
# ============================================================
if [[ "$SKIP_SECRETS" == "true" ]]; then
  warn "Skipping secrets (--skip-secrets)"
else
  log "Setting worker secrets for felix-travel-api"

  # Secrets that must be set (not in [vars])
  SECRETS=(
    JWT_PRIVATE_KEY
    JWT_PUBLIC_KEY
    INTERNAL_EVENT_SIGNING_SECRET
    CSRF_SECRET
    ENCRYPTION_KEY
    TINGG_CLIENT_ID
    TINGG_CLIENT_SECRET
    TINGG_ENGAGE_USERNAME
    TINGG_ENGAGE_PASSWORD
  )

  # Optional secrets — only set if present in env
  OPTIONAL_SECRETS=(
    MFA_ENCRYPTION_KEY
    RESEND_API_KEY
    AT_API_KEY
    AT_USERNAME
    SENTRY_DSN
  )

  for SECRET_NAME in "${SECRETS[@]}"; do
    if [[ -z "${!SECRET_NAME:-}" ]]; then
      err "Secret $SECRET_NAME is not set. Skipping."
      continue
    fi
    log "Setting secret: $SECRET_NAME"
    run bash -c "echo '${!SECRET_NAME}' | npx wrangler secret put $SECRET_NAME $ENV_FLAG 2>&1"
    ok "Secret set: $SECRET_NAME"
  done

  for SECRET_NAME in "${OPTIONAL_SECRETS[@]}"; do
    if [[ -z "${!SECRET_NAME:-}" ]]; then
      warn "Optional secret $SECRET_NAME is not set. Skipping."
      continue
    fi
    log "Setting secret: $SECRET_NAME"
    run bash -c "echo '${!SECRET_NAME}' | npx wrangler secret put $SECRET_NAME $ENV_FLAG 2>&1"
    ok "Secret set: $SECRET_NAME"
  done
fi

# ============================================================
# 7. Worker Variables (non-secret env vars)
# ============================================================
log "Setting worker variables via wrangler.toml [vars]"

# Variables that should be set per-environment but aren't secrets.
# These are written to wrangler.toml if overrides are provided.
VARS_TO_SET=(
  APP_ENV
  APP_NAME
  APP_BASE_URL
  CUSTOMER_APP_URL
  DASHBOARD_APP_URL
  API_BASE_URL
  DEFAULT_TIMEZONE
  DEFAULT_CURRENCY
  PLATFORM_COUNTRY_CODE
  JWT_ISSUER
  JWT_AUDIENCE
  JWT_ACCESS_TTL_SECONDS
  JWT_REFRESH_TTL_SECONDS
  SESSION_COOKIE_NAME
  SESSION_COOKIE_SECURE
  SESSION_COOKIE_DOMAIN
  MAGIC_LINK_TTL_MINUTES
  PASSWORD_RESET_TTL_MINUTES
  OTP_TTL_MINUTES
  PASSWORD_HASH_COST
  HMAC_WEBHOOK_SIGNING_ALGO
  AUDIT_LOG_RETENTION_DAYS
  EMAIL_PROVIDER
  EMAIL_FROM
  SMS_PROVIDER
  SMS_SENDER_ID
  TINGG_ENVIRONMENT
  TINGG_BASE_URL
  TINGG_SERVICE_CODE
  TINGG_PAYOUT_SERVICE_CODE
  TINGG_COLLECTION_COUNTRY_CODE
  TINGG_COLLECTION_CURRENCY_CODE
  TINGG_CALLBACK_CHECKOUT_URL
  TINGG_CALLBACK_PAYOUT_URL
  TINGG_SUCCESS_REDIRECT_URL
  TINGG_FAIL_REDIRECT_URL
  TINGG_TOKEN_CACHE_TTL_SECONDS
  TINGG_HTTP_TIMEOUT_MS
  TINGG_MAX_RETRIES
  TINGG_ENGAGE_BASE_URL
  TINGG_ENGAGE_SENDER_ID
  R2_PUBLIC_BASE_URL
  MEDIA_MAX_UPLOAD_MB
  MEDIA_ALLOWED_MIME_TYPES
  LOG_LEVEL
  ENABLE_REQUEST_LOGGING
  ENABLE_SQL_LOGGING
  FEATURE_ENABLE_CROSS_BORDER_PAYOUTS
  FEATURE_ENABLE_PROVIDER_CALLBACKS
  FEATURE_ENABLE_AGENT_QUOTES
  FEATURE_ENABLE_CARD_PAYMENTS
  FEATURE_ENABLE_EMAIL_NOTIFICATIONS
  FEATURE_ENABLE_SMS_NOTIFICATIONS
  DEFAULT_SETTLEMENT_DELAY_DAYS
  REFUND_APPROVAL_THRESHOLD
  PAYOUT_APPROVAL_THRESHOLD
  MAX_IDEMPOTENCY_TTL_HOURS
  MAX_WEBHOOK_RETRY_ATTEMPTS
  PROVIDER_CALLBACK_TIMEOUT_MS
  ENABLE_EMAIL_LOGIN
  ENABLE_PHONE_LOGIN
  ENABLE_MAGIC_LINK_LOGIN
  ENABLE_PHONE_OTP_LOGIN
  ENABLE_TOTP_MFA
  ENABLE_SMS_MFA
  MFA_REQUIRED_FOR_PRIVILEGED_ROLES
  TRUSTED_DEVICE_TTL_DAYS
  PHONE_VERIFICATION_TTL_MINUTES
  STEP_UP_CHALLENGE_TTL_MINUTES
  MFA_RECOVERY_CODE_COUNT
  RISK_ENGINE_ENABLED
  RISK_SCORE_STEP_UP_SMS_THRESHOLD
  RISK_SCORE_STEP_UP_TOTP_THRESHOLD
  RISK_SCORE_MANUAL_REVIEW_THRESHOLD
  RISK_SCORE_DENY_THRESHOLD
  SENTRY_ENVIRONMENT
  SENTRY_TRACES_SAMPLE_RATE
  OTEL_EXPORT_ENABLED
  OTEL_SERVICE_NAME
  OTEL_SERVICE_VERSION
)

# Build JSON for bulk vars put
VARS_JSON="{"
FIRST=true
for VAR_NAME in "${VARS_TO_SET[@]}"; do
  if [[ -n "${!VAR_NAME:-}" ]]; then
    if [[ "$FIRST" == "true" ]]; then
      FIRST=false
    else
      VARS_JSON+=","
    fi
    # Escape quotes in value
    VAL="${!VAR_NAME//\"/\\\"}"
    VARS_JSON+="\"$VAR_NAME\":\"$VAL\""
  fi
done
VARS_JSON+="}"

if [[ "$VARS_JSON" != "{}" ]]; then
  VARS_FILE=$(mktemp)
  echo "$VARS_JSON" > "$VARS_FILE"
  log "Uploading $(echo "$VARS_JSON" | grep -o '"' | wc -l | awk '{print $1/4}' | cut -d. -f1) variables via wrangler vars"
  run npx wrangler vars set --var-file "$VARS_FILE" $ENV_FLAG 2>&1 || {
    # Fallback: set vars individually if bulk put isn't supported
    warn "Bulk vars set not supported, falling back to individual puts"
    for VAR_NAME in "${VARS_TO_SET[@]}"; do
      if [[ -n "${!VAR_NAME:-}" ]]; then
        run npx wrangler vars set "$VAR_NAME" "${!VAR_NAME}" $ENV_FLAG 2>&1 || true
      fi
    done
  }
  rm -f "$VARS_FILE"
  ok "Variables configured"
else
  warn "No variables found in environment to set"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo "============================================================"
echo " Setup complete!"
echo "============================================================"
echo ""
echo "Resource IDs have been patched into wrangler.toml."
echo "Review the changes: git diff apps/api-edge/wrangler.toml"
echo ""
echo "Next steps:"
echo "  1. Review wrangler.toml for correct resource IDs"
echo "  2. Apply D1 migrations:"
echo "       cd apps/api-edge && npx wrangler d1 migrations apply felix-travel-db --remote"
echo "  3. Deploy the worker:"
echo "       cd apps/api-edge && npx wrangler deploy"
echo "  4. Set GitHub Actions secrets:"
echo "       gh secret set CLOUDFLARE_API_TOKEN --body \"\$CLOUDFLARE_API_TOKEN\""
echo "       gh secret set CLOUDFLARE_ACCOUNT_ID --body \"\$CLOUDFLARE_ACCOUNT_ID\""
echo "       gh secret set CF_D1_DATABASE_ID --body \"$D1_ID\""
echo "       gh secret set CF_PAGES_PROJECT_WEB_CUSTOMER --body \"felix-travel-web-customer\""
echo "       gh secret set CF_PAGES_PROJECT_WEB_DASHBOARD --body \"felix-travel-web-dashboard\""
echo ""
