-- Seed: Demo User Role Assignments
-- Order: 04
-- Description: Assign roles to the seeded demo users.
--              role_id is resolved by slug to avoid hardcoded IDs.
--              provider_id is set where the role is provider-scoped (is_exclusive = 1).

INSERT OR IGNORE INTO user_roles (id, user_id, role_id, provider_id, is_active, granted_by, granted_at)
SELECT 'ur_001', 'usr_admin_001', r.id, NULL, 1, 'system', datetime('now')
FROM roles r WHERE r.slug = 'platform_admin';

INSERT OR IGNORE INTO user_roles (id, user_id, role_id, provider_id, is_active, granted_by, granted_at)
SELECT 'ur_002', 'usr_agent_001', r.id, NULL, 1, 'system', datetime('now')
FROM roles r WHERE r.slug = 'agent';

INSERT OR IGNORE INTO user_roles (id, user_id, role_id, provider_id, is_active, granted_by, granted_at)
SELECT 'ur_003', 'usr_customer_001', r.id, NULL, 1, 'system', datetime('now')
FROM roles r WHERE r.slug = 'customer';

INSERT OR IGNORE INTO user_roles (id, user_id, role_id, provider_id, is_active, granted_by, granted_at)
SELECT 'ur_004', 'usr_provider_001', r.id, 'prv_001', 1, 'system', datetime('now')
FROM roles r WHERE r.slug = 'provider_owner';
