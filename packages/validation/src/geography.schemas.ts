import { z } from 'zod';

export const listCountriesSchema = z.object({
  continent: z.enum(['africa', 'asia', 'europe', 'north_america', 'south_america', 'oceania', 'antarctica']).optional(),
  activeOnly: z.coerce.boolean().optional(),
});

export const createCountrySchema = z.object({
  code: z.string().length(2).toUpperCase(),
  code3: z.string().length(3).toUpperCase().optional(),
  numericCode: z.string().max(3).optional(),
  name: z.string().min(1).max(200),
  officialName: z.string().max(300).optional(),
  continent: z.enum(['africa', 'asia', 'europe', 'north_america', 'south_america', 'oceania', 'antarctica']).optional(),
  capitalCity: z.string().max(200).optional(),
  phoneCode: z.string().max(10).optional(),
  defaultCurrencyCode: z.string().length(3).toUpperCase().optional(),
  flagEmoji: z.string().max(10).optional(),
});

export const updateCountrySchema = createCountrySchema.partial();

export const createCurrencySchema = z.object({
  code: z.string().length(3).toUpperCase(),
  numericCode: z.string().max(3).optional(),
  name: z.string().min(1).max(200),
  symbol: z.string().min(1).max(10),
  symbolNative: z.string().max(10).optional(),
  decimalDigits: z.number().int().min(0).max(8).optional(),
  rounding: z.number().int().min(0).optional(),
});

export const listRegionsSchema = z.object({
  countryCode: z.string().length(2).toUpperCase(),
  parentId: z.string().optional(),
});

export const createRegionSchema = z.object({
  countryCode: z.string().length(2).toUpperCase(),
  name: z.string().min(1).max(200),
  code: z.string().max(20).optional(),
  parentId: z.string().optional(),
  level: z.number().int().min(1).optional(),
});

export const linkCountryCurrencySchema = z.object({
  countryCode: z.string().length(2).toUpperCase(),
  currencyCode: z.string().length(3).toUpperCase(),
  isPrimary: z.boolean().optional(),
});
