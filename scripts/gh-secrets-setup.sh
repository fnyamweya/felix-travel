#!/usr/bin/env bash
# ============================================================
# Felix Travel — GitHub Actions Secrets Setup
# ============================================================
#
# Sets all required GitHub Actions secrets for CI/CD using the
# gh CLI. Run after cf-setup.sh to use the resource IDs it created.
#
# Prerequisites:
#   - gh CLI authenticated (gh auth login)
#   - D1 database already created (run cf-setup.sh first)
#
# Credentials are read from environment variables or prompted
# interactively if not set.
#
# Usage:
#   bash scripts/gh-secrets-setup.sh
# ============================================================
set -euo pipefail

log()  { printf "\033[1;34m▸ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m⚠ %s\033[0m\n" "$*"; }
err()  { printf "\033[1;31m✗ %s\033[0m\n" "$*" >&2; }

prompt_if_missing() {
  local var_name="$1"
  local prompt_text="$2"
  local is_secret="${3:-false}"

  if [[ -n "${!var_name:-}" ]]; then
    return
  fi

  if [[ -t 0 ]]; then
    if [[ "$is_secret" == "true" ]]; then
      read -rsp "$prompt_text: " "$var_name"
      echo
    else
      read -rp "$prompt_text: " "$var_name"
    fi
    export "$var_name=${!var_name}"
  else
    err "$var_name is not set and stdin is not a terminal."
    exit 1
  fi
}

# -----------------------------------------------------------
# Pre-flight
# -----------------------------------------------------------
if ! command -v gh &>/dev/null; then
  err "gh CLI not found. Install: https://cli.github.com"
  exit 1
fi

prompt_if_missing CLOUDFLARE_API_TOKEN "Enter Cloudflare API token" true
prompt_if_missing CLOUDFLARE_ACCOUNT_ID "Enter Cloudflare account ID" false

# -----------------------------------------------------------
# Resolve D1 database ID
# -----------------------------------------------------------
if [[ -n "${CF_D1_DATABASE_ID:-}" ]]; then
  D1_ID="$CF_D1_DATABASE_ID"
else
  log "Looking up D1 database ID for felix-travel-db..."
  D1_ID=$(npx wrangler d1 list 2>/dev/null | grep felix-travel-db | awk '{print $1}' || true)
  if [[ -z "$D1_ID" ]]; then
    err "Could not find D1 database felix-travel-db. Run cf-setup.sh first."
    exit 1
  fi
fi

# -----------------------------------------------------------
# Pages project names
# -----------------------------------------------------------
CF_PAGES_PROJECT_WEB_CUSTOMER="${CF_PAGES_PROJECT_WEB_CUSTOMER:-felix-travel-web-customer}"
CF_PAGES_PROJECT_WEB_DASHBOARD="${CF_PAGES_PROJECT_WEB_DASHBOARD:-felix-travel-web-dashboard}"

# -----------------------------------------------------------
# Set secrets
# -----------------------------------------------------------
SECRETS=(
  "CLOUDFLARE_API_TOKEN:$CLOUDFLARE_API_TOKEN"
  "CLOUDFLARE_ACCOUNT_ID:$CLOUDFLARE_ACCOUNT_ID"
  "CF_D1_DATABASE_ID:$D1_ID"
  "CF_PAGES_PROJECT_WEB_CUSTOMER:$CF_PAGES_PROJECT_WEB_CUSTOMER"
  "CF_PAGES_PROJECT_WEB_DASHBOARD:$CF_PAGES_PROJECT_WEB_DASHBOARD"
)

for ENTRY in "${SECRETS[@]}"; do
  SECRET_NAME="${ENTRY%%:*}"
  SECRET_VALUE="${ENTRY#*:}"
  log "Setting GitHub secret: $SECRET_NAME"
  echo "$SECRET_VALUE" | gh secret set "$SECRET_NAME"
  ok "Set: $SECRET_NAME"
done

echo ""
ok "All GitHub Actions secrets configured."
echo ""
echo "Verify with: gh secret list"
