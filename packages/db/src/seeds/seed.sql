-- Felix Travel Seed Data
-- Seed login credentials (dev only):
-- Password for all seeded users: DevPass123!
INSERT OR IGNORE INTO users (id, email, email_verified, role, is_active, password_hash, created_at, updated_at) VALUES
  ('usr_admin_001','admin@felix.travel',1,'admin',1,'pbkdf2:100000:6928fa4b71fea9341418b80b572dce49bfebcaf58e6122e1b487f744c1bc7321:6a445b4b8488d4d69578a03845a25748e73f45b1f9532f92ba3c61439efd80b4',datetime('now'),datetime('now')),
  ('usr_agent_001','agent@felix.travel',1,'agent',1,'pbkdf2:100000:6928fa4b71fea9341418b80b572dce49bfebcaf58e6122e1b487f744c1bc7321:6a445b4b8488d4d69578a03845a25748e73f45b1f9532f92ba3c61439efd80b4',datetime('now'),datetime('now')),
  ('usr_customer_001','customer@felix.travel',1,'customer',1,'pbkdf2:100000:6928fa4b71fea9341418b80b572dce49bfebcaf58e6122e1b487f744c1bc7321:6a445b4b8488d4d69578a03845a25748e73f45b1f9532f92ba3c61439efd80b4',datetime('now'),datetime('now')),
  ('usr_provider_001','provider@safarico.com',1,'service_provider',1,'pbkdf2:100000:6928fa4b71fea9341418b80b572dce49bfebcaf58e6122e1b487f744c1bc7321:6a445b4b8488d4d69578a03845a25748e73f45b1f9532f92ba3c61439efd80b4',datetime('now'),datetime('now'));

INSERT OR IGNORE INTO profiles (user_id, first_name, last_name, created_at, updated_at) VALUES
  ('usr_admin_001','Felix','Admin',datetime('now'),datetime('now')),
  ('usr_agent_001','Jane','Agent',datetime('now'),datetime('now')),
  ('usr_customer_001','John','Customer',datetime('now'),datetime('now')),
  ('usr_provider_001','Safari','Owner',datetime('now'),datetime('now'));

INSERT OR IGNORE INTO service_providers (id, name, slug, email, country_code, currency_code, is_active, is_verified, created_at, updated_at) VALUES
  ('prv_001','Savanna Safari Co.','savanna-safari-co','info@safarico.com','KE','KES',1,1,datetime('now'),datetime('now'));

INSERT OR IGNORE INTO provider_memberships (id, provider_id, user_id, member_role, is_active, created_at) VALUES
  ('mem_001','prv_001','usr_provider_001','owner',1,datetime('now'));

INSERT OR IGNORE INTO provider_settings (provider_id, settlement_delay_days, commission_bps, updated_at) VALUES
  ('prv_001',3,1000,datetime('now'));

INSERT OR IGNORE INTO provider_payout_accounts (id, provider_id, account_type, account_number, account_name, network_code, country_code, currency_code, is_default, is_verified, created_at, updated_at) VALUES
  ('poa_001','prv_001','mobile_money','254700000001','Savanna Safari Mpesa','MPESA','KE','KES',1,1,datetime('now'),datetime('now'));

INSERT OR IGNORE INTO destinations (id, name, slug, country_code, is_active, created_at) VALUES
  ('dst_001','Maasai Mara','maasai-mara','KE',1,datetime('now')),
  ('dst_002','Diani Beach','diani-beach','KE',1,datetime('now')),
  ('dst_003','Amboseli','amboseli','KE',1,datetime('now'));

INSERT OR IGNORE INTO listing_categories (id, name, slug, is_active, created_at) VALUES
  ('cat_001','Safari Tours','safari-tours',1,datetime('now')),
  ('cat_002','Beach Resorts','beach-resorts',1,datetime('now')),
  ('cat_003','Mountain Treks','mountain-treks',1,datetime('now'));

INSERT OR IGNORE INTO listings (id, provider_id, category_id, destination_id, type, status, title, slug, short_description, description, base_price_amount, currency_code, duration_minutes, max_capacity, min_guests, is_instant_booking, tags, created_at, updated_at) VALUES
  ('lst_001','prv_001','cat_001','dst_001','tour','active','3-Day Maasai Mara Safari','3-day-maasai-mara-safari','Experience the Big Five on our award-winning Maasai Mara safari.','Immerse yourself in the breathtaking Maasai Mara National Reserve on this 3-day safari.',45000000,'KES',4320,8,2,0,'["safari","kenya","wildlife"]',datetime('now'),datetime('now'));

INSERT OR IGNORE INTO pricing_rules (id, listing_id, name, price_amount, currency_code, unit_type, min_units, is_active, created_at, updated_at) VALUES
  ('pr_001','lst_001','Adult',45000000,'KES','per_person',1,1,datetime('now'),datetime('now')),
  ('pr_002','lst_001','Child (under 12)',22500000,'KES','per_person',1,1,datetime('now'),datetime('now'));

-- System-wide asset accounts (1xxx)
INSERT OR IGNORE INTO ledger_accounts (id, code, name, type, provider_id, is_active, created_at) VALUES
  ('lac_1100','1100','Cash Clearing',  'asset',  null,1,datetime('now')),
  ('lac_1200','1200','Cash Outgoing',  'asset',  null,1,datetime('now'));

-- System-wide liability accounts (2xxx)
INSERT OR IGNORE INTO ledger_accounts (id, code, name, type, provider_id, is_active, created_at) VALUES
  ('lac_2000','2000','Provider Payable',         'liability',null,1,datetime('now')),
  ('lac_2100','2100','Refund Liability',          'liability',null,1,datetime('now')),
  ('lac_2200','2200','VAT Payable',               'liability',null,1,datetime('now')),
  ('lac_2300','2300','Stamp Duty Payable',        'liability',null,1,datetime('now')),
  ('lac_2400','2400','Tourism Levy Payable',      'liability',null,1,datetime('now')),
  ('lac_2500','2500','Withholding Tax Payable',   'liability',null,1,datetime('now'));

-- Revenue accounts (4xxx)
INSERT OR IGNORE INTO ledger_accounts (id, code, name, type, provider_id, is_active, created_at) VALUES
  ('lac_4000','4000','Platform Commission Revenue','revenue',null,1,datetime('now')),
  ('lac_4100','4100','Platform Fee Revenue',        'revenue',null,1,datetime('now')),
  ('lac_4200','4200','FX Conversion Revenue',       'revenue',null,1,datetime('now'));

-- Expense accounts (6xxx)
INSERT OR IGNORE INTO ledger_accounts (id, code, name, type, provider_id, is_active, created_at) VALUES
  ('lac_6000','6000','Refund Expense','expense',null,1,datetime('now'));

-- Clearing / suspense accounts (9xxx)
INSERT OR IGNORE INTO ledger_accounts (id, code, name, type, provider_id, is_active, created_at) VALUES
  ('lac_9900','9900','Manual Debit Clearing', 'equity',null,1,datetime('now')),
  ('lac_9901','9901','Manual Credit Clearing','equity',null,1,datetime('now'));

-- Provider subledger accounts for seed provider prv_001
INSERT OR IGNORE INTO ledger_accounts (id, code, name, type, provider_id, is_active, created_at) VALUES
  ('lac_prv001_hold',    '7100','Provider Hold — Savanna Safari',             'liability','prv_001',1,datetime('now')),
  ('lac_prv001_payable', '7200','Provider Payable — Savanna Safari',          'liability','prv_001',1,datetime('now')),
  ('lac_prv001_transit', '7300','Provider Payout In Transit — Savanna Safari','liability','prv_001',1,datetime('now')),
  ('lac_prv001_cleared', '7400','Provider Payout Cleared — Savanna Safari',   'liability','prv_001',1,datetime('now'));

INSERT OR IGNORE INTO bookings (id, reference, customer_id, provider_id, listing_id, status, service_date, guest_count, subtotal_amount, commission_amount, tax_amount, total_amount, currency_code, confirmed_at, created_at, updated_at) VALUES
  ('bk_001','BK-2024-00001','usr_customer_001','prv_001','lst_001','confirmed','2024-04-15',2,90000000,9000000,0,90000000,'KES',datetime('now','-1 day'),datetime('now','-2 days'),datetime('now','-2 days'));

INSERT OR IGNORE INTO booking_items (id, booking_id, listing_id, pricing_rule_id, description, quantity, unit_price, total_price, provider_id, provider_payable_amount, platform_commission_amount, created_at) VALUES
  ('bi_001','bk_001','lst_001','pr_001','Adult Safari (3 days)',2,45000000,90000000,'prv_001',81000000,9000000,datetime('now','-2 days'));

INSERT OR IGNORE INTO travelers (id, booking_id, first_name, last_name, is_primary, created_at) VALUES
  ('trv_001','bk_001','John','Customer',1,datetime('now','-2 days')),
  ('trv_002','bk_001','Jane','Customer',0,datetime('now','-2 days'));

INSERT OR IGNORE INTO payments (id, booking_id, customer_id, status, amount, currency_code, tingg_merchant_tx_id, tingg_transaction_ref, idempotency_key, paid_at, created_at, updated_at) VALUES
  ('pay_001','bk_001','usr_customer_001','succeeded',90000000,'KES','MTX-BK-2024-00001','TINGG-TX-123456','idem-pay-001',datetime('now','-1 day'),datetime('now','-2 days'),datetime('now','-2 days'));

INSERT OR IGNORE INTO provider_callback_subscriptions (id, provider_id, url, events, is_active, secret_hash, secret_hint, max_retries, timeout_ms, created_at, updated_at) VALUES
  ('whs_001','prv_001','https://safarico.com/webhooks/felix','["booking.confirmed","payment.succeeded","payout.completed"]',1,'sha256_placeholder_hash','xxxx',5,10000,datetime('now'),datetime('now'));
