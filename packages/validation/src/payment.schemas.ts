import { z } from 'zod';

export const initiateCheckoutSchema = z.object({
  bookingId: z.string().min(1),
  idempotencyKey: z.string().min(1).max(255),
  MSISDN: z.string().optional(),
  paymentOptionCode: z.string().optional(),
  successRedirectUrl: z.string().url().optional(),
  failRedirectUrl: z.string().url().optional(),
});

export const initiateChargeSchema = z.object({
  paymentId: z.string().min(1),
  idempotencyKey: z.string().min(1).max(255),
  MSISDN: z.string().min(1),
  paymentOptionCode: z.string().min(1),
});

export const validateChargeSchema = z.object({
  paymentId: z.string().min(1),
  otp: z.string().min(4).max(8),
  idempotencyKey: z.string().min(1),
});

export const initiateRefundSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().int().positive(),
  reason: z.string().min(1).max(500),
  idempotencyKey: z.string().min(1).max(255),
  items: z.array(z.object({
    bookingItemId: z.string().min(1),
    amount: z.number().int().positive(),
  })).optional(),
});

export const approveRefundSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const rejectRefundSchema = z.object({
  reason: z.string().min(1).max(500),
});
