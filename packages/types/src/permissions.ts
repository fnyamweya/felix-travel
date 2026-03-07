/**
 * Permissions and expanded role types.
 *
 * Roles are data stored in DB and seeded centrally.
 * Permissions/capabilities are granular and mapped via role_permissions.
 * Services use authorize() and evaluateAction() instead of checking roles directly.
 */
import type { DateTimeString } from './common.js';

/**
 * Expanded role slugs. These exist only in type definitions, seed data,
 * and centralized auth infrastructure — never in domain service branching.
 */
export type RoleSlug =
    | 'super_admin'
    | 'admin'
    | 'finance_admin'
    | 'finance_approver'
    | 'operations_admin'
    | 'support_admin'
    | 'risk_analyst'
    | 'compliance_admin'
    | 'reconciliation_admin'
    | 'catalog_admin'
    | 'pricing_admin'
    | 'refund_reviewer'
    | 'refund_approver'
    | 'payout_operator'
    | 'payout_approver'
    | 'auditor'
    | 'agent'
    | 'agent_supervisor'
    | 'customer'
    | 'service_provider'
    | 'provider_owner'
    | 'provider_manager'
    | 'provider_finance'
    | 'provider_ops'
    | 'provider_inventory_manager';

/**
 * Roles classified by privilege tier for MFA and step-up policy.
 * Privileged roles require TOTP MFA as primary method.
 */
export const PRIVILEGED_ROLES: ReadonlySet<string> = new Set([
    'super_admin',
    'admin',
    'finance_admin',
    'finance_approver',
    'operations_admin',
    'compliance_admin',
    'reconciliation_admin',
    'payout_approver',
    'refund_approver',
]);

/** Role families for high-level navigation grouping in the dashboard */
export type RoleFamily = 'platform_admin' | 'finance' | 'operations' | 'provider' | 'agent' | 'customer';

export const ROLE_FAMILY_MAP: Record<string, RoleFamily> = {
    super_admin: 'platform_admin',
    admin: 'platform_admin',
    finance_admin: 'finance',
    finance_approver: 'finance',
    operations_admin: 'operations',
    support_admin: 'operations',
    risk_analyst: 'operations',
    compliance_admin: 'operations',
    reconciliation_admin: 'finance',
    catalog_admin: 'operations',
    pricing_admin: 'operations',
    refund_reviewer: 'finance',
    refund_approver: 'finance',
    payout_operator: 'finance',
    payout_approver: 'finance',
    auditor: 'operations',
    agent: 'agent',
    agent_supervisor: 'agent',
    customer: 'customer',
    service_provider: 'provider',
    provider_owner: 'provider',
    provider_manager: 'provider',
    provider_finance: 'provider',
    provider_ops: 'provider',
    provider_inventory_manager: 'provider',
};

export interface Role {
    id: string;
    slug: string;
    name: string;
    description: string;
    /** Whether this role can only be one-per-user active at a time */
    isExclusive: boolean;
    isActive: boolean;
    createdAt: DateTimeString;
}

export interface Permission {
    id: string;
    /** Dotted capability code, e.g. "booking.read.own" */
    code: string;
    name: string;
    description: string;
    /** Logical group for UI display, e.g. "Bookings", "Payouts" */
    group: string;
    createdAt: DateTimeString;
}

export interface RolePermission {
    roleId: string;
    permissionId: string;
    createdAt: DateTimeString;
}

export interface UserRole {
    id: string;
    userId: string;
    roleId: string;
    /** Provider/org scope for provider-level roles */
    providerId: string | null;
    isActive: boolean;
    grantedBy: string;
    grantedAt: DateTimeString;
    revokedAt: DateTimeString | null;
}

export interface OrgUnit {
    id: string;
    name: string;
    parentId: string | null;
    type: 'platform' | 'provider' | 'department';
    providerId: string | null;
    isActive: boolean;
    createdAt: DateTimeString;
}

/**
 * Authorization context produced by the auth middleware and consumed
 * by service-layer authorize() calls.
 */
export interface AuthorizationContext {
    userId: string;
    sessionId: string;
    /** All active role slugs for this user */
    roles: string[];
    /** Flat set of all permission codes derived from roles */
    permissions: Set<string>;
    /** Provider IDs the user has provider-scoped roles for */
    providerScopes: string[];
    /** Current session assurance level (0 = basic, 1 = step-up SMS, 2 = step-up TOTP) */
    assuranceLevel: number;
    /** Whether MFA is enrolled for this user */
    mfaEnrolled: boolean;
}
