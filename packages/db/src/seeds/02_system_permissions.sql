-- Seed: System Permissions
-- Order: 02
-- Description: Insert all platform-defined permissions, grouped by functional area.
--              IDs follow the pattern perm_<snake_case_of_code>.

-- ─── Group: Admin ─────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO permissions (id, code, name, description, group_name, created_at)
VALUES
  (
    'perm_admin_access',
    'admin:access',
    'Admin Access',
    'Access the admin panel and admin-only APIs',
    'Admin',
    datetime('now')
  );

-- ─── Group: Bookings ──────────────────────────────────────────────────────────

INSERT OR IGNORE INTO permissions (id, code, name, description, group_name, created_at)
VALUES
  (
    'perm_booking_create',
    'booking:create',
    'Create Booking',
    'Create new bookings',
    'Bookings',
    datetime('now')
  ),
  (
    'perm_booking_view_own',
    'booking:view:own',
    'View Own Bookings',
    'View bookings you created or belong to',
    'Bookings',
    datetime('now')
  ),
  (
    'perm_booking_view_all',
    'booking:view:all',
    'View All Bookings',
    'View all bookings on the platform',
    'Bookings',
    datetime('now')
  ),
  (
    'perm_booking_confirm',
    'booking:confirm',
    'Confirm Booking',
    'Confirm a booking (transition from draft)',
    'Bookings',
    datetime('now')
  ),
  (
    'perm_booking_cancel',
    'booking:cancel',
    'Cancel Booking',
    'Cancel a booking',
    'Bookings',
    datetime('now')
  ),
  (
    'perm_booking_cancel_any',
    'booking:cancel:any',
    'Cancel Any Booking',
    'Cancel any booking regardless of ownership',
    'Bookings',
    datetime('now')
  );

-- ─── Group: Catalog ───────────────────────────────────────────────────────────

INSERT OR IGNORE INTO permissions (id, code, name, description, group_name, created_at)
VALUES
  (
    'perm_catalog_view',
    'catalog:view',
    'View Catalog',
    'Browse listings and catalog',
    'Catalog',
    datetime('now')
  ),
  (
    'perm_catalog_manage',
    'catalog:manage',
    'Manage Catalog',
    'Create, update, delete listings',
    'Catalog',
    datetime('now')
  );

-- ─── Group: Charges ───────────────────────────────────────────────────────────

INSERT OR IGNORE INTO permissions (id, code, name, description, group_name, created_at)
VALUES
  (
    'perm_charge_simulate',
    'charge:simulate',
    'Simulate Charges',
    'Run charge simulations and previews',
    'Charges',
    datetime('now')
  ),
  (
    'perm_charge_manage',
    'charge:manage',
    'Manage Charge Definitions',
    'Create and update charge engine definitions',
    'Charges',
    datetime('now')
  );

-- ─── Group: Ledger ────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO permissions (id, code, name, description, group_name, created_at)
VALUES
  (
    'perm_ledger_view',
    'ledger:view',
    'View Ledger',
    'View ledger accounts and entries',
    'Ledger',
    datetime('now')
  ),
  (
    'perm_ledger_adjust',
    'ledger:adjust',
    'Manual Ledger Adjustment',
    'Create manual ledger adjustments',
    'Ledger',
    datetime('now')
  );

-- ─── Group: Payments ──────────────────────────────────────────────────────────

INSERT OR IGNORE INTO permissions (id, code, name, description, group_name, created_at)
VALUES
  (
    'perm_payment_initiate',
    'payment:initiate',
    'Initiate Payment',
    'Initiate checkout or charge flow',
    'Payments',
    datetime('now')
  ),
  (
    'perm_payment_view_own',
    'payment:view:own',
    'View Own Payments',
    'View your own payment status',
    'Payments',
    datetime('now')
  ),
  (
    'perm_payment_view_all',
    'payment:view:all',
    'View All Payments',
    'View all payments',
    'Payments',
    datetime('now')
  ),
  (
    'perm_payment_refund_request',
    'payment:refund:request',
    'Request Refund',
    'Request a refund on a payment',
    'Payments',
    datetime('now')
  ),
  (
    'perm_payment_refund_approve',
    'payment:refund:approve',
    'Approve Refund',
    'Approve a refund request',
    'Payments',
    datetime('now')
  ),
  (
    'perm_payment_refund_reject',
    'payment:refund:reject',
    'Reject Refund',
    'Reject a refund request',
    'Payments',
    datetime('now')
  );

-- ─── Group: Payouts ───────────────────────────────────────────────────────────

INSERT OR IGNORE INTO permissions (id, code, name, description, group_name, created_at)
VALUES
  (
    'perm_payout_run',
    'payout:run',
    'Run Payout',
    'Trigger a payout batch for a provider',
    'Payouts',
    datetime('now')
  ),
  (
    'perm_payout_view_own',
    'payout:view:own',
    'View Own Payouts',
    'View your own payout status',
    'Payouts',
    datetime('now')
  ),
  (
    'perm_payout_view_all',
    'payout:view:all',
    'View All Payouts',
    'View all payouts',
    'Payouts',
    datetime('now')
  ),
  (
    'perm_payout_approve',
    'payout:approve',
    'Approve Payout',
    'Approve a payout requiring maker-checker',
    'Payouts',
    datetime('now')
  ),
  (
    'perm_payout_reject',
    'payout:reject',
    'Reject Payout',
    'Reject a payout on hold',
    'Payouts',
    datetime('now')
  );

-- ─── Group: Providers ─────────────────────────────────────────────────────────

INSERT OR IGNORE INTO permissions (id, code, name, description, group_name, created_at)
VALUES
  (
    'perm_provider_onboard',
    'provider:onboard',
    'Onboard Provider',
    'Register a new service provider',
    'Providers',
    datetime('now')
  ),
  (
    'perm_provider_view_own',
    'provider:view:own',
    'View Own Provider',
    'View own provider profile and settings',
    'Providers',
    datetime('now')
  ),
  (
    'perm_provider_view_all',
    'provider:view:all',
    'View All Providers',
    'View all providers',
    'Providers',
    datetime('now')
  ),
  (
    'perm_provider_manage',
    'provider:manage',
    'Manage Providers',
    'Update provider profiles and settings',
    'Providers',
    datetime('now')
  ),
  (
    'perm_provider_verify',
    'provider:verify',
    'Verify Provider',
    'Mark a provider as verified',
    'Providers',
    datetime('now')
  );

-- ─── Group: Users ─────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO permissions (id, code, name, description, group_name, created_at)
VALUES
  (
    'perm_user_view_all',
    'user:view:all',
    'View All Users',
    'View all user accounts',
    'Users',
    datetime('now')
  ),
  (
    'perm_user_manage',
    'user:manage',
    'Manage Users',
    'Update user accounts',
    'Users',
    datetime('now')
  ),
  (
    'perm_user_invite',
    'user:invite',
    'Invite Users',
    'Send user invitations',
    'Users',
    datetime('now')
  );

-- ─── Group: Reports ───────────────────────────────────────────────────────────

INSERT OR IGNORE INTO permissions (id, code, name, description, group_name, created_at)
VALUES
  (
    'perm_report_provider_own',
    'report:provider:own',
    'Own Provider Reports',
    'View own provider financial reports',
    'Reports',
    datetime('now')
  ),
  (
    'perm_report_platform',
    'report:platform',
    'Platform Reports',
    'View platform-wide financial reports',
    'Reports',
    datetime('now')
  ),
  (
    'perm_report_audit',
    'report:audit',
    'Audit Reports',
    'View audit logs and compliance reports',
    'Reports',
    datetime('now')
  );
