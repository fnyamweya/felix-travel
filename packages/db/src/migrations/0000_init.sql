-- Felix Travel D1 Migration 0000 - Initial schema
-- Generated for Cloudflare D1 (SQLite dialect)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,
  role TEXT NOT NULL CHECK(role IN ('customer','agent','admin','service_provider')),
  is_active INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  date_of_birth TEXT,
  nationality TEXT,
  passport_number TEXT,
  bio TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  last_active_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS otp_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('phone_verification','login','payment_confirmation')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS otp_user_purpose_idx ON otp_verifications(user_id, purpose);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('agent','service_provider')),
  provider_id TEXT,
  invited_by_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS invites_token_idx ON invites(token_hash);
CREATE INDEX IF NOT EXISTS invites_email_idx ON invites(email);

CREATE TABLE IF NOT EXISTS service_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  country_code TEXT NOT NULL DEFAULT 'KE',
  currency_code TEXT NOT NULL DEFAULT 'KES',
  logo_url TEXT,
  website_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_verified INTEGER NOT NULL DEFAULT 0,
  reserve_balance_amount INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS service_providers_slug_idx ON service_providers(slug);

CREATE TABLE IF NOT EXISTS provider_memberships (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'staff' CHECK(member_role IN ('owner','manager','staff')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS provider_memberships_prov_user_idx ON provider_memberships(provider_id, user_id);

CREATE TABLE IF NOT EXISTS provider_settings (
  provider_id TEXT PRIMARY KEY REFERENCES service_providers(id) ON DELETE CASCADE,
  settlement_delay_days INTEGER,
  auto_approve_payout INTEGER NOT NULL DEFAULT 0,
  commission_bps INTEGER NOT NULL DEFAULT 1000,
  notify_on_booking INTEGER NOT NULL DEFAULT 1,
  notify_on_payout INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS provider_payout_accounts (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK(account_type IN ('mobile_money','bank_account','remittance')),
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  network_code TEXT NOT NULL,
  country_code TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_verified INTEGER NOT NULL DEFAULT 0,
  validation_snapshot TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS payout_accounts_provider_idx ON provider_payout_accounts(provider_id);

CREATE TABLE IF NOT EXISTS provider_callback_subscriptions (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  secret_hash TEXT NOT NULL,
  secret_hint TEXT NOT NULL,
  max_retries INTEGER NOT NULL DEFAULT 5,
  timeout_ms INTEGER NOT NULL DEFAULT 10000,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS callback_subs_provider_idx ON provider_callback_subscriptions(provider_id);

CREATE TABLE IF NOT EXISTS destinations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  country_code TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS destinations_slug_idx ON destinations(slug);

CREATE TABLE IF NOT EXISTS listing_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id TEXT,
  icon_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS listing_categories_slug_idx ON listing_categories(slug);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES service_providers(id),
  category_id TEXT NOT NULL REFERENCES listing_categories(id),
  destination_id TEXT NOT NULL REFERENCES destinations(id),
  type TEXT NOT NULL CHECK(type IN ('tour','hotel','rental','transfer','car','package')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_review','active','inactive','archived')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  short_description TEXT NOT NULL,
  description TEXT NOT NULL,
  cover_image_url TEXT,
  base_price_amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'KES',
  duration_minutes INTEGER,
  max_capacity INTEGER,
  min_guests INTEGER NOT NULL DEFAULT 1,
  is_instant_booking INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS listings_slug_idx ON listings(slug);
CREATE INDEX IF NOT EXISTS listings_provider_idx ON listings(provider_id);
CREATE INDEX IF NOT EXISTS listings_status_idx ON listings(status);
CREATE INDEX IF NOT EXISTS listings_destination_idx ON listings(destination_id);

CREATE TABLE IF NOT EXISTS amenities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  category TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS listing_amenities (
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  amenity_id TEXT NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (listing_id, amenity_id)
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('cover','gallery','document','avatar')),
  r2_key TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS media_assets_entity_idx ON media_assets(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  unit_type TEXT NOT NULL CHECK(unit_type IN ('per_person','per_group','per_night','per_day','per_vehicle','flat')),
  min_units INTEGER NOT NULL DEFAULT 1,
  max_units INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS pricing_rules_listing_idx ON pricing_rules(listing_id);

CREATE TABLE IF NOT EXISTS seasonal_rates (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  price_amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  is_multiplier INTEGER NOT NULL DEFAULT 0,
  multiplier REAL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blackout_dates (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS blackout_dates_listing_date_idx ON blackout_dates(listing_id, date);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  total_capacity INTEGER NOT NULL,
  booked_count INTEGER NOT NULL DEFAULT 0,
  remaining_capacity INTEGER NOT NULL,
  is_available INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_listing_date_idx ON inventory(listing_id, date);

CREATE TABLE IF NOT EXISTS booking_quotes (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id),
  listing_id TEXT NOT NULL REFERENCES listings(id),
  service_date TEXT NOT NULL,
  guest_count INTEGER NOT NULL,
  items_snapshot TEXT NOT NULL,
  subtotal_amount INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  converted_to_booking_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS booking_quotes_customer_idx ON booking_quotes(customer_id);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES users(id),
  agent_id TEXT REFERENCES users(id),
  provider_id TEXT NOT NULL REFERENCES service_providers(id),
  listing_id TEXT NOT NULL REFERENCES listings(id),
  quote_id TEXT REFERENCES booking_quotes(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','quoted','pending_payment','payment_processing','paid','confirmed','partially_refunded','refunded','cancelled','failed','payout_pending','payout_processing','payout_completed')),
  service_date TEXT NOT NULL,
  service_date_end TEXT,
  guest_count INTEGER NOT NULL,
  subtotal_amount INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  special_requests TEXT,
  internal_notes TEXT,
  cancellation_reason TEXT,
  expires_at TEXT,
  confirmed_at TEXT,
  cancelled_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_reference_idx ON bookings(reference);
CREATE INDEX IF NOT EXISTS bookings_customer_idx ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS bookings_provider_idx ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);
CREATE INDEX IF NOT EXISTS bookings_service_date_idx ON bookings(service_date);

CREATE TABLE IF NOT EXISTS booking_items (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  pricing_rule_id TEXT REFERENCES pricing_rules(id),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  provider_id TEXT NOT NULL REFERENCES service_providers(id),
  provider_payable_amount INTEGER NOT NULL,
  platform_commission_amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS booking_items_booking_idx ON booking_items(booking_id);

CREATE TABLE IF NOT EXISTS travelers (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT,
  passport_number TEXT,
  nationality TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS travelers_booking_idx ON travelers(booking_id);

CREATE TABLE IF NOT EXISTS booking_status_history (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS booking_status_history_booking_idx ON booking_status_history(booking_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  customer_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK(status IN ('initiated','pending_customer_action','pending_provider','processing','succeeded','partially_refunded','refunded','failed','reversed')),
  method TEXT,
  amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  tingg_checkout_request_id TEXT,
  tingg_merchant_tx_id TEXT,
  tingg_transaction_ref TEXT,
  checkout_url TEXT,
  idempotency_key TEXT NOT NULL,
  paid_at TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS payments_tingg_merchant_idx ON payments(tingg_merchant_tx_id);
CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments(booking_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
CREATE INDEX IF NOT EXISTS payments_tingg_checkout_idx ON payments(tingg_checkout_request_id);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  tingg_request_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','succeeded','failed')),
  request_payload TEXT NOT NULL,
  response_payload TEXT,
  error_message TEXT,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_idempotency_idx ON payment_attempts(idempotency_key);

CREATE TABLE IF NOT EXISTS payment_webhooks (
  id TEXT PRIMARY KEY,
  tingg_event_id TEXT,
  payment_id TEXT REFERENCES payments(id),
  raw_payload TEXT NOT NULL,
  processed_status TEXT NOT NULL DEFAULT 'pending' CHECK(processed_status IN ('pending','processed','failed','duplicate')),
  processing_error TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS payment_webhooks_tingg_event_idx ON payment_webhooks(tingg_event_id);
CREATE INDEX IF NOT EXISTS payment_webhooks_payment_idx ON payment_webhooks(payment_id);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  requested_by TEXT NOT NULL REFERENCES users(id),
  approved_by TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK(status IN ('pending_approval','approved','processing','succeeded','failed','rejected')),
  reason TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  tingg_refund_ref TEXT,
  idempotency_key TEXT NOT NULL,
  refunded_at TEXT,
  rejected_at TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS refunds_payment_idx ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS refunds_booking_idx ON refunds(booking_id);
CREATE INDEX IF NOT EXISTS refunds_status_idx ON refunds(status);

CREATE TABLE IF NOT EXISTS refund_items (
  id TEXT PRIMARY KEY,
  refund_id TEXT NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  booking_item_id TEXT NOT NULL REFERENCES booking_items(id),
  amount INTEGER NOT NULL,
  provider_deduction INTEGER NOT NULL,
  platform_deduction INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS refund_items_refund_idx ON refund_items(refund_id);

CREATE TABLE IF NOT EXISTS payout_batches (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','processing','completed','failed')),
  total_amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  payout_count INTEGER NOT NULL DEFAULT 0,
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES service_providers(id),
  payout_account_id TEXT NOT NULL REFERENCES provider_payout_accounts(id),
  batch_id TEXT REFERENCES payout_batches(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','scheduled','processing','succeeded','failed','reversed','on_hold')),
  amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  destination_amount INTEGER,
  destination_currency TEXT,
  fx_rate_snapshot REAL,
  tingg_payment_ref TEXT,
  tingg_transaction_ref TEXT,
  idempotency_key TEXT NOT NULL,
  hold_reason TEXT,
  failure_reason TEXT,
  scheduled_at TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS payouts_idempotency_idx ON payouts(idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS payouts_tingg_payment_idx ON payouts(tingg_payment_ref);
CREATE INDEX IF NOT EXISTS payouts_provider_idx ON payouts(provider_id);
CREATE INDEX IF NOT EXISTS payouts_status_idx ON payouts(status);

CREATE TABLE IF NOT EXISTS payout_booking_links (
  id TEXT PRIMARY KEY,
  payout_id TEXT NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS payout_booking_links_unique ON payout_booking_links(payout_id, booking_id);

CREATE TABLE IF NOT EXISTS payout_webhooks (
  id TEXT PRIMARY KEY,
  tingg_event_id TEXT,
  payout_id TEXT REFERENCES payouts(id),
  raw_payload TEXT NOT NULL,
  processed_status TEXT NOT NULL DEFAULT 'pending' CHECK(processed_status IN ('pending','processed','failed','duplicate')),
  processing_error TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS payout_webhooks_payout_idx ON payout_webhooks(payout_id);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('asset','liability','equity','revenue','expense')),
  provider_id TEXT REFERENCES service_providers(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_accounts_code_provider_idx ON ledger_accounts(code, provider_id);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  reference_type TEXT NOT NULL CHECK(reference_type IN ('booking','payment','refund','payout','manual')),
  reference_id TEXT NOT NULL,
  description TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ledger_entries_reference_idx ON ledger_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS ledger_entries_effective_date_idx ON ledger_entries(effective_date);

CREATE TABLE IF NOT EXISTS ledger_entry_lines (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES ledger_entries(id),
  account_id TEXT NOT NULL REFERENCES ledger_accounts(id),
  debit_amount INTEGER NOT NULL DEFAULT 0,
  credit_amount INTEGER NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ledger_entry_lines_entry_idx ON ledger_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS ledger_entry_lines_account_idx ON ledger_entry_lines(account_id);

CREATE TABLE IF NOT EXISTS commissions (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  booking_item_id TEXT,
  provider_id TEXT NOT NULL REFERENCES service_providers(id),
  rate_bps INTEGER NOT NULL,
  base_amount INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','earned','reversed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS commissions_booking_idx ON commissions(booking_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('email','sms','push','in_app')),
  subject TEXT,
  body TEXT NOT NULL,
  metadata TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT,
  read_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed')),
  reconciliation_type TEXT NOT NULL CHECK(reconciliation_type IN ('payments','payouts')),
  records_checked INTEGER NOT NULL DEFAULT 0,
  discrepancies_found INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS reconciliation_discrepancies (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES reconciliation_runs(id),
  type TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('payment','payout')),
  entity_id TEXT NOT NULL,
  internal_amount INTEGER,
  external_amount INTEGER,
  internal_status TEXT,
  external_status TEXT,
  notes TEXT,
  resolved_by TEXT REFERENCES users(id),
  resolved_at TEXT,
  resolution TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS recon_discrepancies_run_idx ON reconciliation_discrepancies(run_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES provider_callback_subscriptions(id),
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','delivered','failed','retrying')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  next_retry_at TEXT,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_subscription_idx ON webhook_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_status_idx ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS webhook_deliveries_next_retry_idx ON webhook_deliveries(next_retry_at);
