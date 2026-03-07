/**
 * Identity types — first-class email and phone identities,
 * MFA factors, trusted devices, step-up challenges.
 */
import type { DateTimeString } from './common.js';

export type IdentityType = 'email' | 'phone';
export type VerificationPurpose = 'email_verify' | 'phone_verify' | 'login_otp' | 'step_up' | 'password_reset' | 'mfa_recovery';
export type MfaMethod = 'totp' | 'sms';
export type StepUpMethod = 'totp' | 'sms_otp';

export interface UserIdentity {
  id: string;
  userId: string;
  type: IdentityType;
  /** The normalized identifier (email lowercase, phone E.164) */
  identifier: string;
  isPrimary: boolean;
  verifiedAt: DateTimeString | null;
  createdAt: DateTimeString;
}

export interface EmailAddress {
  id: string;
  userId: string;
  email: string;
  isPrimary: boolean;
  verifiedAt: DateTimeString | null;
  createdAt: DateTimeString;
}

export interface PhoneNumber {
  id: string;
  userId: string;
  /** E.164 format, e.g. +254712345678 */
  phone: string;
  isPrimary: boolean;
  verifiedAt: DateTimeString | null;
  createdAt: DateTimeString;
}

export interface VerificationChallenge {
  id: string;
  userId: string;
  purpose: VerificationPurpose;
  /** Hashed OTP or token */
  secretHash: string;
  /** JSON context for what action this challenge gates (step-up) */
  actionContext: string | null;
  expiresAt: DateTimeString;
  usedAt: DateTimeString | null;
  createdAt: DateTimeString;
}

export interface MfaFactor {
  id: string;
  userId: string;
  method: MfaMethod;
  isEnabled: boolean;
  enrolledAt: DateTimeString;
  lastUsedAt: DateTimeString | null;
}

export interface TotpFactor {
  id: string;
  mfaFactorId: string;
  /** Encrypted TOTP secret — decrypted only during verification */
  encryptedSecret: string;
  /** Algorithm used, defaults to SHA1 per RFC 6238 */
  algorithm: string;
  digits: number;
  period: number;
}

export interface SmsFactor {
  id: string;
  mfaFactorId: string;
  /** E.164 phone number for OTP delivery */
  phoneNumber: string;
}

export interface RecoveryCode {
  id: string;
  userId: string;
  /** Hashed recovery code */
  codeHash: string;
  usedAt: DateTimeString | null;
  createdAt: DateTimeString;
}

export interface TrustedDevice {
  id: string;
  userId: string;
  /** SHA-256 hash of device fingerprint components */
  fingerprintHash: string;
  deviceName: string;
  lastSeenAt: DateTimeString;
  expiresAt: DateTimeString;
  createdAt: DateTimeString;
}

export interface StepUpChallenge {
  id: string;
  sessionId: string;
  userId: string;
  method: StepUpMethod;
  /** The action that triggered step-up (e.g. "payout.approve") */
  actionType: string;
  /** JSON envelope of the original action request */
  actionContext: string;
  secretHash: string;
  expiresAt: DateTimeString;
  completedAt: DateTimeString | null;
  createdAt: DateTimeString;
}

export interface SessionAssuranceEvent {
  id: string;
  sessionId: string;
  userId: string;
  /** What raised the assurance level (e.g. "totp_verified", "sms_verified") */
  event: string;
  assuranceLevel: number;
  createdAt: DateTimeString;
}
