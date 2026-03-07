-- Seed: System Roles
-- Order: 01
-- Description: Insert platform-defined roles. All roles are active by default.
--              is_exclusive = 1 means a user may only hold one role of this type
--              (used for provider-scoped roles that carry a provider_id in user_roles).

INSERT OR IGNORE INTO roles (id, slug, name, description, is_exclusive, is_active, created_at)
VALUES
  (
    'role_platform_admin',
    'platform_admin',
    'Platform Administrator',
    'Full platform access',
    0,
    1,
    datetime('now')
  ),
  (
    'role_platform_ops',
    'platform_ops',
    'Platform Operations',
    'Operational access without config changes',
    0,
    1,
    datetime('now')
  ),
  (
    'role_finance_admin',
    'finance_admin',
    'Finance Administrator',
    'Full financial access including ledger',
    0,
    1,
    datetime('now')
  ),
  (
    'role_finance_ops',
    'finance_ops',
    'Finance Operations',
    'Process payouts and view financials',
    0,
    1,
    datetime('now')
  ),
  (
    'role_customer_support',
    'customer_support',
    'Customer Support',
    'Handle customer inquiries and booking management',
    0,
    1,
    datetime('now')
  ),
  (
    'role_compliance',
    'compliance',
    'Compliance Officer',
    'Audit access and compliance reporting',
    0,
    1,
    datetime('now')
  ),
  (
    'role_provider_owner',
    'provider_owner',
    'Provider Owner',
    'Full access to own provider account',
    1,
    1,
    datetime('now')
  ),
  (
    'role_provider_manager',
    'provider_manager',
    'Provider Manager',
    'Manage bookings and view financials for own provider',
    1,
    1,
    datetime('now')
  ),
  (
    'role_provider_staff',
    'provider_staff',
    'Provider Staff',
    'View and handle operational tasks for own provider',
    0,
    1,
    datetime('now')
  ),
  (
    'role_customer',
    'customer',
    'Customer',
    'Book and manage own bookings',
    0,
    1,
    datetime('now')
  ),
  (
    'role_agent',
    'agent',
    'Travel Agent',
    'Create and manage bookings on behalf of customers',
    0,
    1,
    datetime('now')
  ),
  (
    'role_readonly_admin',
    'readonly_admin',
    'Read-Only Admin',
    'View all data without modification rights',
    0,
    1,
    datetime('now')
  );
