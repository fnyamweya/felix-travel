/**
 * Hono middleware for JWT authentication and session context injection.
 *
 * The middleware:
 * 1. Extracts the Bearer token from the Authorization header
 * 2. Verifies the RS256 JWT signature and standard claims
 * 3. Injects the decoded SessionContext into the Hono context for downstream use
 * 4. Returns 401 if no token or invalid token is provided
 *
 * The session context is the single source of truth for "who is making this request"
 * throughout the request lifecycle. Services must not re-read auth headers directly.
 */
import type { Context, Next } from 'hono';
import { verifyJwt } from '../jwt.js';
import type { SessionContext } from '@felix-travel/types';

export type AuthEnv = {
  Variables: {
    session: SessionContext;
  };
  Bindings: {
    JWT_PUBLIC_KEY: string;
    JWT_ISSUER: string;
    JWT_AUDIENCE: string;
  };
};

/** Middleware that requires a valid JWT. Injects the session into context. */
export async function requireAuth(c: Context<AuthEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }
  const token = authHeader.slice(7);
  const payload = await verifyJwt(
    token,
    c.env.JWT_PUBLIC_KEY,
    c.env.JWT_ISSUER,
    c.env.JWT_AUDIENCE
  );
  if (!payload) {
    return c.json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } }, 401);
  }
  const session: SessionContext = {
    userId: payload.sub,
    sessionId: payload.sid,
    role: (payload.roles[0] ?? 'customer') as SessionContext['role'],
    roles: payload.roles,
    providerId: payload.pid,
    permissions: [],
    assuranceLevel: payload.sal ?? 0,
    mfaEnrolled: payload.mfa ?? false,
    trustedDeviceId: null,
  };
  c.set('session', session);
  await next();
}

/** Optional auth — sets session if token provided, does not reject if missing */
export async function optionalAuth(c: Context<AuthEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyJwt(
      token,
      c.env.JWT_PUBLIC_KEY,
      c.env.JWT_ISSUER,
      c.env.JWT_AUDIENCE
    );
    if (payload) {
      c.set('session', {
        userId: payload.sub,
        sessionId: payload.sid,
        role: (payload.roles[0] ?? 'customer') as SessionContext['role'],
        roles: payload.roles,
        providerId: payload.pid,
        permissions: [],
        assuranceLevel: payload.sal ?? 0,
        mfaEnrolled: payload.mfa ?? false,
        trustedDeviceId: null,
      });
    }
  }
  await next();
}
