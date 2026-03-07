import { z } from 'zod';

export const createListingSchema = z.object({
  categoryId: z.string().min(1),
  destinationId: z.string().min(1),
  type: z.enum(['tour', 'hotel', 'rental', 'transfer', 'car', 'package']),
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  shortDescription: z.string().min(1).max(500),
  description: z.string().min(1).max(20000),
  basePriceAmount: z.number().int().positive(),
  currencyCode: z.string().length(3),
  durationMinutes: z.number().int().positive().optional(),
  maxCapacity: z.number().int().positive().optional(),
  minGuests: z.number().int().positive().default(1),
  isInstantBooking: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

export const updateListingSchema = createListingSchema.partial();

export const createPricingRuleSchema = z.object({
  name: z.string().min(1).max(200),
  priceAmount: z.number().int().positive(),
  currencyCode: z.string().length(3),
  unitType: z.enum(['per_person', 'per_group', 'per_night', 'per_day', 'per_vehicle', 'flat']),
  minUnits: z.number().int().positive().default(1),
  maxUnits: z.number().int().positive().optional(),
});

export const createBlackoutDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(500).optional(),
});

export const updateInventorySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalCapacity: z.number().int().min(0),
  isAvailable: z.boolean().default(true),
});
