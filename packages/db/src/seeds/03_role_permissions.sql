-- Seed: Role–Permission Mappings
-- Order: 03
-- Description: Assign permissions to roles using slug/code lookups so that
--              this file remains correct even if IDs are regenerated.
--              Each INSERT resolves role_id and permission_id via a cross-join
--              filtered by slug and code.

-- ─── platform_admin — all permissions ────────────────────────────────────────

INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'admin:access';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'booking:create';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'booking:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'booking:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'booking:confirm';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'booking:cancel';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'booking:cancel:any';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'catalog:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'catalog:manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'charge:simulate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'charge:manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'ledger:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'ledger:adjust';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payment:initiate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payment:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payment:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payment:refund:request';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payment:refund:approve';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payment:refund:reject';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payout:run';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payout:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payout:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payout:approve';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payout:reject';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'provider:onboard';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'provider:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'provider:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'provider:manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'provider:verify';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'user:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'user:manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'user:invite';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'report:provider:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'report:platform';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'report:audit';

-- ─── platform_ops ─────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'admin:access';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'booking:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'booking:cancel:any';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'catalog:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'catalog:manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'payment:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'payment:refund:approve';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'payment:refund:reject';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'payout:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'provider:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'user:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'report:audit';

-- ─── finance_admin ────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'admin:access';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'booking:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'charge:simulate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'charge:manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'ledger:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'ledger:adjust';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'payment:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'payment:refund:approve';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'payout:run';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'payout:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'payout:approve';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'payout:reject';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'report:platform';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'report:audit';

-- ─── finance_ops ──────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'admin:access';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'booking:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'charge:simulate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'ledger:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'payment:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'payment:refund:approve';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'payout:run';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'payout:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'payout:approve';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'report:platform';

-- ─── customer_support ─────────────────────────────────────────────────────────

INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'admin:access';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'booking:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'booking:cancel:any';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'catalog:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'payment:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'payment:refund:request';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'provider:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'user:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'report:audit';

-- ─── compliance ───────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'admin:access';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'booking:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'ledger:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'payment:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'payout:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'report:platform';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'report:audit';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'report:provider:own';

-- ─── provider_owner ───────────────────────────────────────────────────────────

INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'booking:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'booking:confirm';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'booking:cancel';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'charge:simulate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'payout:run';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'payout:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'provider:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'provider:manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'report:provider:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'payment:refund:request';

-- ─── provider_manager ─────────────────────────────────────────────────────────

INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_manager' AND p.code = 'booking:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_manager' AND p.code = 'booking:confirm';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_manager' AND p.code = 'booking:cancel';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_manager' AND p.code = 'payout:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_manager' AND p.code = 'provider:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_manager' AND p.code = 'report:provider:own';

-- ─── provider_staff ───────────────────────────────────────────────────────────

INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_staff' AND p.code = 'booking:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_staff' AND p.code = 'provider:view:own';

-- ─── customer ─────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'booking:create';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'booking:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'booking:confirm';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'booking:cancel';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'catalog:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'payment:initiate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'payment:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'payment:refund:request';

-- ─── agent ────────────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'agent' AND p.code = 'booking:create';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'agent' AND p.code = 'booking:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'agent' AND p.code = 'booking:confirm';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'agent' AND p.code = 'booking:cancel';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'agent' AND p.code = 'catalog:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'agent' AND p.code = 'payment:initiate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'agent' AND p.code = 'payment:view:own';

-- ─── readonly_admin ───────────────────────────────────────────────────────────

INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'admin:access';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'booking:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'catalog:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'charge:simulate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'ledger:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'payment:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'payout:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'provider:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'user:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'report:platform';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'report:audit';
