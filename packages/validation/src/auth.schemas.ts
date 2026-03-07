import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const magicLinkRequestSchema = z.object({
  email: z.string().email(),
});

export const magicLinkVerifySchema = z.object({
  token: z.string().min(1),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const inviteAcceptSchema = z.object({
  token: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
});

export const inviteCreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(['agent', 'service_provider']),
  providerId: z.string().optional(),
});

export const otpVerifySchema = z.object({
  code: z.string().length(6),
  purpose: z.enum(['phone_verification', 'login', 'payment_confirmation']),
});
