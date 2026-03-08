-- Migration 0002: Schema fixes and ledger account code alignment
--
-- Changes:
--   1. Add approved_by column to payouts (maker-checker workflow)
--   2. Replace incorrectly-coded ledger_accounts seed rows with canonical codes
--      that match the account codes used by LedgerService and charge_definitions
--   3. Seed all system-level ledger accounts (1xxx asset, 2xxx liability,
--      4xxx revenue, 6xxx expense, 9xxx clearing) that the service layer references

-- ── 1. Add approved_by to payouts ─────────────────────────────────────────────
ALTER TABLE payouts ADD COLUMN approved_by TEXT REFERENCES users(id);

-- ── 2. Remove old incorrectly-coded ledger accounts ───────────────────────────
-- These were seeded with wrong codes (1010, 1020, 2010, 2020, 4010, 6010, 6020)
-- that do not match any service-layer references. Safe to delete because no
-- ledger_entry_lines reference them in a fresh / dev environment.
DELETE FROM ledger_accounts WHERE id IN (
  'lac_001','lac_002','lac_003','lac_004','lac_005','lac_006','lac_007'
);

-- ── 3. Canonical system ledger accounts ───────────────────────────────────────
-- Asset accounts (1xxx)
INSERT OR IGNORE INTO ledger_accounts (id, code, name, type, provider_id, is_active, created_at) VALUES
  ('lac_1100', '1100', 'Cash Clearing',         'asset',     NULL, 1, datetime('now')),
  ('lac_1200', '1200', 'Cash Outgoing',          'asset',     NULL, 1, datetime('now'));

-- Liability accounts (2xxx)
INSERT OR IGNORE INTO ledger_accounts (id, code, name, type, provider_id, is_active, created_at) VALUES
  ('lac_2000', '2000', 'Provider Payable',               'liability', NULL, 1, datetime('now')),
  ('lac_2100', '2100', 'Refund Liability',                'liability', NULL, 1, datetime('now')),
  ('lac_2200', '2200', 'VAT Payable',                    'liability', NULL, 1, datetime('now')),
  ('lac_2300', '2300', 'Stamp Duty Payable',             'liability', NULL, 1, datetime('now')),
  ('lac_2400', '2400', 'Tourism Levy Payable',           'liability', NULL, 1, datetime('now')),
  ('lac_2500', '2500', 'Withholding Tax Payable',        'liability', NULL, 1, datetime('now'));

-- Revenue accounts (4xxx)
INSERT OR IGNORE INTO ledger_accounts (id, code, name, type, provider_id, is_active, created_at) VALUES
  ('lac_4000', '4000', 'Platform Commission Revenue',    'revenue',   NULL, 1, datetime('now')),
  ('lac_4100', '4100', 'Platform Fee Revenue',           'revenue',   NULL, 1, datetime('now')),
  ('lac_4200', '4200', 'FX Conversion Revenue',          'revenue',   NULL, 1, datetime('now'));

-- Expense accounts (6xxx)
INSERT OR IGNORE INTO ledger_accounts (id, code, name, type, provider_id, is_active, created_at) VALUES
  ('lac_6000', '6000', 'Refund Expense',                'expense',   NULL, 1, datetime('now'));

-- Clearing / suspense accounts (9xxx) — used by manual adjustment charge definitions
INSERT OR IGNORE INTO ledger_accounts (id, code, name, type, provider_id, is_active, created_at) VALUES
  ('lac_9900', '9900', 'Manual Debit Clearing',         'equity',    NULL, 1, datetime('now')),
  ('lac_9901', '9901', 'Manual Credit Clearing',        'equity',    NULL, 1, datetime('now'));

-- ── 4. Provider subledger accounts for seed provider prv_001 ──────────────────
-- These represent the provider's slice of the platform ledger.
-- Balances are derived (never stored directly) via sum of entry lines.
-- Requires a seed service provider row to satisfy FK constraint.
INSERT OR IGNORE INTO service_providers (id, name, slug, email, phone, country_code, currency_code, is_active, is_verified)
VALUES ('prv_001', 'Savanna Safari Tours', 'savanna-safari-tours', 'info@savannasafari.co.ke', '+254700000000', 'KE', 'KES', 1, 1);

INSERT OR IGNORE INTO ledger_accounts (id, code, name, type, provider_id, is_active, created_at) VALUES
  ('lac_prv001_hold',     '7100', 'Provider Hold — Savanna Safari',            'liability', 'prv_001', 1, datetime('now')),
  ('lac_prv001_payable',  '7200', 'Provider Payable — Savanna Safari',         'liability', 'prv_001', 1, datetime('now')),
  ('lac_prv001_transit',  '7300', 'Provider Payout In Transit — Savanna Safari','liability','prv_001', 1, datetime('now')),
  ('lac_prv001_cleared',  '7400', 'Provider Payout Cleared — Savanna Safari',  'liability', 'prv_001', 1, datetime('now'));
