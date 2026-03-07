import { z } from 'zod';

export const createBookingDraftSchema = z.object({
  listingId: z.string().min(1),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  serviceDateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guestCount: z.number().int().positive(),
  specialRequests: z.string().max(2000).optional(),
  travelers: z.array(z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    dateOfBirth: z.string().optional(),
    passportNumber: z.string().optional(),
    nationality: z.string().length(2).optional(),
    isPrimary: z.boolean(),
  })).min(1),
});

export const updateBookingDraftSchema = z.object({
  guestCount: z.number().int().positive().optional(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  specialRequests: z.string().max(2000).optional(),
  travelers: z.array(z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    dateOfBirth: z.string().optional(),
    passportNumber: z.string().optional(),
    nationality: z.string().length(2).optional(),
    isPrimary: z.boolean(),
  })).optional(),
});

export const confirmBookingSchema = z.object({
  idempotencyKey: z.string().min(1).max(255),
});

export const pricingQuoteSchema = z.object({
  listingId: z.string().min(1),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestCount: z.number().int().positive(),
  items: z.array(z.object({
    pricingRuleId: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
});

export const cancelBookingSchema = z.object({
  reason: z.string().min(1).max(500),
});
