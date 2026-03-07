import type { DateTimeString } from './common.js';

/**
 * Legacy role type kept for backward compatibility with existing code.
 * New code should use RoleSlug from permissions.ts.
 */
export type UserRole = 'customer' | 'agent' | 'admin' | 'service_provider';

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  role: UserRole;
  /** Provider ID for service_provider role — null for all other roles */
  providerId: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  mfaEnrolled: boolean;
  createdAt: DateTimeString;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface SessionContext {
  userId: string;
  sessionId: string;
  role: UserRole;
  /** All active role slugs (expanded model) */
  roles: string[];
  providerId: string | null;
  permissions: string[];
  /** 0 = basic auth, 1 = SMS step-up, 2 = TOTP step-up */
  assuranceLevel: number;
  mfaEnrolled: boolean;
  /** Device fingerprint hash if a trusted device was matched */
  trustedDeviceId: string | null;
}

export interface JwtPayload {
  sub: string; // userId
  sid: string; // sessionId
  role: UserRole;
  /** All active roles for the user */
  roles: string[];
  pid: string | null; // providerId
  /** Session assurance level */
  sal: number;
  /** Whether MFA is enrolled */
  mfa: boolean;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface MagicLinkPayload {
  email: string;
  token: string;
  expiresAt: DateTimeString;
}

export interface OtpPayload {
  userId: string;
  code: string;
  purpose: 'phone_verification' | 'login' | 'payment_confirmation';
  expiresAt: DateTimeString;
}

export interface InvitePayload {
  email: string;
  role: UserRole;
  providerId?: string;
  invitedBy: string;
  token?: string;
  expiresAt: DateTimeString;
}
