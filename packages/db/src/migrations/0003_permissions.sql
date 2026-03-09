-- Migration 0003: Permissions & RBAC tables + system seed data
--
-- Creates: roles, permissions, role_permissions, user_roles, org_units
-- Seeds:   system roles, permissions, role-permission mappings, admin user role

-- ── 1. DDL — Create permission tables ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id            TEXT    NOT NULL PRIMARY KEY,
  slug          TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  description   TEXT    NOT NULL DEFAULT '',
  is_exclusive  INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_slug ON roles (slug);

CREATE TABLE IF NOT EXISTS permissions (
  id            TEXT    NOT NULL PRIMARY KEY,
  code          TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  description   TEXT    NOT NULL DEFAULT '',
  group_name    TEXT    NOT NULL DEFAULT 'General',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_permissions_code ON permissions (code);
CREATE INDEX IF NOT EXISTS idx_permissions_group ON permissions (group_name);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_role_permissions ON role_permissions (role_id, permission_id);

CREATE TABLE IF NOT EXISTS user_roles (
  id            TEXT    NOT NULL PRIMARY KEY,
  user_id       TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id       TEXT    NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  provider_id   TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  granted_by    TEXT    NOT NULL,
  granted_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  revoked_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles (role_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_user_role_provider ON user_roles (user_id, role_id, provider_id);

CREATE TABLE IF NOT EXISTS org_units (
  id            TEXT    NOT NULL PRIMARY KEY,
  name          TEXT    NOT NULL,
  parent_id     TEXT,
  type          TEXT    NOT NULL CHECK (type IN ('platform','provider','department')),
  provider_id   TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_org_units_parent ON org_units (parent_id);
CREATE INDEX IF NOT EXISTS idx_org_units_provider ON org_units (provider_id);

-- ── 2. Seed: System Roles ─────────────────────────────────────────────────────

INSERT OR IGNORE INTO roles (id, slug, name, description, is_exclusive, is_active, created_at)
VALUES
  ('role_platform_admin', 'platform_admin', 'Platform Administrator', 'Full platform access', 0, 1, datetime('now')),
  ('role_platform_ops', 'platform_ops', 'Platform Operations', 'Operational access without config changes', 0, 1, datetime('now')),
  ('role_finance_admin', 'finance_admin', 'Finance Administrator', 'Full financial access including ledger', 0, 1, datetime('now')),
  ('role_finance_ops', 'finance_ops', 'Finance Operations', 'Process payouts and view financials', 0, 1, datetime('now')),
  ('role_customer_support', 'customer_support', 'Customer Support', 'Handle customer inquiries and booking management', 0, 1, datetime('now')),
  ('role_compliance', 'compliance', 'Compliance Officer', 'Audit access and compliance reporting', 0, 1, datetime('now')),
  ('role_provider_owner', 'provider_owner', 'Provider Owner', 'Full access to own provider account', 1, 1, datetime('now')),
  ('role_provider_manager', 'provider_manager', 'Provider Manager', 'Manage bookings and view financials for own provider', 1, 1, datetime('now')),
  ('role_provider_staff', 'provider_staff', 'Provider Staff', 'View and handle operational tasks for own provider', 0, 1, datetime('now')),
  ('role_customer', 'customer', 'Customer', 'Book and manage own bookings', 0, 1, datetime('now')),
  ('role_agent', 'agent', 'Travel Agent', 'Create and manage bookings on behalf of customers', 0, 1, datetime('now')),
  ('role_readonly_admin', 'readonly_admin', 'Read-Only Admin', 'View all data without modification rights', 0, 1, datetime('now'));

-- ── 3. Seed: System Permissions ───────────────────────────────────────────────

INSERT OR IGNORE INTO permissions (id, code, name, description, group_name, created_at) VALUES
  ('perm_admin_access', 'admin:access', 'Admin Access', 'Access the admin panel and admin-only APIs', 'Admin', datetime('now')),
  ('perm_booking_create', 'booking:create', 'Create Booking', 'Create new bookings', 'Bookings', datetime('now')),
  ('perm_booking_view_own', 'booking:view:own', 'View Own Bookings', 'View bookings you created or belong to', 'Bookings', datetime('now')),
  ('perm_booking_view_all', 'booking:view:all', 'View All Bookings', 'View all bookings on the platform', 'Bookings', datetime('now')),
  ('perm_booking_confirm', 'booking:confirm', 'Confirm Booking', 'Confirm a booking (transition from draft)', 'Bookings', datetime('now')),
  ('perm_booking_cancel', 'booking:cancel', 'Cancel Booking', 'Cancel a booking', 'Bookings', datetime('now')),
  ('perm_booking_cancel_any', 'booking:cancel:any', 'Cancel Any Booking', 'Cancel any booking regardless of ownership', 'Bookings', datetime('now')),
  ('perm_catalog_view', 'catalog:view', 'View Catalog', 'Browse listings and catalog', 'Catalog', datetime('now')),
  ('perm_catalog_manage', 'catalog:manage', 'Manage Catalog', 'Create, update, delete listings', 'Catalog', datetime('now')),
  ('perm_charge_simulate', 'charge:simulate', 'Simulate Charges', 'Run charge simulations and previews', 'Charges', datetime('now')),
  ('perm_charge_manage', 'charge:manage', 'Manage Charge Definitions', 'Create and update charge engine definitions', 'Charges', datetime('now')),
  ('perm_ledger_view', 'ledger:view', 'View Ledger', 'View ledger accounts and entries', 'Ledger', datetime('now')),
  ('perm_ledger_adjust', 'ledger:adjust', 'Manual Ledger Adjustment', 'Create manual ledger adjustments', 'Ledger', datetime('now')),
  ('perm_payment_initiate', 'payment:initiate', 'Initiate Payment', 'Initiate checkout or charge flow', 'Payments', datetime('now')),
  ('perm_payment_view_own', 'payment:view:own', 'View Own Payments', 'View your own payment status', 'Payments', datetime('now')),
  ('perm_payment_view_all', 'payment:view:all', 'View All Payments', 'View all payments', 'Payments', datetime('now')),
  ('perm_payment_refund_request', 'payment:refund:request', 'Request Refund', 'Request a refund on a payment', 'Payments', datetime('now')),
  ('perm_payment_refund_approve', 'payment:refund:approve', 'Approve Refund', 'Approve a refund request', 'Payments', datetime('now')),
  ('perm_payment_refund_reject', 'payment:refund:reject', 'Reject Refund', 'Reject a refund request', 'Payments', datetime('now')),
  ('perm_payout_run', 'payout:run', 'Run Payout', 'Trigger a payout batch for a provider', 'Payouts', datetime('now')),
  ('perm_payout_view_own', 'payout:view:own', 'View Own Payouts', 'View your own payout status', 'Payouts', datetime('now')),
  ('perm_payout_view_all', 'payout:view:all', 'View All Payouts', 'View all payouts', 'Payouts', datetime('now')),
  ('perm_payout_approve', 'payout:approve', 'Approve Payout', 'Approve a payout requiring maker-checker', 'Payouts', datetime('now')),
  ('perm_payout_reject', 'payout:reject', 'Reject Payout', 'Reject a payout on hold', 'Payouts', datetime('now')),
  ('perm_provider_onboard', 'provider:onboard', 'Onboard Provider', 'Register a new service provider', 'Providers', datetime('now')),
  ('perm_provider_view_own', 'provider:view:own', 'View Own Provider', 'View own provider profile and settings', 'Providers', datetime('now')),
  ('perm_provider_view_all', 'provider:view:all', 'View All Providers', 'View all providers', 'Providers', datetime('now')),
  ('perm_provider_manage', 'provider:manage', 'Manage Providers', 'Update provider profiles and settings', 'Providers', datetime('now')),
  ('perm_provider_verify', 'provider:verify', 'Verify Provider', 'Mark a provider as verified', 'Providers', datetime('now')),
  ('perm_user_view_all', 'user:view:all', 'View All Users', 'View all user accounts', 'Users', datetime('now')),
  ('perm_user_manage', 'user:manage', 'Manage Users', 'Update user accounts', 'Users', datetime('now')),
  ('perm_user_invite', 'user:invite', 'Invite Users', 'Send user invitations', 'Users', datetime('now')),
  ('perm_report_provider_own', 'report:provider:own', 'Own Provider Reports', 'View own provider financial reports', 'Reports', datetime('now')),
  ('perm_report_platform', 'report:platform', 'Platform Reports', 'View platform-wide financial reports', 'Reports', datetime('now')),
  ('perm_report_audit', 'report:audit', 'Audit Reports', 'View audit logs and compliance reports', 'Reports', datetime('now'));

-- ── 4. Seed: Role–Permission Mappings ─────────────────────────────────────────

-- platform_admin — all permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'admin:access';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'booking:create';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'booking:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'booking:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'booking:confirm';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'booking:cancel';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'booking:cancel:any';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'catalog:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'catalog:manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'charge:simulate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'charge:manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'ledger:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'ledger:adjust';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payment:initiate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payment:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payment:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payment:refund:request';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payment:refund:approve';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payment:refund:reject';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payout:run';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payout:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payout:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payout:approve';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'payout:reject';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'provider:onboard';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'provider:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'provider:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'provider:manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'provider:verify';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'user:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'user:manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'user:invite';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'report:provider:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'report:platform';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_admin' AND p.code = 'report:audit';

-- platform_ops
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'admin:access';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'booking:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'booking:cancel:any';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'catalog:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'catalog:manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'payment:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'payment:refund:approve';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'payment:refund:reject';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'payout:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'provider:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'user:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'platform_ops' AND p.code = 'report:audit';

-- finance_admin
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'admin:access';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'booking:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'charge:simulate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'charge:manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'ledger:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'ledger:adjust';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'payment:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'payment:refund:approve';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'payout:run';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'payout:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'payout:approve';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'payout:reject';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'report:platform';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_admin' AND p.code = 'report:audit';

-- finance_ops
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'admin:access';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'booking:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'charge:simulate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'ledger:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'payment:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'payment:refund:approve';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'payout:run';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'payout:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'payout:approve';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'finance_ops' AND p.code = 'report:platform';

-- customer_support
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'admin:access';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'booking:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'booking:cancel:any';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'catalog:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'payment:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'payment:refund:request';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'provider:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'user:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer_support' AND p.code = 'report:audit';

-- compliance
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'admin:access';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'booking:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'ledger:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'payment:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'payout:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'report:platform';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'report:audit';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'compliance' AND p.code = 'report:provider:own';

-- provider_owner
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'booking:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'booking:confirm';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'booking:cancel';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'charge:simulate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'payout:run';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'payout:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'provider:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'provider:manage';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'report:provider:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_owner' AND p.code = 'payment:refund:request';

-- provider_manager
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_manager' AND p.code = 'booking:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_manager' AND p.code = 'booking:confirm';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_manager' AND p.code = 'booking:cancel';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_manager' AND p.code = 'payout:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_manager' AND p.code = 'provider:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_manager' AND p.code = 'report:provider:own';

-- provider_staff
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_staff' AND p.code = 'booking:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'provider_staff' AND p.code = 'provider:view:own';

-- customer
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'booking:create';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'booking:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'booking:confirm';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'booking:cancel';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'catalog:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'payment:initiate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'payment:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'customer' AND p.code = 'payment:refund:request';

-- agent
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'agent' AND p.code = 'booking:create';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'agent' AND p.code = 'booking:view:own';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'agent' AND p.code = 'booking:confirm';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'agent' AND p.code = 'booking:cancel';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'agent' AND p.code = 'catalog:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'agent' AND p.code = 'payment:initiate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'agent' AND p.code = 'payment:view:own';

-- readonly_admin
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'admin:access';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'booking:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'catalog:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'charge:simulate';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'ledger:view';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'payment:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'payout:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'provider:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'user:view:all';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'report:platform';
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at) SELECT r.id, p.id, datetime('now') FROM roles r, permissions p WHERE r.slug = 'readonly_admin' AND p.code = 'report:audit';

-- ── 5. Seed: Admin user role assignment ───────────────────────────────────────
-- Assign platform_admin to the bootstrap admin user (usr_admin_001).
-- Other demo users (agent, customer, provider) are only seeded in dev via seed.sql.

INSERT OR IGNORE INTO user_roles (id, user_id, role_id, provider_id, is_active, granted_by, granted_at)
SELECT 'ur_001', 'usr_admin_001', r.id, NULL, 1, 'system', datetime('now')
FROM roles r WHERE r.slug = 'platform_admin';

-- ── 6. Backfill: Assign 'customer' role to all existing users who have role='customer' but no user_roles row
INSERT OR IGNORE INTO user_roles (id, user_id, role_id, provider_id, is_active, granted_by, granted_at)
SELECT 'ur_auto_' || u.id, u.id, r.id, NULL, 1, 'system', datetime('now')
FROM users u, roles r
WHERE u.role = 'customer' AND r.slug = 'customer'
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id);
