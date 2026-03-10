-- 0005_seed_provider_users.sql
-- Creates login-able user accounts for the three seed service providers,
-- along with profiles, user_roles (provider_owner), and provider_memberships (owner).
--
-- Credentials (for dev/staging only — rotate before production):
--   savanna@safarico.com        / SavannaProvider2026!
--   hello@coastalescapes.co.ke  / CoastalProvider2026!
--   info@summittrails.co.ke     / SummitProvider2026!

-- ── 1. Users ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO users (id, email, email_verified, phone, phone_verified, password_hash, role, is_active, created_at, updated_at) VALUES
  ('usr_prv_001', 'savanna@safarico.com',       1, '+254700000001', 1,
   'pbkdf2:100000:3a886c13470d87baa50c75b1610914c99791847fe1234d98ab3b49c12150c1d1:af89091c7173e015a14153bb478d3073daca8b8344aa2252e3d22cd5e2f5768d',
   'service_provider', 1, datetime('now'), datetime('now')),

  ('usr_prv_002', 'hello@coastalescapes.co.ke',  1, '+254711000002', 1,
   'pbkdf2:100000:01ebacb15aa5c661733ef5286a273f3f9ca30f00dc062bdffbb16ae69c662b27:82d24f53b51dfc7639c9eb3adcd8c72ca19d4691b88ca7455fd7c6306d9bada3',
   'service_provider', 1, datetime('now'), datetime('now')),

  ('usr_prv_003', 'info@summittrails.co.ke',     1, '+254722000003', 1,
   'pbkdf2:100000:58438424591dc32acd197db1e9d1216a4e4ded5a56130aeff0007044a980472b:aff19878517d8d11443aa63a3da167a0ca8da0aaa98f32105232409f8ac92c39',
   'service_provider', 1, datetime('now'), datetime('now'));

-- ── 2. Profiles ──────────────────────────────────────────────────
INSERT OR IGNORE INTO profiles (user_id, first_name, last_name, display_name, created_at, updated_at) VALUES
  ('usr_prv_001', 'James',   'Mwangi',   'James Mwangi — Savanna Safari',   datetime('now'), datetime('now')),
  ('usr_prv_002', 'Amina',   'Hassan',   'Amina Hassan — Coastal Escapes',  datetime('now'), datetime('now')),
  ('usr_prv_003', 'David',   'Kimathi',  'David Kimathi — Summit Trails',   datetime('now'), datetime('now'));

-- ── 3. User roles (provider_owner) ──────────────────────────────
INSERT OR IGNORE INTO user_roles (id, user_id, role_id, provider_id, is_active, granted_by, granted_at)
SELECT 'ur_prv_001', 'usr_prv_001', r.id, 'prv_001', 1, 'system', datetime('now')
FROM roles r WHERE r.slug = 'provider_owner';

INSERT OR IGNORE INTO user_roles (id, user_id, role_id, provider_id, is_active, granted_by, granted_at)
SELECT 'ur_prv_002', 'usr_prv_002', r.id, 'prv_002', 1, 'system', datetime('now')
FROM roles r WHERE r.slug = 'provider_owner';

INSERT OR IGNORE INTO user_roles (id, user_id, role_id, provider_id, is_active, granted_by, granted_at)
SELECT 'ur_prv_003', 'usr_prv_003', r.id, 'prv_003', 1, 'system', datetime('now')
FROM roles r WHERE r.slug = 'provider_owner';

-- ── 4. Provider memberships (owner) ─────────────────────────────
INSERT OR IGNORE INTO provider_memberships (id, provider_id, user_id, member_role, is_active, created_at) VALUES
  ('pm_001', 'prv_001', 'usr_prv_001', 'owner', 1, datetime('now')),
  ('pm_002', 'prv_002', 'usr_prv_002', 'owner', 1, datetime('now')),
  ('pm_003', 'prv_003', 'usr_prv_003', 'owner', 1, datetime('now'));
