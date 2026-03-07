-- Migration 0001: Charge Engine Tables
-- Adds the full charge engine schema: definitions, rule sets, rules, dependencies,
-- rate versions, tax codes, jurisdiction profiles, and all charge line tables.

-- ── Charge Definitions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charge_definitions (
  id                        TEXT    NOT NULL PRIMARY KEY,
  code                      TEXT    NOT NULL,
  name                      TEXT    NOT NULL,
  description               TEXT,
  category                  TEXT    NOT NULL CHECK (category IN ('commission','tax','duty','fee','levy','surcharge','discount','withholding','fx','adjustment')),
  scope                     TEXT    NOT NULL CHECK (scope IN ('booking_level','booking_item_level','payment_level','refund_level','payout_level','commission_level','settlement_level')),
  payer                     TEXT    NOT NULL CHECK (payer IN ('customer','provider','platform')),
  beneficiary               TEXT    NOT NULL CHECK (beneficiary IN ('platform','government','provider','customer')),
  base_type                 TEXT    NOT NULL CHECK (base_type IN ('booking_subtotal','item_subtotal','commission_amount','payout_amount','payment_amount','another_charge','manual')),
  calc_method               TEXT    NOT NULL CHECK (calc_method IN ('fixed','percentage','percentage_of_charge','tiered_percentage','formula','minimum_capped','maximum_capped','inclusive_tax','exclusive_tax')),
  calc_priority             INTEGER NOT NULL DEFAULT 100,
  is_taxable                INTEGER NOT NULL DEFAULT 0 CHECK (is_taxable IN (0, 1)),
  is_recoverable            INTEGER NOT NULL DEFAULT 0 CHECK (is_recoverable IN (0, 1)),
  refund_behavior           TEXT    NOT NULL DEFAULT 'fully_refundable' CHECK (refund_behavior IN ('fully_refundable','proportionally_refundable','non_refundable','refundable_before_service_only','refundable_before_payout_only','manual_review_required')),
  ledger_debit_account_code TEXT,
  ledger_credit_account_code TEXT,
  effective_from            TEXT    NOT NULL,
  effective_to              TEXT,
  jurisdiction_metadata     TEXT,
  is_enabled                INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  requires_approval         INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0, 1)),
  created_by                TEXT    NOT NULL REFERENCES users(id),
  created_at                TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS charge_definitions_code_idx        ON charge_definitions (code);
CREATE        INDEX IF NOT EXISTS charge_definitions_category_idx     ON charge_definitions (category);
CREATE        INDEX IF NOT EXISTS charge_definitions_scope_idx        ON charge_definitions (scope);
CREATE        INDEX IF NOT EXISTS charge_definitions_enabled_idx      ON charge_definitions (is_enabled);

-- ── Charge Rule Sets ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charge_rule_sets (
  id                    TEXT    NOT NULL PRIMARY KEY,
  charge_definition_id  TEXT    NOT NULL REFERENCES charge_definitions(id),
  name                  TEXT    NOT NULL,
  jurisdiction_country  TEXT,
  jurisdiction_region   TEXT,
  provider_id           TEXT    REFERENCES service_providers(id),
  listing_category      TEXT,
  min_booking_amount    INTEGER,
  max_booking_amount    INTEGER,
  is_active             INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  priority              INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS charge_rule_sets_definition_idx    ON charge_rule_sets (charge_definition_id);
CREATE INDEX IF NOT EXISTS charge_rule_sets_jurisdiction_idx  ON charge_rule_sets (jurisdiction_country, jurisdiction_region);
CREATE INDEX IF NOT EXISTS charge_rule_sets_provider_idx      ON charge_rule_sets (provider_id);

-- ── Charge Rules ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charge_rules (
  id            TEXT    NOT NULL PRIMARY KEY,
  rule_set_id   TEXT    NOT NULL REFERENCES charge_rule_sets(id),
  calc_method   TEXT    NOT NULL CHECK (calc_method IN ('fixed','percentage','percentage_of_charge','tiered_percentage','formula','minimum_capped','maximum_capped','inclusive_tax','exclusive_tax')),
  rate_bps      INTEGER,
  fixed_amount  INTEGER,
  currency_code TEXT,
  min_amount    INTEGER,
  max_amount    INTEGER,
  formula       TEXT,
  tiered_config TEXT,
  conditions    TEXT,
  is_inclusive  INTEGER NOT NULL DEFAULT 0 CHECK (is_inclusive IN (0, 1)),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  effective_from TEXT   NOT NULL,
  effective_to  TEXT,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS charge_rules_rule_set_idx ON charge_rules (rule_set_id);
CREATE INDEX IF NOT EXISTS charge_rules_active_idx   ON charge_rules (is_active);

-- ── Charge Dependencies ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charge_dependencies (
  id                    TEXT NOT NULL PRIMARY KEY,
  dependent_charge_id   TEXT NOT NULL REFERENCES charge_definitions(id),
  depends_on_charge_id  TEXT NOT NULL REFERENCES charge_definitions(id),
  dependency_type       TEXT NOT NULL CHECK (dependency_type IN ('base_of','after','exclusive')),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (dependent_charge_id, depends_on_charge_id)
);

CREATE INDEX IF NOT EXISTS charge_dependencies_dependent_idx  ON charge_dependencies (dependent_charge_id);
CREATE INDEX IF NOT EXISTS charge_dependencies_depends_on_idx ON charge_dependencies (depends_on_charge_id);

-- ── Charge Rate Versions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charge_rate_versions (
  id                    TEXT    NOT NULL PRIMARY KEY,
  charge_rule_id        TEXT    NOT NULL REFERENCES charge_rules(id),
  previous_rate_bps     INTEGER,
  new_rate_bps          INTEGER,
  previous_fixed_amount INTEGER,
  new_fixed_amount      INTEGER,
  changed_by            TEXT    NOT NULL REFERENCES users(id),
  change_reason         TEXT,
  approval_record_id    TEXT,
  effective_from        TEXT    NOT NULL,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS charge_rate_versions_rule_idx      ON charge_rate_versions (charge_rule_id);
CREATE INDEX IF NOT EXISTS charge_rate_versions_effective_idx ON charge_rate_versions (effective_from);

-- ── Tax Codes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_codes (
  id                    TEXT    NOT NULL PRIMARY KEY,
  code                  TEXT    NOT NULL,
  name                  TEXT    NOT NULL,
  jurisdiction_country  TEXT    NOT NULL,
  jurisdiction_region   TEXT,
  rate_bps              INTEGER NOT NULL,
  applies_to            TEXT    NOT NULL CHECK (applies_to IN ('commission','booking','service','all')),
  is_active             INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  effective_from        TEXT    NOT NULL,
  effective_to          TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS tax_codes_code_country_idx ON tax_codes (code, jurisdiction_country);
CREATE        INDEX IF NOT EXISTS tax_codes_country_idx      ON tax_codes (jurisdiction_country);

-- ── Jurisdiction Profiles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jurisdiction_profiles (
  id                              TEXT    NOT NULL PRIMARY KEY,
  country_code                    TEXT    NOT NULL,
  region                          TEXT,
  name                            TEXT    NOT NULL,
  currency_code                   TEXT    NOT NULL,
  applicable_tax_codes            TEXT,
  applicable_charge_definitions   TEXT,
  withholding_tax_bps             INTEGER,
  stamp_duty_bps                  INTEGER,
  tourism_levy_bps                INTEGER,
  is_active                       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at                      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at                      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (country_code, region)
);

CREATE INDEX IF NOT EXISTS jurisdiction_profiles_active_idx ON jurisdiction_profiles (is_active);

-- ── Booking Charge Lines ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_charge_lines (
  id                    TEXT    NOT NULL PRIMARY KEY,
  booking_id            TEXT    NOT NULL REFERENCES bookings(id),
  booking_item_id       TEXT    REFERENCES booking_items(id),
  charge_definition_id  TEXT    NOT NULL REFERENCES charge_definitions(id),
  charge_rule_id        TEXT    REFERENCES charge_rules(id),
  jurisdiction_country  TEXT,
  scope                 TEXT    NOT NULL,
  payer                 TEXT    NOT NULL,
  beneficiary           TEXT    NOT NULL,
  base_amount           INTEGER NOT NULL,
  rate_bps              INTEGER,
  fixed_amount          INTEGER,
  charge_amount         INTEGER NOT NULL,
  currency_code         TEXT    NOT NULL,
  is_inclusive          INTEGER NOT NULL DEFAULT 0 CHECK (is_inclusive IN (0, 1)),
  is_void               INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  timing                TEXT    NOT NULL,
  applies_customer_side INTEGER NOT NULL DEFAULT 0 CHECK (applies_customer_side IN (0, 1)),
  applies_provider_side INTEGER NOT NULL DEFAULT 0 CHECK (applies_provider_side IN (0, 1)),
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS booking_charge_lines_booking_idx    ON booking_charge_lines (booking_id);
CREATE INDEX IF NOT EXISTS booking_charge_lines_definition_idx ON booking_charge_lines (charge_definition_id);
CREATE INDEX IF NOT EXISTS booking_charge_lines_scope_idx      ON booking_charge_lines (scope);

-- ── Refund Charge Lines ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refund_charge_lines (
  id                      TEXT    NOT NULL PRIMARY KEY,
  refund_id               TEXT    NOT NULL REFERENCES refunds(id),
  booking_charge_line_id  TEXT    NOT NULL REFERENCES booking_charge_lines(id),
  original_charge_amount  INTEGER NOT NULL,
  refunded_charge_amount  INTEGER NOT NULL,
  refund_behavior         TEXT    NOT NULL,
  currency_code           TEXT    NOT NULL,
  notes                   TEXT,
  created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS refund_charge_lines_refund_idx         ON refund_charge_lines (refund_id);
CREATE INDEX IF NOT EXISTS refund_charge_lines_booking_charge_idx ON refund_charge_lines (booking_charge_line_id);

-- ── Payout Charge Lines ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_charge_lines (
  id                    TEXT    NOT NULL PRIMARY KEY,
  payout_id             TEXT    NOT NULL REFERENCES payouts(id),
  booking_id            TEXT    REFERENCES bookings(id),
  charge_definition_id  TEXT    NOT NULL REFERENCES charge_definitions(id),
  scope                 TEXT    NOT NULL,
  description           TEXT    NOT NULL,
  gross_amount          INTEGER NOT NULL,
  charge_amount         INTEGER NOT NULL,
  net_amount            INTEGER NOT NULL,
  currency_code         TEXT    NOT NULL,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS payout_charge_lines_payout_idx     ON payout_charge_lines (payout_id);
CREATE INDEX IF NOT EXISTS payout_charge_lines_definition_idx ON payout_charge_lines (charge_definition_id);

-- ── Invoice Charge Lines ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_charge_lines (
  id                    TEXT    NOT NULL PRIMARY KEY,
  invoice_id            TEXT    NOT NULL,
  booking_id            TEXT    REFERENCES bookings(id),
  charge_definition_id  TEXT    NOT NULL REFERENCES charge_definitions(id),
  description           TEXT    NOT NULL,
  quantity              INTEGER NOT NULL DEFAULT 1,
  unit_amount           INTEGER NOT NULL,
  total_amount          INTEGER NOT NULL,
  tax_amount            INTEGER NOT NULL DEFAULT 0,
  currency_code         TEXT    NOT NULL,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS invoice_charge_lines_invoice_idx ON invoice_charge_lines (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_charge_lines_booking_idx ON invoice_charge_lines (booking_id);

-- ── Charge Allocation Lines ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charge_allocation_lines (
  id                    TEXT NOT NULL PRIMARY KEY,
  charge_context_type   TEXT NOT NULL CHECK (charge_context_type IN ('booking_charge_line','payout_charge_line','refund_charge_line')),
  charge_context_id     TEXT NOT NULL,
  charge_definition_id  TEXT NOT NULL REFERENCES charge_definitions(id),
  amount                INTEGER NOT NULL,
  currency_code         TEXT NOT NULL,
  debit_account_code    TEXT NOT NULL,
  credit_account_code   TEXT NOT NULL,
  ledger_entry_id       TEXT REFERENCES ledger_entries(id),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','reversed')),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS charge_allocation_lines_context_idx    ON charge_allocation_lines (charge_context_type, charge_context_id);
CREATE INDEX IF NOT EXISTS charge_allocation_lines_definition_idx ON charge_allocation_lines (charge_definition_id);
CREATE INDEX IF NOT EXISTS charge_allocation_lines_status_idx     ON charge_allocation_lines (status);
CREATE INDEX IF NOT EXISTS charge_allocation_lines_ledger_idx     ON charge_allocation_lines (ledger_entry_id);

-- ── Seed: Core Charge Definitions ────────────────────────────────────────────
-- These are the baseline definitions for a typical travel marketplace.
-- Rate-specific data is in charge_rule_sets + charge_rules below.

INSERT OR IGNORE INTO charge_definitions
  (id, code, name, description, category, scope, payer, beneficiary, base_type, calc_method, calc_priority, is_taxable, is_recoverable, refund_behavior, ledger_debit_account_code, ledger_credit_account_code, effective_from, is_enabled, requires_approval, created_by)
VALUES
  -- Platform commission (10% of booking subtotal, provider pays)
  ('chgdef_001', 'PLATFORM_COMMISSION', 'Platform Commission',
   'Platform commission deducted from provider payout',
   'commission', 'booking_level', 'provider', 'platform',
   'booking_subtotal', 'percentage', 10,
   1, 0, 'non_refundable',
   '2000', '4000',
   '2024-01-01', 1, 1, 'usr_admin_001'),

  -- VAT on commission (16% of commission amount, platform liability)
  ('chgdef_002', 'VAT_ON_COMMISSION', 'VAT on Commission',
   'VAT charged on platform commission (KE standard rate)',
   'tax', 'commission_level', 'provider', 'government',
   'commission_amount', 'exclusive_tax', 20,
   0, 0, 'non_refundable',
   '2000', '2200',
   '2024-01-01', 1, 1, 'usr_admin_001'),

  -- Withholding tax (5% of gross booking, deducted before payout)
  ('chgdef_003', 'WITHHOLDING_TAX', 'Withholding Tax',
   'Withholding tax deducted from provider payout per jurisdiction rules',
   'withholding', 'payout_level', 'provider', 'government',
   'payout_amount', 'percentage', 30,
   0, 0, 'non_refundable',
   '2000', '2500',
   '2024-01-01', 1, 1, 'usr_admin_001'),

  -- Tourism levy (2% customer-side)
  ('chgdef_004', 'TOURISM_LEVY', 'Tourism Levy',
   'Government tourism development levy on customer-facing booking value',
   'levy', 'booking_level', 'customer', 'government',
   'booking_subtotal', 'percentage', 15,
   0, 0, 'fully_refundable',
   '1100', '2400',
   '2024-01-01', 1, 0, 'usr_admin_001'),

  -- Booking fee (fixed KES 250 per booking, non-refundable)
  ('chgdef_005', 'BOOKING_FEE', 'Booking Fee',
   'Non-refundable platform booking processing fee',
   'fee', 'booking_level', 'customer', 'platform',
   'booking_subtotal', 'fixed', 5,
   0, 0, 'non_refundable',
   '1100', '4100',
   '2024-01-01', 1, 0, 'usr_admin_001'),

  -- Payment processing recovery fee (1.5% of payment, non-refundable)
  ('chgdef_006', 'PAYMENT_PROCESSING_FEE', 'Payment Processing Fee',
   'Card/mobile money processing fee recovery (where legally permitted)',
   'fee', 'payment_level', 'customer', 'platform',
   'payment_amount', 'percentage', 12,
   0, 1, 'non_refundable',
   '1100', '4100',
   '2024-01-01', 1, 0, 'usr_admin_001'),

  -- Payout fee (flat KES 50 per payout disbursement)
  ('chgdef_007', 'PAYOUT_FEE', 'Payout Disbursement Fee',
   'Fee charged to provider per payout disbursement',
   'fee', 'payout_level', 'provider', 'platform',
   'payout_amount', 'fixed', 25,
   0, 0, 'non_refundable',
   '2000', '4100',
   '2024-01-01', 1, 0, 'usr_admin_001'),

  -- FX markup (1% on cross-currency payouts)
  ('chgdef_008', 'FX_MARKUP', 'FX Conversion Markup',
   'Markup on foreign exchange conversions for cross-currency payouts',
   'fx', 'payout_level', 'provider', 'platform',
   'payout_amount', 'percentage', 28,
   0, 0, 'non_refundable',
   '2000', '4200',
   '2024-01-01', 1, 0, 'usr_admin_001'),

  -- Stamp duty (0.1% of booking value, Kenya)
  ('chgdef_009', 'STAMP_DUTY', 'Stamp Duty',
   'Stamp duty applicable per jurisdiction',
   'duty', 'booking_level', 'customer', 'government',
   'booking_subtotal', 'percentage', 18,
   0, 0, 'non_refundable',
   '1100', '2300',
   '2024-01-01', 0, 0, 'usr_admin_001'),

  -- Manual adjustment (admin-applied credits/debits)
  ('chgdef_010', 'MANUAL_ADJUSTMENT', 'Manual Financial Adjustment',
   'Admin-applied manual adjustment for disputes, corrections, or goodwill credits',
   'adjustment', 'booking_level', 'platform', 'customer',
   'manual', 'fixed', 50,
   0, 0, 'manual_review_required',
   '9900', '9901',
   '2024-01-01', 1, 1, 'usr_admin_001');

-- ── Charge Dependencies ───────────────────────────────────────────────────────
-- VAT on commission depends on PLATFORM_COMMISSION (uses its output as base)
INSERT OR IGNORE INTO charge_dependencies (id, dependent_charge_id, depends_on_charge_id, dependency_type)
VALUES
  ('chgdep_001', 'chgdef_002', 'chgdef_001', 'base_of');

-- ── Default Rule Sets (Kenya / global fallback) ───────────────────────────────
INSERT OR IGNORE INTO charge_rule_sets
  (id, charge_definition_id, name, jurisdiction_country, is_active, priority)
VALUES
  ('crs_001', 'chgdef_001', 'Platform Commission — Global',   NULL, 1, 0),
  ('crs_002', 'chgdef_001', 'Platform Commission — KE',       'KE', 1, 10),
  ('crs_003', 'chgdef_002', 'VAT on Commission — KE',         'KE', 1, 10),
  ('crs_004', 'chgdef_003', 'Withholding Tax — KE',           'KE', 1, 10),
  ('crs_005', 'chgdef_004', 'Tourism Levy — KE',              'KE', 1, 10),
  ('crs_006', 'chgdef_005', 'Booking Fee — Global',           NULL, 1, 0),
  ('crs_007', 'chgdef_006', 'Payment Processing Fee — Global',NULL, 1, 0),
  ('crs_008', 'chgdef_007', 'Payout Fee — Global',            NULL, 1, 0),
  ('crs_009', 'chgdef_008', 'FX Markup — Global',             NULL, 1, 0),
  ('crs_010', 'chgdef_010', 'Manual Adjustment — Global',     NULL, 1, 0);

-- ── Default Charge Rules ──────────────────────────────────────────────────────
INSERT OR IGNORE INTO charge_rules
  (id, rule_set_id, calc_method, rate_bps, fixed_amount, is_inclusive, is_active, effective_from, version)
VALUES
  -- 10% platform commission (global)
  ('cr_001', 'crs_001', 'percentage',      1000,  NULL, 0, 1, '2024-01-01', 1),
  -- 10% platform commission (KE — same rate, but scoped to KE rule set for override capability)
  ('cr_002', 'crs_002', 'percentage',      1000,  NULL, 0, 1, '2024-01-01', 1),
  -- 16% VAT on commission (KE)
  ('cr_003', 'crs_003', 'exclusive_tax',   1600,  NULL, 0, 1, '2024-01-01', 1),
  -- 5% withholding tax (KE)
  ('cr_004', 'crs_004', 'percentage',       500,  NULL, 0, 1, '2024-01-01', 1),
  -- 2% tourism levy (KE)
  ('cr_005', 'crs_005', 'percentage',       200,  NULL, 0, 1, '2024-01-01', 1),
  -- KES 250 booking fee (fixed, global) — 25000 = KES 250.00 in minor units
  ('cr_006', 'crs_006', 'fixed',           NULL, 25000, 0, 1, '2024-01-01', 1),
  -- 1.5% payment processing recovery
  ('cr_007', 'crs_007', 'percentage',       150,  NULL, 0, 1, '2024-01-01', 1),
  -- KES 50 payout fee — 5000 minor units
  ('cr_008', 'crs_008', 'fixed',           NULL,  5000, 0, 1, '2024-01-01', 1),
  -- 1% FX markup
  ('cr_009', 'crs_009', 'percentage',       100,  NULL, 0, 1, '2024-01-01', 1),
  -- Manual adjustment (fixed, amount set at runtime via context.manualAmount)
  ('cr_010', 'crs_010', 'fixed',           NULL,     0, 0, 1, '2024-01-01', 1);

-- ── Jurisdiction Profile — Kenya ──────────────────────────────────────────────
INSERT OR IGNORE INTO jurisdiction_profiles
  (id, country_code, region, name, currency_code, withholding_tax_bps, tourism_levy_bps, is_active)
VALUES
  ('jp_ke', 'KE', NULL, 'Kenya', 'KES', 500, 200, 1);

-- ── Tax Codes — Kenya ─────────────────────────────────────────────────────────
INSERT OR IGNORE INTO tax_codes
  (id, code, name, jurisdiction_country, rate_bps, applies_to, is_active, effective_from)
VALUES
  ('tc_ke_vat',  'KE_VAT_16',   'Kenya Standard VAT (16%)',            'KE', 1600, 'commission', 1, '2024-01-01'),
  ('tc_ke_wht',  'KE_WHT_5',    'Kenya Withholding Tax — Services (5%)','KE',  500, 'all',        1, '2024-01-01'),
  ('tc_ke_levy', 'KE_TDL_2',    'Kenya Tourism Development Levy (2%)', 'KE',  200, 'booking',    1, '2024-01-01');
