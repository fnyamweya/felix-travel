import { z } from 'zod';

// ─── Identity schemas ────────────────────────────────────────────

export const addEmailSchema = z.object({
    email: z.string().email(),
});

export const addPhoneSchema = z.object({
    phone: z.string().min(7).max(20),
    countryCode: z.string().length(2).optional(),
});

export const sendVerificationSchema = z.object({
    identityId: z.string().min(1),
});

export const verifyIdentityChallengeSchema = z.object({
    identityId: z.string().min(1),
    code: z.string().length(6),
});

// ─── MFA schemas ─────────────────────────────────────────────────

export const totpCodeSchema = z.object({
    code: z.string().length(6),
});

export const smsEnrollSchema = z.object({
    phoneNumber: z.string().min(7).max(20),
});

export const recoveryCodeSchema = z.object({
    code: z.string().min(8).max(12),
});

// ─── Step-up schemas ─────────────────────────────────────────────

export const stepUpChallengeSchema = z.object({
    method: z.enum(['sms_otp', 'totp']),
    actionContext: z.string().max(500).optional(),
});

export const stepUpVerifySchema = z.object({
    challengeId: z.string().min(1),
    code: z.string().min(4).max(8),
});

// ─── Trusted device schemas ──────────────────────────────────────

export const trustDeviceSchema = z.object({
    fingerprintHash: z.string().min(16).max(128),
    label: z.string().max(200).optional(),
    ipAddress: z.string().optional(),
    userAgent: z.string().max(500).optional(),
});
