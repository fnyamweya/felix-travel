import { z } from 'zod';

export const createProviderSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  countryCode: z.string().length(2),
  currencyCode: z.string().length(3),
  websiteUrl: z.string().url().optional(),
});

export const updateProviderSchema = createProviderSchema.partial();

export const createCallbackSubscriptionSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum([
    'booking.created', 'booking.updated', 'booking.confirmed', 'booking.cancelled',
    'payment.succeeded', 'payment.failed',
    'refund.initiated', 'refund.succeeded',
    'payout.pending', 'payout.processing', 'payout.completed', 'payout.failed',
  ])).min(1),
  maxRetries: z.number().int().min(1).max(10).default(5),
  timeoutMs: z.number().int().min(1000).max(30000).default(10000),
});

export const updateCallbackSubscriptionSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum([
    'booking.created', 'booking.updated', 'booking.confirmed', 'booking.cancelled',
    'payment.succeeded', 'payment.failed',
    'refund.initiated', 'refund.succeeded',
    'payout.pending', 'payout.processing', 'payout.completed', 'payout.failed',
  ])).min(1).optional(),
  isActive: z.boolean().optional(),
  maxRetries: z.number().int().min(1).max(10).optional(),
  timeoutMs: z.number().int().min(1000).max(30000).optional(),
});
