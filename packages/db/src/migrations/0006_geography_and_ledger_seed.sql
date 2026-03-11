-- Migration 0006: Countries, currencies, regions + ledger seed data
-- Adds reference tables for countries (ISO 3166), currencies (ISO 4217),
-- regions with closure table for parent/child hierarchy, and extensive
-- ledger seed data for realistic financial views.

-- ── Countries ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS countries (
  id                    TEXT    NOT NULL PRIMARY KEY,
  code                  TEXT    NOT NULL,
  code3                 TEXT,
  numeric_code          TEXT,
  name                  TEXT    NOT NULL,
  official_name         TEXT,
  continent             TEXT    CHECK (continent IN ('africa','asia','europe','north_america','south_america','oceania','antarctica')),
  capital_city          TEXT,
  phone_code            TEXT,
  default_currency_code TEXT,
  flag_emoji            TEXT,
  is_active             INTEGER NOT NULL DEFAULT 1,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS countries_code_idx   ON countries (code);
CREATE        INDEX IF NOT EXISTS countries_name_idx   ON countries (name);
CREATE        INDEX IF NOT EXISTS countries_active_idx ON countries (is_active);

-- ── Currencies ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS currencies (
  id             TEXT    NOT NULL PRIMARY KEY,
  code           TEXT    NOT NULL,
  numeric_code   TEXT,
  name           TEXT    NOT NULL,
  symbol         TEXT    NOT NULL,
  symbol_native  TEXT,
  decimal_digits INTEGER NOT NULL DEFAULT 2,
  rounding       INTEGER NOT NULL DEFAULT 0,
  is_active      INTEGER NOT NULL DEFAULT 1,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS currencies_code_idx   ON currencies (code);
CREATE        INDEX IF NOT EXISTS currencies_active_idx ON currencies (is_active);

-- ── Country-Currency mapping ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS country_currencies (
  id            TEXT    NOT NULL PRIMARY KEY,
  country_code  TEXT    NOT NULL,
  currency_code TEXT    NOT NULL,
  is_primary    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS country_currencies_unique_idx   ON country_currencies (country_code, currency_code);
CREATE        INDEX IF NOT EXISTS country_currencies_country_idx  ON country_currencies (country_code);
CREATE        INDEX IF NOT EXISTS country_currencies_currency_idx ON country_currencies (currency_code);

-- ── Regions ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS regions (
  id           TEXT    NOT NULL PRIMARY KEY,
  country_code TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  code         TEXT,
  parent_id    TEXT,
  level        INTEGER NOT NULL DEFAULT 1,
  is_active    INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS regions_country_idx ON regions (country_code);
CREATE INDEX IF NOT EXISTS regions_parent_idx  ON regions (parent_id);
CREATE INDEX IF NOT EXISTS regions_name_idx    ON regions (country_code, name);
CREATE INDEX IF NOT EXISTS regions_code_idx    ON regions (code);

-- ── Region Closure Table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS region_closure (
  id            TEXT    NOT NULL PRIMARY KEY,
  ancestor_id   TEXT    NOT NULL,
  descendant_id TEXT    NOT NULL,
  depth         INTEGER NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX  IF NOT EXISTS region_closure_ancestor_idx   ON region_closure (ancestor_id);
CREATE INDEX  IF NOT EXISTS region_closure_descendant_idx ON region_closure (descendant_id);
CREATE UNIQUE INDEX IF NOT EXISTS region_closure_unique_idx ON region_closure (ancestor_id, descendant_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: Currencies
-- ══════════════════════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO currencies (id, code, numeric_code, name, symbol, symbol_native, decimal_digits, rounding, is_active, sort_order) VALUES
  ('cur_kes', 'KES', '404', 'Kenyan Shilling',       'KSh',  'KSh', 2, 0, 1, 1),
  ('cur_usd', 'USD', '840', 'US Dollar',             '$',    '$',   2, 0, 1, 2),
  ('cur_eur', 'EUR', '978', 'Euro',                   '€',    '€',   2, 0, 1, 3),
  ('cur_gbp', 'GBP', '826', 'British Pound',          '£',    '£',   2, 0, 1, 4),
  ('cur_tzs', 'TZS', '834', 'Tanzanian Shilling',     'TSh',  'TSh', 0, 0, 1, 5),
  ('cur_ugx', 'UGX', '800', 'Ugandan Shilling',       'USh',  'USh', 0, 0, 1, 6),
  ('cur_rwf', 'RWF', '646', 'Rwandan Franc',          'FRw',  'FRw', 0, 0, 1, 7),
  ('cur_etb', 'ETB', '230', 'Ethiopian Birr',         'Br',   'Br',  2, 0, 1, 8),
  ('cur_zar', 'ZAR', '710', 'South African Rand',     'R',    'R',   2, 0, 1, 9),
  ('cur_ngn', 'NGN', '566', 'Nigerian Naira',         '₦',    '₦',   2, 0, 1, 10),
  ('cur_ghc', 'GHS', '936', 'Ghanaian Cedi',          'GH₵',  'GH₵', 2, 0, 1, 11),
  ('cur_egp', 'EGP', '818', 'Egyptian Pound',         'E£',   'ج.م', 2, 0, 1, 12),
  ('cur_mad', 'MAD', '504', 'Moroccan Dirham',        'MAD',  'د.م', 2, 0, 1, 13),
  ('cur_mur', 'MUR', '480', 'Mauritian Rupee',        '₨',    '₨',   2, 0, 1, 14),
  ('cur_xof', 'XOF', '952', 'CFA Franc BCEAO',       'CFA',  'CFA', 0, 0, 1, 15),
  ('cur_xaf', 'XAF', '950', 'CFA Franc BEAC',        'FCFA', 'FCFA',0, 0, 1, 16),
  ('cur_jpy', 'JPY', '392', 'Japanese Yen',           '¥',    '¥',   0, 0, 1, 17),
  ('cur_cny', 'CNY', '156', 'Chinese Yuan',           '¥',    '¥',   2, 0, 1, 18),
  ('cur_inr', 'INR', '356', 'Indian Rupee',           '₹',    '₹',   2, 0, 1, 19),
  ('cur_aed', 'AED', '784', 'UAE Dirham',             'AED',  'د.إ', 2, 0, 1, 20);

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: Countries (East Africa focus + major economies)
-- ══════════════════════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO countries (id, code, code3, numeric_code, name, official_name, continent, capital_city, phone_code, default_currency_code, flag_emoji, is_active, sort_order) VALUES
  ('cty_ke',  'KE', 'KEN', '404', 'Kenya',           'Republic of Kenya',                        'africa', 'Nairobi',        '+254', 'KES', '🇰🇪', 1, 1),
  ('cty_tz',  'TZ', 'TZA', '834', 'Tanzania',        'United Republic of Tanzania',              'africa', 'Dodoma',         '+255', 'TZS', '🇹🇿', 1, 2),
  ('cty_ug',  'UG', 'UGA', '800', 'Uganda',          'Republic of Uganda',                       'africa', 'Kampala',        '+256', 'UGX', '🇺🇬', 1, 3),
  ('cty_rw',  'RW', 'RWA', '646', 'Rwanda',          'Republic of Rwanda',                       'africa', 'Kigali',         '+250', 'RWF', '🇷🇼', 1, 4),
  ('cty_et',  'ET', 'ETH', '231', 'Ethiopia',        'Federal Democratic Republic of Ethiopia',  'africa', 'Addis Ababa',    '+251', 'ETB', '🇪🇹', 1, 5),
  ('cty_za',  'ZA', 'ZAF', '710', 'South Africa',    'Republic of South Africa',                 'africa', 'Pretoria',       '+27',  'ZAR', '🇿🇦', 1, 6),
  ('cty_ng',  'NG', 'NGA', '566', 'Nigeria',         'Federal Republic of Nigeria',              'africa', 'Abuja',          '+234', 'NGN', '🇳🇬', 1, 7),
  ('cty_gh',  'GH', 'GHA', '288', 'Ghana',           'Republic of Ghana',                        'africa', 'Accra',          '+233', 'GHS', '🇬🇭', 1, 8),
  ('cty_eg',  'EG', 'EGY', '818', 'Egypt',           'Arab Republic of Egypt',                   'africa', 'Cairo',          '+20',  'EGP', '🇪🇬', 1, 9),
  ('cty_ma',  'MA', 'MAR', '504', 'Morocco',         'Kingdom of Morocco',                       'africa', 'Rabat',          '+212', 'MAD', '🇲🇦', 1, 10),
  ('cty_mu',  'MU', 'MUS', '480', 'Mauritius',       'Republic of Mauritius',                    'africa', 'Port Louis',     '+230', 'MUR', '🇲🇺', 1, 11),
  ('cty_sn',  'SN', 'SEN', '686', 'Senegal',         'Republic of Senegal',                      'africa', 'Dakar',          '+221', 'XOF', '🇸🇳', 1, 12),
  ('cty_cm',  'CM', 'CMR', '120', 'Cameroon',        'Republic of Cameroon',                     'africa', 'Yaoundé',        '+237', 'XAF', '🇨🇲', 1, 13),
  ('cty_us',  'US', 'USA', '840', 'United States',   'United States of America',                 'north_america', 'Washington D.C.', '+1',  'USD', '🇺🇸', 1, 14),
  ('cty_gb',  'GB', 'GBR', '826', 'United Kingdom',  'United Kingdom of Great Britain and Northern Ireland', 'europe', 'London', '+44',  'GBP', '🇬🇧', 1, 15),
  ('cty_de',  'DE', 'DEU', '276', 'Germany',         'Federal Republic of Germany',              'europe', 'Berlin',         '+49',  'EUR', '🇩🇪', 1, 16),
  ('cty_fr',  'FR', 'FRA', '250', 'France',          'French Republic',                          'europe', 'Paris',          '+33',  'EUR', '🇫🇷', 1, 17),
  ('cty_ae',  'AE', 'ARE', '784', 'UAE',             'United Arab Emirates',                     'asia',   'Abu Dhabi',      '+971', 'AED', '🇦🇪', 1, 18),
  ('cty_in',  'IN', 'IND', '356', 'India',           'Republic of India',                        'asia',   'New Delhi',      '+91',  'INR', '🇮🇳', 1, 19),
  ('cty_cn',  'CN', 'CHN', '156', 'China',           'People''s Republic of China',              'asia',   'Beijing',        '+86',  'CNY', '🇨🇳', 1, 20);

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: Country-Currency mappings
-- ══════════════════════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO country_currencies (id, country_code, currency_code, is_primary) VALUES
  ('cc_ke_kes', 'KE', 'KES', 1), ('cc_ke_usd', 'KE', 'USD', 0),
  ('cc_tz_tzs', 'TZ', 'TZS', 1), ('cc_tz_usd', 'TZ', 'USD', 0),
  ('cc_ug_ugx', 'UG', 'UGX', 1), ('cc_ug_usd', 'UG', 'USD', 0),
  ('cc_rw_rwf', 'RW', 'RWF', 1), ('cc_rw_usd', 'RW', 'USD', 0),
  ('cc_et_etb', 'ET', 'ETB', 1),
  ('cc_za_zar', 'ZA', 'ZAR', 1), ('cc_za_usd', 'ZA', 'USD', 0),
  ('cc_ng_ngn', 'NG', 'NGN', 1), ('cc_ng_usd', 'NG', 'USD', 0),
  ('cc_gh_ghs', 'GH', 'GHS', 1),
  ('cc_eg_egp', 'EG', 'EGP', 1),
  ('cc_ma_mad', 'MA', 'MAD', 1), ('cc_ma_eur', 'MA', 'EUR', 0),
  ('cc_mu_mur', 'MU', 'MUR', 1), ('cc_mu_usd', 'MU', 'USD', 0),
  ('cc_sn_xof', 'SN', 'XOF', 1), ('cc_cm_xaf', 'CM', 'XAF', 1),
  ('cc_us_usd', 'US', 'USD', 1),
  ('cc_gb_gbp', 'GB', 'GBP', 1), ('cc_gb_eur', 'GB', 'EUR', 0),
  ('cc_de_eur', 'DE', 'EUR', 1), ('cc_fr_eur', 'FR', 'EUR', 1),
  ('cc_ae_aed', 'AE', 'AED', 1), ('cc_ae_usd', 'AE', 'USD', 0),
  ('cc_in_inr', 'IN', 'INR', 1),
  ('cc_cn_cny', 'CN', 'CNY', 1);

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: Kenya Regions (Counties)
-- ══════════════════════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO regions (id, country_code, name, code, parent_id, level, is_active, sort_order) VALUES
  ('reg_ke_nbi', 'KE', 'Nairobi',       'KE-30', NULL, 1, 1, 1),
  ('reg_ke_mom', 'KE', 'Mombasa',       'KE-01', NULL, 1, 1, 2),
  ('reg_ke_kis', 'KE', 'Kisumu',        'KE-42', NULL, 1, 1, 3),
  ('reg_ke_nak', 'KE', 'Nakuru',        'KE-32', NULL, 1, 1, 4),
  ('reg_ke_eld', 'KE', 'Uasin Gishu',   'KE-27', NULL, 1, 1, 5),
  ('reg_ke_kia', 'KE', 'Kiambu',        'KE-22', NULL, 1, 1, 6),
  ('reg_ke_nnk', 'KE', 'Narok',         'KE-33', NULL, 1, 1, 7),
  ('reg_ke_kwl', 'KE', 'Kwale',         'KE-02', NULL, 1, 1, 8),
  ('reg_ke_lmu', 'KE', 'Lamu',          'KE-05', NULL, 1, 1, 9),
  ('reg_ke_kil', 'KE', 'Kilifi',        'KE-03', NULL, 1, 1, 10),
  ('reg_ke_sem', 'KE', 'Samburu',       'KE-25', NULL, 1, 1, 11),
  ('reg_ke_lak', 'KE', 'Laikipia',      'KE-31', NULL, 1, 1, 12),
  ('reg_ke_nyh', 'KE', 'Nyahururu',     NULL,    'reg_ke_lak', 2, 1, 1),
  ('reg_ke_nyk', 'KE', 'Nanyuki',       NULL,    'reg_ke_lak', 2, 1, 2),
  ('reg_ke_klf', 'KE', 'Taita-Taveta',  'KE-06', NULL, 1, 1, 13),
  ('reg_ke_nyr', 'KE', 'Nyeri',         'KE-36', NULL, 1, 1, 14),
  ('reg_ke_mcr', 'KE', 'Machakos',      'KE-37', NULL, 1, 1, 15),
  ('reg_ke_mrg', 'KE', 'Meru',          'KE-12', NULL, 1, 1, 16),
  ('reg_ke_kak', 'KE', 'Kakamega',      'KE-37', NULL, 1, 1, 17),
  ('reg_ke_gar', 'KE', 'Garissa',       'KE-07', NULL, 1, 1, 18);

-- Tanzania key regions
INSERT OR IGNORE INTO regions (id, country_code, name, code, parent_id, level, is_active, sort_order) VALUES
  ('reg_tz_dar', 'TZ', 'Dar es Salaam',  'TZ-07', NULL, 1, 1, 1),
  ('reg_tz_ari', 'TZ', 'Arusha',         'TZ-01', NULL, 1, 1, 2),
  ('reg_tz_znz', 'TZ', 'Zanzibar',       'TZ-15', NULL, 1, 1, 3),
  ('reg_tz_man', 'TZ', 'Manyara',        'TZ-26', NULL, 1, 1, 4),
  ('reg_tz_kil', 'TZ', 'Kilimanjaro',    'TZ-09', NULL, 1, 1, 5);

-- Uganda key regions
INSERT OR IGNORE INTO regions (id, country_code, name, code, parent_id, level, is_active, sort_order) VALUES
  ('reg_ug_kmp', 'UG', 'Kampala',        'UG-102', NULL, 1, 1, 1),
  ('reg_ug_ent', 'UG', 'Entebbe',        NULL,     NULL, 1, 1, 2),
  ('reg_ug_jin', 'UG', 'Jinja',          'UG-204', NULL, 1, 1, 3),
  ('reg_ug_mba', 'UG', 'Mbarara',        'UG-403', NULL, 1, 1, 4);

-- ── Region Closure (self-references + parent→child) ──────────────────────────

-- Kenya top-level self-references
INSERT OR IGNORE INTO region_closure (id, ancestor_id, descendant_id, depth) VALUES
  ('rc_ke_nbi',  'reg_ke_nbi', 'reg_ke_nbi', 0),
  ('rc_ke_mom',  'reg_ke_mom', 'reg_ke_mom', 0),
  ('rc_ke_kis',  'reg_ke_kis', 'reg_ke_kis', 0),
  ('rc_ke_nak',  'reg_ke_nak', 'reg_ke_nak', 0),
  ('rc_ke_eld',  'reg_ke_eld', 'reg_ke_eld', 0),
  ('rc_ke_kia',  'reg_ke_kia', 'reg_ke_kia', 0),
  ('rc_ke_nnk',  'reg_ke_nnk', 'reg_ke_nnk', 0),
  ('rc_ke_kwl',  'reg_ke_kwl', 'reg_ke_kwl', 0),
  ('rc_ke_lmu',  'reg_ke_lmu', 'reg_ke_lmu', 0),
  ('rc_ke_kil',  'reg_ke_kil', 'reg_ke_kil', 0),
  ('rc_ke_sem',  'reg_ke_sem', 'reg_ke_sem', 0),
  ('rc_ke_lak',  'reg_ke_lak', 'reg_ke_lak', 0),
  ('rc_ke_klf',  'reg_ke_klf', 'reg_ke_klf', 0),
  ('rc_ke_nyr',  'reg_ke_nyr', 'reg_ke_nyr', 0),
  ('rc_ke_mcr',  'reg_ke_mcr', 'reg_ke_mcr', 0),
  ('rc_ke_mrg',  'reg_ke_mrg', 'reg_ke_mrg', 0),
  ('rc_ke_kak',  'reg_ke_kak', 'reg_ke_kak', 0),
  ('rc_ke_gar',  'reg_ke_gar', 'reg_ke_gar', 0),
  -- Laikipia sub-counties
  ('rc_ke_nyh',      'reg_ke_nyh', 'reg_ke_nyh', 0),
  ('rc_ke_nyk',      'reg_ke_nyk', 'reg_ke_nyk', 0),
  ('rc_ke_lak_nyh',  'reg_ke_lak', 'reg_ke_nyh', 1),
  ('rc_ke_lak_nyk',  'reg_ke_lak', 'reg_ke_nyk', 1);

-- Tanzania self-references
INSERT OR IGNORE INTO region_closure (id, ancestor_id, descendant_id, depth) VALUES
  ('rc_tz_dar', 'reg_tz_dar', 'reg_tz_dar', 0),
  ('rc_tz_ari', 'reg_tz_ari', 'reg_tz_ari', 0),
  ('rc_tz_znz', 'reg_tz_znz', 'reg_tz_znz', 0),
  ('rc_tz_man', 'reg_tz_man', 'reg_tz_man', 0),
  ('rc_tz_kil', 'reg_tz_kil', 'reg_tz_kil', 0);

-- Uganda self-references
INSERT OR IGNORE INTO region_closure (id, ancestor_id, descendant_id, depth) VALUES
  ('rc_ug_kmp', 'reg_ug_kmp', 'reg_ug_kmp', 0),
  ('rc_ug_ent', 'reg_ug_ent', 'reg_ug_ent', 0),
  ('rc_ug_jin', 'reg_ug_jin', 'reg_ug_jin', 0),
  ('rc_ug_mba', 'reg_ug_mba', 'reg_ug_mba', 0);

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: Ledger accounts (extend existing chart of accounts)
-- ══════════════════════════════════════════════════════════════════════════════

-- Platform-level accounts (extend existing 1100/1200/2000/2100/4000/6000)
INSERT OR IGNORE INTO ledger_accounts (id, code, name, type, provider_id, is_active) VALUES
  ('la_1100', '1100', 'Cash Clearing',              'asset',     NULL, 1),
  ('la_1200', '1200', 'Cash Outgoing',              'asset',     NULL, 1),
  ('la_2000', '2000', 'Provider Payable',           'liability', NULL, 1),
  ('la_2100', '2100', 'Refund Liability',           'liability', NULL, 1),
  ('la_2200', '2200', 'VAT Payable',                'liability', NULL, 1),
  ('la_2300', '2300', 'Stamp Duty Payable',         'liability', NULL, 1),
  ('la_2400', '2400', 'Tourism Levy Payable',       'liability', NULL, 1),
  ('la_2500', '2500', 'Withholding Tax Payable',    'liability', NULL, 1),
  ('la_3000', '3000', 'Retained Earnings',          'equity',    NULL, 1),
  ('la_4000', '4000', 'Platform Revenue',           'revenue',   NULL, 1),
  ('la_4100', '4100', 'Service Fee Revenue',        'revenue',   NULL, 1),
  ('la_4200', '4200', 'FX Revenue',                 'revenue',   NULL, 1),
  ('la_5000', '5000', 'Operating Expenses',         'expense',   NULL, 1),
  ('la_5100', '5100', 'Payment Gateway Fees',       'expense',   NULL, 1),
  ('la_6000', '6000', 'Refund Expense',             'expense',   NULL, 1),
  ('la_9900', '9900', 'Suspense Debit',             'asset',     NULL, 1),
  ('la_9901', '9901', 'Suspense Credit',            'liability', NULL, 1);

-- Provider-scoped accounts
INSERT OR IGNORE INTO ledger_accounts (id, code, name, type, provider_id, is_active) VALUES
  ('la_prv001_2000', '2000', 'Provider Payable — Savanna Safari',    'liability', 'prv_001', 1),
  ('la_prv001_4000', '4000', 'Commission Revenue — Savanna Safari',  'revenue',   'prv_001', 1),
  ('la_prv002_2000', '2000', 'Provider Payable — Coastal Escapes',   'liability', 'prv_002', 1),
  ('la_prv002_4000', '4000', 'Commission Revenue — Coastal Escapes', 'revenue',   'prv_002', 1),
  ('la_prv003_2000', '2000', 'Provider Payable — Summit Trails',     'liability', 'prv_003', 1),
  ('la_prv003_4000', '4000', 'Commission Revenue — Summit Trails',   'revenue',   'prv_003', 1);

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: Customer users for bookings
-- ══════════════════════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO users (id, email, email_verified, phone, phone_verified, password_hash, role, is_active, created_at, updated_at) VALUES
  ('usr_cust_001', 'john.tourist@gmail.com',  1, '+254700100001', 1,
   'pbkdf2:100000:3a886c13470d87baa50c75b1610914c99791847fe1234d98ab3b49c12150c1d1:af89091c7173e015a14153bb478d3073daca8b8344aa2252e3d22cd5e2f5768d',
   'customer', 1, '2026-01-05 08:00:00', '2026-01-05 08:00:00'),
  ('usr_cust_002', 'alice.traveler@outlook.com', 1, '+254711200002', 1,
   'pbkdf2:100000:01ebacb15aa5c661733ef5286a273f3f9ca30f00dc062bdffbb16ae69c662b27:82d24f53b51dfc7639c9eb3adcd8c72ca19d4691b88ca7455fd7c6306d9bada3',
   'customer', 1, '2026-01-10 09:30:00', '2026-01-10 09:30:00'),
  ('usr_cust_003', 'peter.explorer@yahoo.com', 1, '+254722300003', 1,
   'pbkdf2:100000:58438424591dc32acd197db1e9d1216a4e4ded5a56130aeff0007044a980472b:aff19878517d8d11443aa63a3da167a0ca8da0aaa98f32105232409f8ac92c39',
   'customer', 1, '2026-01-15 11:00:00', '2026-01-15 11:00:00'),
  ('usr_cust_004', 'sarah.jones@proton.me', 1, '+254733400004', 1,
   'pbkdf2:100000:3a886c13470d87baa50c75b1610914c99791847fe1234d98ab3b49c12150c1d1:af89091c7173e015a14153bb478d3073daca8b8344aa2252e3d22cd5e2f5768d',
   'customer', 1, '2026-01-20 14:00:00', '2026-01-20 14:00:00'),
  ('usr_cust_005', 'michael.w@gmail.com', 1, '+254744500005', 1,
   'pbkdf2:100000:01ebacb15aa5c661733ef5286a273f3f9ca30f00dc062bdffbb16ae69c662b27:82d24f53b51dfc7639c9eb3adcd8c72ca19d4691b88ca7455fd7c6306d9bada3',
   'customer', 1, '2026-01-28 10:00:00', '2026-01-28 10:00:00');

INSERT OR IGNORE INTO profiles (user_id, first_name, last_name, display_name, nationality, created_at, updated_at) VALUES
  ('usr_cust_001', 'John',    'Kamau',     'John Kamau',     'KE', '2026-01-05 08:00:00', '2026-01-05 08:00:00'),
  ('usr_cust_002', 'Alice',   'Wanjiku',   'Alice Wanjiku',  'KE', '2026-01-10 09:30:00', '2026-01-10 09:30:00'),
  ('usr_cust_003', 'Peter',   'Mueller',   'Peter Mueller',  'DE', '2026-01-15 11:00:00', '2026-01-15 11:00:00'),
  ('usr_cust_004', 'Sarah',   'Jones',     'Sarah Jones',    'GB', '2026-01-20 14:00:00', '2026-01-20 14:00:00'),
  ('usr_cust_005', 'Michael', 'Wafula',    'Michael Wafula', 'KE', '2026-01-28 10:00:00', '2026-01-28 10:00:00');

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: Bookings with full lifecycle
-- ══════════════════════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO bookings (id, reference, customer_id, provider_id, listing_id, status, service_date, guest_count, subtotal_amount, commission_amount, tax_amount, total_amount, currency_code, special_requests, created_at, updated_at) VALUES
  -- Booking 1: Mara Safari — fully completed cycle
  ('bk_001', 'BK-2026-00001', 'usr_cust_001', 'prv_001', 'lst_001', 'payout_completed',
   '2026-02-15', 2, 9000000, 900000, 270000, 9545000, 'KES',
   'Window seats preferred, vegetarian meals.', '2026-01-10 08:30:00', '2026-02-20 12:00:00'),

  -- Booking 2: Amboseli — paid, confirmed
  ('bk_002', 'BK-2026-00002', 'usr_cust_002', 'prv_001', 'lst_002', 'confirmed',
   '2026-03-20', 3, 9600000, 960000, 288000, 10188000, 'KES',
   NULL, '2026-02-05 10:15:00', '2026-02-10 14:30:00'),

  -- Booking 3: Diani Beach — paid, provider accepted
  ('bk_003', 'BK-2026-00003', 'usr_cust_003', 'prv_002', 'lst_007', 'provider_accepted',
   '2026-04-01', 2, 12500000, 1500000, 450000, 13225000, 'KES',
   'Honeymoon — any special arrangements appreciated.', '2026-02-15 16:45:00', '2026-02-20 09:00:00'),

  -- Booking 4: Nakuru day trip — pending payment
  ('bk_004', 'BK-2026-00004', 'usr_cust_004', 'prv_001', 'lst_004', 'pending_payment',
   '2026-03-25', 4, 6000000, 600000, 180000, 6455000, 'KES',
   'Need child seats for 2 kids.', '2026-03-01 13:20:00', '2026-03-01 13:20:00'),

  -- Booking 5: Samburu — fully completed
  ('bk_005', 'BK-2026-00005', 'usr_cust_001', 'prv_001', 'lst_005', 'payout_completed',
   '2026-01-25', 2, 15000000, 1500000, 450000, 15925000, 'KES',
   'Anniversary trip!', '2026-01-05 09:00:00', '2026-02-05 16:00:00'),

  -- Booking 6: Mount Kenya Trek — confirmed, payout pending
  ('bk_006', 'BK-2026-00006', 'usr_cust_005', 'prv_003', 'lst_010', 'payout_pending',
   '2026-03-10', 4, 26000000, 2600000, 780000, 27605000, 'KES',
   'Group of 4, all experienced hikers.', '2026-02-01 07:30:00', '2026-03-12 18:00:00'),

  -- Booking 7: Lamu Heritage — cancelled (refunded)
  ('bk_007', 'BK-2026-00007', 'usr_cust_002', 'prv_002', 'lst_008', 'refunded',
   '2026-03-15', 2, 8500000, 1020000, 306000, 9081000, 'KES',
   NULL, '2026-02-10 12:00:00', '2026-02-28 10:00:00'),

  -- Booking 8: Nairobi NP — paid, processing
  ('bk_008', 'BK-2026-00008', 'usr_cust_003', 'prv_001', 'lst_006', 'paid',
   '2026-03-22', 2, 1600000, 160000, 48000, 1723000, 'KES',
   'Early morning preferred.', '2026-03-05 17:00:00', '2026-03-06 08:00:00'),

  -- Booking 9: Tsavo Safari — confirmed
  ('bk_009', 'BK-2026-00009', 'usr_cust_004', 'prv_001', 'lst_003', 'confirmed',
   '2026-04-10', 2, 11600000, 1160000, 348000, 12283000, 'KES',
   NULL, '2026-03-01 10:00:00', '2026-03-08 14:00:00'),

  -- Booking 10: Watamu Snorkelling — draft
  ('bk_010', 'BK-2026-00010', 'usr_cust_005', 'prv_002', 'lst_009', 'draft',
   '2026-04-20', 6, 2700000, 324000, 97200, 2871200, 'KES',
   'Group includes 3 beginners.', '2026-03-10 14:30:00', '2026-03-10 14:30:00');

-- Booking items
INSERT OR IGNORE INTO booking_items (id, booking_id, listing_id, description, quantity, unit_price, total_price, provider_id, provider_payable_amount, platform_commission_amount, created_at) VALUES
  ('bi_001', 'bk_001', 'lst_001', '3-Day Maasai Mara Safari — Adult',  2, 4500000, 9000000, 'prv_001', 8100000, 900000, '2026-01-10 08:30:00'),
  ('bi_002', 'bk_002', 'lst_002', '2-Day Amboseli Safari — Adult',     3, 3200000, 9600000, 'prv_001', 8640000, 960000, '2026-02-05 10:15:00'),
  ('bi_003', 'bk_003', 'lst_007', '5-Night Diani Beach — Double Room', 5, 2500000, 12500000,'prv_002',11000000,1500000, '2026-02-15 16:45:00'),
  ('bi_004', 'bk_004', 'lst_004', 'Lake Nakuru Day Safari — Adult x4', 4, 1500000, 6000000, 'prv_001', 5400000, 600000, '2026-03-01 13:20:00'),
  ('bi_005', 'bk_005', 'lst_005', '3-Day Samburu Safari — Adult',      2, 7500000, 15000000,'prv_001',13500000,1500000, '2026-01-05 09:00:00'),
  ('bi_006', 'bk_006', 'lst_010', '5-Day Mt Kenya Trek — Per Person',  4, 6500000, 26000000,'prv_003',23400000,2600000, '2026-02-01 07:30:00'),
  ('bi_007', 'bk_007', 'lst_008', '4-Night Lamu Heritage — Suite',     4, 2125000, 8500000, 'prv_002', 7480000,1020000, '2026-02-10 12:00:00'),
  ('bi_008', 'bk_008', 'lst_006', 'Nairobi NP Half-Day — Adult',       2,  800000, 1600000, 'prv_001', 1440000, 160000, '2026-03-05 17:00:00'),
  ('bi_009', 'bk_009', 'lst_003', '4-Day Tsavo Safari — Adult',        2, 5800000, 11600000,'prv_001',10440000,1160000, '2026-03-01 10:00:00'),
  ('bi_010', 'bk_010', 'lst_009', 'Watamu Snorkelling — Adult',        6,  450000, 2700000, 'prv_002', 2376000, 324000, '2026-03-10 14:30:00');

-- Travelers
INSERT OR IGNORE INTO travelers (id, booking_id, first_name, last_name, nationality, is_primary, created_at) VALUES
  ('trv_001', 'bk_001', 'John',    'Kamau',   'KE', 1, '2026-01-10 08:30:00'),
  ('trv_002', 'bk_001', 'Jane',    'Kamau',   'KE', 0, '2026-01-10 08:30:00'),
  ('trv_003', 'bk_002', 'Alice',   'Wanjiku', 'KE', 1, '2026-02-05 10:15:00'),
  ('trv_004', 'bk_002', 'Bob',     'Odhiambo','KE', 0, '2026-02-05 10:15:00'),
  ('trv_005', 'bk_002', 'Carol',   'Muthoni', 'KE', 0, '2026-02-05 10:15:00'),
  ('trv_006', 'bk_003', 'Peter',   'Mueller', 'DE', 1, '2026-02-15 16:45:00'),
  ('trv_007', 'bk_003', 'Anna',    'Mueller', 'DE', 0, '2026-02-15 16:45:00'),
  ('trv_008', 'bk_005', 'John',    'Kamau',   'KE', 1, '2026-01-05 09:00:00'),
  ('trv_009', 'bk_005', 'Jane',    'Kamau',   'KE', 0, '2026-01-05 09:00:00'),
  ('trv_010', 'bk_006', 'Michael', 'Wafula',  'KE', 1, '2026-02-01 07:30:00');

-- Booking status history
INSERT OR IGNORE INTO booking_status_history (id, booking_id, from_status, to_status, changed_by, reason, created_at) VALUES
  -- Booking 1 full lifecycle
  ('bsh_001', 'bk_001', NULL,                'draft',              'usr_cust_001', NULL,                    '2026-01-10 08:30:00'),
  ('bsh_002', 'bk_001', 'draft',             'pending_payment',    'usr_cust_001', 'Customer confirmed',    '2026-01-10 08:45:00'),
  ('bsh_003', 'bk_001', 'pending_payment',   'paid',              'system',        'Payment received',      '2026-01-10 09:00:00'),
  ('bsh_004', 'bk_001', 'paid',              'provider_accepted', 'usr_prv_001',   'Booking accepted',      '2026-01-11 10:00:00'),
  ('bsh_005', 'bk_001', 'provider_accepted', 'confirmed',         'usr_prv_001',   'All details confirmed', '2026-01-11 10:30:00'),
  ('bsh_006', 'bk_001', 'confirmed',         'payout_pending',    'system',        'Service completed',     '2026-02-18 06:00:00'),
  ('bsh_007', 'bk_001', 'payout_pending',    'payout_completed',  'system',        'Payout dispatched',     '2026-02-20 12:00:00'),
  -- Booking 5 full lifecycle
  ('bsh_008', 'bk_005', NULL,                'draft',              'usr_cust_001', NULL,                    '2026-01-05 09:00:00'),
  ('bsh_009', 'bk_005', 'draft',             'pending_payment',    'usr_cust_001', 'Confirmed',             '2026-01-05 09:15:00'),
  ('bsh_010', 'bk_005', 'pending_payment',   'paid',              'system',        'Payment received',      '2026-01-05 09:30:00'),
  ('bsh_011', 'bk_005', 'paid',              'confirmed',         'usr_prv_001',   'Accepted & confirmed',  '2026-01-06 08:00:00'),
  ('bsh_012', 'bk_005', 'confirmed',         'payout_completed',  'system',        'Payout completed',      '2026-02-05 16:00:00'),
  -- Booking 7 cancellation
  ('bsh_013', 'bk_007', NULL,                'draft',              'usr_cust_002', NULL,                    '2026-02-10 12:00:00'),
  ('bsh_014', 'bk_007', 'draft',             'pending_payment',    'usr_cust_002', NULL,                    '2026-02-10 12:15:00'),
  ('bsh_015', 'bk_007', 'pending_payment',   'paid',              'system',        'Payment received',      '2026-02-10 12:30:00'),
  ('bsh_016', 'bk_007', 'paid',              'cancelled',         'usr_cust_002',  'Travel plans changed',  '2026-02-25 09:00:00'),
  ('bsh_017', 'bk_007', 'cancelled',         'refunded',          'system',        'Full refund processed', '2026-02-28 10:00:00');

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: Payments
-- ══════════════════════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO payments (id, booking_id, customer_id, status, method, amount, currency_code, tingg_checkout_request_id, tingg_merchant_tx_id, tingg_transaction_ref, idempotency_key, paid_at, created_at, updated_at) VALUES
  ('pay_001', 'bk_001', 'usr_cust_001', 'succeeded', 'mpesa', 9545000, 'KES',
   'tingg_chk_001', 'MTX-BK001-001', 'TINGG-REF-001', 'idem_pay_001',
   '2026-01-10 09:00:00', '2026-01-10 08:50:00', '2026-01-10 09:00:00'),

  ('pay_002', 'bk_002', 'usr_cust_002', 'succeeded', 'mpesa', 10188000, 'KES',
   'tingg_chk_002', 'MTX-BK002-002', 'TINGG-REF-002', 'idem_pay_002',
   '2026-02-05 10:45:00', '2026-02-05 10:30:00', '2026-02-05 10:45:00'),

  ('pay_003', 'bk_003', 'usr_cust_003', 'succeeded', 'card', 13225000, 'KES',
   'tingg_chk_003', 'MTX-BK003-003', 'TINGG-REF-003', 'idem_pay_003',
   '2026-02-15 17:00:00', '2026-02-15 16:50:00', '2026-02-15 17:00:00'),

  ('pay_005', 'bk_005', 'usr_cust_001', 'succeeded', 'mpesa', 15925000, 'KES',
   'tingg_chk_005', 'MTX-BK005-005', 'TINGG-REF-005', 'idem_pay_005',
   '2026-01-05 09:30:00', '2026-01-05 09:20:00', '2026-01-05 09:30:00'),

  ('pay_006', 'bk_006', 'usr_cust_005', 'succeeded', 'mpesa', 27605000, 'KES',
   'tingg_chk_006', 'MTX-BK006-006', 'TINGG-REF-006', 'idem_pay_006',
   '2026-02-01 08:00:00', '2026-02-01 07:50:00', '2026-02-01 08:00:00'),

  ('pay_007', 'bk_007', 'usr_cust_002', 'refunded', 'mpesa', 9081000, 'KES',
   'tingg_chk_007', 'MTX-BK007-007', 'TINGG-REF-007', 'idem_pay_007',
   '2026-02-10 12:30:00', '2026-02-10 12:20:00', '2026-02-28 10:00:00'),

  ('pay_008', 'bk_008', 'usr_cust_003', 'succeeded', 'card', 1723000, 'KES',
   'tingg_chk_008', 'MTX-BK008-008', 'TINGG-REF-008', 'idem_pay_008',
   '2026-03-06 08:00:00', '2026-03-05 17:05:00', '2026-03-06 08:00:00'),

  ('pay_009', 'bk_009', 'usr_cust_004', 'succeeded', 'mpesa', 12283000, 'KES',
   'tingg_chk_009', 'MTX-BK009-009', 'TINGG-REF-009', 'idem_pay_009',
   '2026-03-01 10:30:00', '2026-03-01 10:15:00', '2026-03-01 10:30:00');

-- Refund for cancelled booking 7
INSERT OR IGNORE INTO refunds (id, payment_id, booking_id, requested_by, approved_by, status, reason, amount, currency_code, idempotency_key, refunded_at, created_at, updated_at) VALUES
  ('ref_001', 'pay_007', 'bk_007', 'usr_cust_002', 'usr_admin_001', 'succeeded',
   'Travel plans changed', 9081000, 'KES', 'idem_ref_001',
   '2026-02-28 10:00:00', '2026-02-25 09:00:00', '2026-02-28 10:00:00');

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: Payouts
-- ══════════════════════════════════════════════════════════════════════════════

-- Provider 1 needs a payout account
INSERT OR IGNORE INTO provider_payout_accounts (id, provider_id, account_type, account_number, account_name, network_code, country_code, currency_code, is_default, is_verified, created_at, updated_at) VALUES
  ('poa_001', 'prv_001', 'mobile_money', '254700000001', 'Savanna Safari Mpesa', 'MPESA', 'KE', 'KES', 1, 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO payout_batches (id, status, total_amount, currency_code, payout_count, approved_by, approved_at, processed_at, created_at) VALUES
  ('pb_001', 'completed', 22050000, 'KES', 2, 'usr_admin_001', '2026-02-20 10:00:00', '2026-02-20 12:00:00', '2026-02-20 09:00:00');

INSERT OR IGNORE INTO payouts (id, provider_id, payout_account_id, batch_id, status, amount, currency_code, idempotency_key, tingg_payment_ref, processed_at, created_at, updated_at) VALUES
  ('po_001', 'prv_001', 'poa_001', 'pb_001', 'succeeded', 8100000, 'KES', 'idem_po_001', 'TINGG-PO-001',
   '2026-02-20 12:00:00', '2026-02-20 09:00:00', '2026-02-20 12:00:00'),
  ('po_002', 'prv_001', 'poa_001', 'pb_001', 'succeeded', 13500000, 'KES', 'idem_po_002', 'TINGG-PO-002',
   '2026-02-20 12:00:00', '2026-02-20 09:00:00', '2026-02-20 12:00:00');

INSERT OR IGNORE INTO payout_booking_links (id, payout_id, booking_id, amount, created_at) VALUES
  ('pbl_001', 'po_001', 'bk_001', 8100000, '2026-02-20 09:00:00'),
  ('pbl_002', 'po_002', 'bk_005', 13500000, '2026-02-20 09:00:00');

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: Ledger entries — realistic journal postings
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Booking 1: Payment received → Provider payable + Platform revenue ─────────
INSERT OR IGNORE INTO ledger_entries (id, type, reference_type, reference_id, description, effective_date, created_by, created_at) VALUES
  ('le_001', 'booking_payment', 'payment', 'pay_001', 'Payment received — BK-2026-00001 (3-Day Maasai Mara Safari)', '2026-01-10', 'usr_admin_001', '2026-01-10 09:00:00');

INSERT OR IGNORE INTO ledger_entry_lines (id, entry_id, account_id, debit_amount, credit_amount, currency_code, memo, created_at) VALUES
  ('lel_001a', 'le_001', 'la_1100', 9545000, 0,       'KES', 'DR Cash Clearing — Customer payment',          '2026-01-10 09:00:00'),
  ('lel_001b', 'le_001', 'la_2000', 0,       8100000, 'KES', 'CR Provider Payable — Savanna Safari Co.',     '2026-01-10 09:00:00'),
  ('lel_001c', 'le_001', 'la_4000', 0,       900000,  'KES', 'CR Platform Revenue — 10% commission',         '2026-01-10 09:00:00'),
  ('lel_001d', 'le_001', 'la_2400', 0,       180000,  'KES', 'CR Tourism Levy Payable — 2%',                 '2026-01-10 09:00:00'),
  ('lel_001e', 'le_001', 'la_4100', 0,       365000,  'KES', 'CR Service Fee Revenue — booking fee + taxes', '2026-01-10 09:00:00');

-- ── Booking 1: Payout dispatched ─────────────────────────────────────────────
INSERT OR IGNORE INTO ledger_entries (id, type, reference_type, reference_id, description, effective_date, created_by, created_at) VALUES
  ('le_002', 'payout_issuance', 'payout', 'po_001', 'Payout dispatched — Savanna Safari Co. (BK-2026-00001)', '2026-02-20', 'usr_admin_001', '2026-02-20 12:00:00');

INSERT OR IGNORE INTO ledger_entry_lines (id, entry_id, account_id, debit_amount, credit_amount, currency_code, memo, created_at) VALUES
  ('lel_002a', 'le_002', 'la_2000', 8100000, 0,       'KES', 'DR Provider Payable — Settlement to Savanna Safari', '2026-02-20 12:00:00'),
  ('lel_002b', 'le_002', 'la_1200', 0,       8100000, 'KES', 'CR Cash Outgoing — Payout via Mpesa',                '2026-02-20 12:00:00');

-- ── Booking 5: Payment received ──────────────────────────────────────────────
INSERT OR IGNORE INTO ledger_entries (id, type, reference_type, reference_id, description, effective_date, created_by, created_at) VALUES
  ('le_003', 'booking_payment', 'payment', 'pay_005', 'Payment received — BK-2026-00005 (3-Day Samburu Safari)', '2026-01-05', 'usr_admin_001', '2026-01-05 09:30:00');

INSERT OR IGNORE INTO ledger_entry_lines (id, entry_id, account_id, debit_amount, credit_amount, currency_code, memo, created_at) VALUES
  ('lel_003a', 'le_003', 'la_1100', 15925000, 0,        'KES', 'DR Cash Clearing — Customer payment',      '2026-01-05 09:30:00'),
  ('lel_003b', 'le_003', 'la_2000', 0,        13500000, 'KES', 'CR Provider Payable — Savanna Safari Co.', '2026-01-05 09:30:00'),
  ('lel_003c', 'le_003', 'la_4000', 0,        1500000,  'KES', 'CR Platform Revenue — 10% commission',     '2026-01-05 09:30:00'),
  ('lel_003d', 'le_003', 'la_2400', 0,        300000,   'KES', 'CR Tourism Levy Payable — 2%',             '2026-01-05 09:30:00'),
  ('lel_003e', 'le_003', 'la_4100', 0,        625000,   'KES', 'CR Service Fee Revenue',                   '2026-01-05 09:30:00');

-- ── Booking 5: Payout dispatched ─────────────────────────────────────────────
INSERT OR IGNORE INTO ledger_entries (id, type, reference_type, reference_id, description, effective_date, created_by, created_at) VALUES
  ('le_004', 'payout_issuance', 'payout', 'po_002', 'Payout dispatched — Savanna Safari Co. (BK-2026-00005)', '2026-02-20', 'usr_admin_001', '2026-02-20 12:00:00');

INSERT OR IGNORE INTO ledger_entry_lines (id, entry_id, account_id, debit_amount, credit_amount, currency_code, memo, created_at) VALUES
  ('lel_004a', 'le_004', 'la_2000', 13500000, 0,        'KES', 'DR Provider Payable — Settlement to Savanna Safari', '2026-02-20 12:00:00'),
  ('lel_004b', 'le_004', 'la_1200', 0,        13500000, 'KES', 'CR Cash Outgoing — Payout via Mpesa',                '2026-02-20 12:00:00');

-- ── Booking 2: Payment received ──────────────────────────────────────────────
INSERT OR IGNORE INTO ledger_entries (id, type, reference_type, reference_id, description, effective_date, created_by, created_at) VALUES
  ('le_005', 'booking_payment', 'payment', 'pay_002', 'Payment received — BK-2026-00002 (2-Day Amboseli Safari)', '2026-02-05', 'usr_admin_001', '2026-02-05 10:45:00');

INSERT OR IGNORE INTO ledger_entry_lines (id, entry_id, account_id, debit_amount, credit_amount, currency_code, memo, created_at) VALUES
  ('lel_005a', 'le_005', 'la_1100', 10188000, 0,       'KES', 'DR Cash Clearing — Customer payment',      '2026-02-05 10:45:00'),
  ('lel_005b', 'le_005', 'la_2000', 0,       8640000,  'KES', 'CR Provider Payable — Savanna Safari Co.', '2026-02-05 10:45:00'),
  ('lel_005c', 'le_005', 'la_4000', 0,       960000,   'KES', 'CR Platform Revenue — 10% commission',     '2026-02-05 10:45:00'),
  ('lel_005d', 'le_005', 'la_2400', 0,       192000,   'KES', 'CR Tourism Levy Payable — 2%',             '2026-02-05 10:45:00'),
  ('lel_005e', 'le_005', 'la_4100', 0,       396000,   'KES', 'CR Service Fee Revenue',                   '2026-02-05 10:45:00');

-- ── Booking 3: Payment received (Coastal Escapes) ────────────────────────────
INSERT OR IGNORE INTO ledger_entries (id, type, reference_type, reference_id, description, effective_date, created_by, created_at) VALUES
  ('le_006', 'booking_payment', 'payment', 'pay_003', 'Payment received — BK-2026-00003 (5-Night Diani Beach)', '2026-02-15', 'usr_admin_001', '2026-02-15 17:00:00');

INSERT OR IGNORE INTO ledger_entry_lines (id, entry_id, account_id, debit_amount, credit_amount, currency_code, memo, created_at) VALUES
  ('lel_006a', 'le_006', 'la_1100', 13225000, 0,        'KES', 'DR Cash Clearing — Customer payment',       '2026-02-15 17:00:00'),
  ('lel_006b', 'le_006', 'la_2000', 0,        11000000, 'KES', 'CR Provider Payable — Coastal Escapes Ltd', '2026-02-15 17:00:00'),
  ('lel_006c', 'le_006', 'la_4000', 0,        1500000,  'KES', 'CR Platform Revenue — 12% commission',      '2026-02-15 17:00:00'),
  ('lel_006d', 'le_006', 'la_2400', 0,        250000,   'KES', 'CR Tourism Levy Payable — 2%',              '2026-02-15 17:00:00'),
  ('lel_006e', 'le_006', 'la_4100', 0,        475000,   'KES', 'CR Service Fee Revenue',                    '2026-02-15 17:00:00');

-- ── Booking 6: Payment received (Summit Trails) ─────────────────────────────
INSERT OR IGNORE INTO ledger_entries (id, type, reference_type, reference_id, description, effective_date, created_by, created_at) VALUES
  ('le_007', 'booking_payment', 'payment', 'pay_006', 'Payment received — BK-2026-00006 (5-Day Mt Kenya Trek)', '2026-02-01', 'usr_admin_001', '2026-02-01 08:00:00');

INSERT OR IGNORE INTO ledger_entry_lines (id, entry_id, account_id, debit_amount, credit_amount, currency_code, memo, created_at) VALUES
  ('lel_007a', 'le_007', 'la_1100', 27605000, 0,        'KES', 'DR Cash Clearing — Customer payment',        '2026-02-01 08:00:00'),
  ('lel_007b', 'le_007', 'la_2000', 0,        23400000, 'KES', 'CR Provider Payable — Summit Trails Kenya',  '2026-02-01 08:00:00'),
  ('lel_007c', 'le_007', 'la_4000', 0,        2600000,  'KES', 'CR Platform Revenue — 10% commission',       '2026-02-01 08:00:00'),
  ('lel_007d', 'le_007', 'la_2400', 0,        520000,   'KES', 'CR Tourism Levy Payable — 2%',               '2026-02-01 08:00:00'),
  ('lel_007e', 'le_007', 'la_4100', 0,        1085000,  'KES', 'CR Service Fee Revenue',                     '2026-02-01 08:00:00');

-- ── Booking 7: Payment received + Refund ─────────────────────────────────────
INSERT OR IGNORE INTO ledger_entries (id, type, reference_type, reference_id, description, effective_date, created_by, created_at) VALUES
  ('le_008', 'booking_payment', 'payment', 'pay_007', 'Payment received — BK-2026-00007 (4-Night Lamu Heritage)', '2026-02-10', 'usr_admin_001', '2026-02-10 12:30:00');

INSERT OR IGNORE INTO ledger_entry_lines (id, entry_id, account_id, debit_amount, credit_amount, currency_code, memo, created_at) VALUES
  ('lel_008a', 'le_008', 'la_1100', 9081000,  0,       'KES', 'DR Cash Clearing — Customer payment',       '2026-02-10 12:30:00'),
  ('lel_008b', 'le_008', 'la_2000', 0,        7480000, 'KES', 'CR Provider Payable — Coastal Escapes Ltd', '2026-02-10 12:30:00'),
  ('lel_008c', 'le_008', 'la_4000', 0,        1020000, 'KES', 'CR Platform Revenue — 12% commission',      '2026-02-10 12:30:00'),
  ('lel_008d', 'le_008', 'la_2400', 0,        170000,  'KES', 'CR Tourism Levy Payable — 2%',              '2026-02-10 12:30:00'),
  ('lel_008e', 'le_008', 'la_4100', 0,        411000,  'KES', 'CR Service Fee Revenue',                    '2026-02-10 12:30:00');

-- Refund: DR Provider Payable / CR Refund Liability (pre-payout)
INSERT OR IGNORE INTO ledger_entries (id, type, reference_type, reference_id, description, effective_date, created_by, created_at) VALUES
  ('le_009', 'refund_issuance', 'refund', 'ref_001', 'Pre-payout refund — BK-2026-00007 (Lamu Heritage cancelled)', '2026-02-28', 'usr_admin_001', '2026-02-28 10:00:00');

INSERT OR IGNORE INTO ledger_entry_lines (id, entry_id, account_id, debit_amount, credit_amount, currency_code, memo, created_at) VALUES
  ('lel_009a', 'le_009', 'la_2000', 9081000, 0,       'KES', 'DR Provider Payable — Refund reversal',  '2026-02-28 10:00:00'),
  ('lel_009b', 'le_009', 'la_2100', 0,       9081000, 'KES', 'CR Refund Liability — Customer refund',  '2026-02-28 10:00:00');

-- ── Booking 8: Payment received ──────────────────────────────────────────────
INSERT OR IGNORE INTO ledger_entries (id, type, reference_type, reference_id, description, effective_date, created_by, created_at) VALUES
  ('le_010', 'booking_payment', 'payment', 'pay_008', 'Payment received — BK-2026-00008 (Nairobi NP Half-Day)', '2026-03-06', 'usr_admin_001', '2026-03-06 08:00:00');

INSERT OR IGNORE INTO ledger_entry_lines (id, entry_id, account_id, debit_amount, credit_amount, currency_code, memo, created_at) VALUES
  ('lel_010a', 'le_010', 'la_1100', 1723000, 0,       'KES', 'DR Cash Clearing — Customer payment',      '2026-03-06 08:00:00'),
  ('lel_010b', 'le_010', 'la_2000', 0,       1440000, 'KES', 'CR Provider Payable — Savanna Safari Co.', '2026-03-06 08:00:00'),
  ('lel_010c', 'le_010', 'la_4000', 0,       160000,  'KES', 'CR Platform Revenue — 10% commission',     '2026-03-06 08:00:00'),
  ('lel_010d', 'le_010', 'la_2400', 0,       32000,   'KES', 'CR Tourism Levy Payable — 2%',             '2026-03-06 08:00:00'),
  ('lel_010e', 'le_010', 'la_4100', 0,       91000,   'KES', 'CR Service Fee Revenue',                   '2026-03-06 08:00:00');

-- ── Booking 9: Payment received ──────────────────────────────────────────────
INSERT OR IGNORE INTO ledger_entries (id, type, reference_type, reference_id, description, effective_date, created_by, created_at) VALUES
  ('le_011', 'booking_payment', 'payment', 'pay_009', 'Payment received — BK-2026-00009 (4-Day Tsavo Safari)', '2026-03-01', 'usr_admin_001', '2026-03-01 10:30:00');

INSERT OR IGNORE INTO ledger_entry_lines (id, entry_id, account_id, debit_amount, credit_amount, currency_code, memo, created_at) VALUES
  ('lel_011a', 'le_011', 'la_1100', 12283000, 0,        'KES', 'DR Cash Clearing — Customer payment',      '2026-03-01 10:30:00'),
  ('lel_011b', 'le_011', 'la_2000', 0,        10440000, 'KES', 'CR Provider Payable — Savanna Safari Co.', '2026-03-01 10:30:00'),
  ('lel_011c', 'le_011', 'la_4000', 0,        1160000,  'KES', 'CR Platform Revenue — 10% commission',     '2026-03-01 10:30:00'),
  ('lel_011d', 'le_011', 'la_2400', 0,        232000,   'KES', 'CR Tourism Levy Payable — 2%',             '2026-03-01 10:30:00'),
  ('lel_011e', 'le_011', 'la_4100', 0,        451000,   'KES', 'CR Service Fee Revenue',                   '2026-03-01 10:30:00');

-- ── Commission records ───────────────────────────────────────────────────────
INSERT OR IGNORE INTO commissions (id, booking_id, provider_id, rate_bps, base_amount, commission_amount, currency_code, status, created_at) VALUES
  ('comm_001', 'bk_001', 'prv_001', 1000, 9000000,  900000,  'KES', 'earned',   '2026-01-10 09:00:00'),
  ('comm_002', 'bk_002', 'prv_001', 1000, 9600000,  960000,  'KES', 'earned',   '2026-02-05 10:45:00'),
  ('comm_003', 'bk_003', 'prv_002', 1200, 12500000, 1500000, 'KES', 'pending',  '2026-02-15 17:00:00'),
  ('comm_005', 'bk_005', 'prv_001', 1000, 15000000, 1500000, 'KES', 'earned',   '2026-01-05 09:30:00'),
  ('comm_006', 'bk_006', 'prv_003', 1000, 26000000, 2600000, 'KES', 'pending',  '2026-02-01 08:00:00'),
  ('comm_007', 'bk_007', 'prv_002', 1200, 8500000,  1020000, 'KES', 'reversed', '2026-02-10 12:30:00'),
  ('comm_008', 'bk_008', 'prv_001', 1000, 1600000,  160000,  'KES', 'pending',  '2026-03-06 08:00:00'),
  ('comm_009', 'bk_009', 'prv_001', 1000, 11600000, 1160000, 'KES', 'pending',  '2026-03-01 10:30:00');
