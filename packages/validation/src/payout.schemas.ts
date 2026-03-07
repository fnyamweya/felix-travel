import { z } from 'zod';

export const createPayoutAccountSchema = z.object({
  accountType: z.enum(['mobile_money', 'bank_account', 'remittance']),
  accountNumber: z.string().min(1).max(50),
  accountName: z.string().min(1).max(200),
  networkCode: z.string().min(1).max(50),
  countryCode: z.string().length(2),
  currencyCode: z.string().length(3),
  isDefault: z.boolean().default(false),
});

export const validatePayoutAccountSchema = z.object({
  payoutAccountId: z.string().min(1),
});

export const runPayoutSchema = z.object({
  providerId: z.string().min(1),
  payoutAccountId: z.string().min(1),
  bookingIds: z.array(z.string().min(1)).min(1),
  idempotencyKey: z.string().min(1).max(255),
});

export const approveBatchSchema = z.object({
  notes: z.string().max(500).optional(),
});
