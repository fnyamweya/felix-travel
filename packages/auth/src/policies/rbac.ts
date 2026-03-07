/**
 * RBAC policy enforcement.
 *
 * Authorization is enforced at two layers:
 * 1. Route middleware — rejects unauthorized roles before reaching handlers
 * 2. Service layer — re-checks ownership and fine-grained permissions
 *
 * Both layers must independently enforce access. Defense in depth ensures
 * that a middleware bypass does not grant unauthorized data access.
 */
import type { UserRole } from '@felix-travel/types';
import type { SessionContext } from '@felix-travel/types';

/** Check if a role is allowed. Used in route middleware. */
export function requireRole(...allowedRoles: UserRole[]): (ctx: SessionContext) => void {
  return (session: SessionContext) => {
    if (!allowedRoles.includes(session.role)) {
      throw new AuthorizationError(
        `Role '${session.role}' is not authorized. Required: ${allowedRoles.join(' | ')}`
      );
    }
  };
}

/**
 * Enforce provider ownership.
 * Called in service layer before any provider-scoped data access.
 * Even if middleware checks role=service_provider, the service layer must
 * independently confirm the actor owns the specific provider being accessed.
 */
export function assertProviderOwnership(
  session: SessionContext,
  resourceProviderId: string
): void {
  if (session.role === 'admin') return; // admin bypasses ownership check
  if (session.providerId !== resourceProviderId) {
    throw new AuthorizationError(
      `Provider ${resourceProviderId} is not accessible by provider account ${session.providerId}`
    );
  }
}

/**
 * Enforce customer data ownership.
 * A customer can only access their own data. Agents can access their assigned customers.
 * Admins access all.
 */
export function assertCustomerOwnership(
  session: SessionContext,
  resourceCustomerId: string,
  agentCustomerIds?: string[]
): void {
  if (session.role === 'admin') return;
  if (session.role === 'customer' && session.userId === resourceCustomerId) return;
  if (session.role === 'agent' && agentCustomerIds?.includes(resourceCustomerId)) return;
  throw new AuthorizationError(
    `Customer ${resourceCustomerId} is not accessible by actor ${session.userId}`
  );
}

export class AuthorizationError extends Error {
  readonly statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class AuthenticationError extends Error {
  readonly statusCode = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/** Permission matrix for reference */
export const PERMISSIONS = {
  // Bookings
  'booking:read:own': ['customer', 'agent', 'service_provider', 'admin'] as UserRole[],
  'booking:read:all': ['admin'] as UserRole[],
  'booking:create': ['customer', 'agent', 'admin'] as UserRole[],
  'booking:cancel:own': ['customer', 'agent', 'admin'] as UserRole[],
  'booking:cancel:any': ['admin'] as UserRole[],
  // Payments
  'payment:initiate': ['customer', 'agent', 'admin'] as UserRole[],
  'payment:refund:request': ['customer', 'agent', 'admin'] as UserRole[],
  'payment:refund:approve': ['admin'] as UserRole[],
  // Payouts
  'payout:view:own': ['service_provider', 'admin'] as UserRole[],
  'payout:run': ['admin'] as UserRole[],
  'payout:approve': ['admin'] as UserRole[],
  // Providers
  'provider:manage:own': ['service_provider', 'admin'] as UserRole[],
  'provider:manage:any': ['admin'] as UserRole[],
  // Listings
  'listing:create': ['service_provider', 'admin'] as UserRole[],
  'listing:update:own': ['service_provider', 'admin'] as UserRole[],
  // Ledger
  'ledger:view': ['admin'] as UserRole[],
  'ledger:adjust': ['admin'] as UserRole[],
  // Admin
  'admin:access': ['admin'] as UserRole[],
  'audit:view': ['admin'] as UserRole[],
} as const;

export function hasPermission(session: SessionContext, permission: keyof typeof PERMISSIONS): boolean {
  return (PERMISSIONS[permission] as readonly UserRole[]).includes(session.role);
}

// ────────────────────────────────────────────────────────────────────
// New capability-based authorization (works with DB-driven permissions)
// ────────────────────────────────────────────────────────────────────

/**
 * Authorize a session against a capability code. Uses the permissions[]
 * array populated from the user's roles at session hydration time.
 *
 * Throws AuthorizationError if the session lacks the capability.
 * This is the preferred authorization function for all new code.
 */
export function authorize(session: SessionContext, capability: string): void {
  if (session.permissions.includes(capability)) return;

  // super_admin implicitly has all capabilities
  if (session.roles.includes('super_admin')) return;

  throw new AuthorizationError(
    `Missing capability "${capability}" for user ${session.userId}`
  );
}

/**
 * Check (without throwing) whether a session has a capability.
 */
export function hasCapability(session: SessionContext, capability: string): boolean {
  if (session.permissions.includes(capability)) return true;
  if (session.roles.includes('super_admin')) return true;
  return false;
}

/**
 * Require a minimum session assurance level. Used before sensitive actions.
 * Throws AuthorizationError if the session's assurance level is insufficient.
 */
export function requireAssurance(session: SessionContext, level: number): void {
  if (session.assuranceLevel >= level) return;
  throw new AuthorizationError(
    `Assurance level ${level} required, current level is ${session.assuranceLevel}`
  );
}
