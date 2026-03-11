/**
 * Geography routes — /api/v1/geography
 * Public endpoints for countries, currencies, and regions.
 */
import { Hono } from 'hono';
import type { Env } from '../../bindings.js';
import type { SessionContext } from '@felix-travel/types';
import { createDbClient, GeographyRepository } from '@felix-travel/db';
import { success } from '../../lib/response.js';
import { newId } from '../../lib/id.js';
import { requireAuth } from '@felix-travel/auth';
import {
  listCountriesSchema,
  createCountrySchema,
  updateCountrySchema,
  createCurrencySchema,
  createRegionSchema,
  linkCountryCurrencySchema,
} from '@felix-travel/validation';
import { ValidationError } from '../../lib/errors.js';

type HonoEnv = {
  Bindings: Env;
  Variables: { session: SessionContext };
};

export const geographyRoutes = new Hono<HonoEnv>();

const getRepo = (env: Env) => new GeographyRepository(createDbClient(env.DB));

// ─── Public: List countries ───────────────────────────────────────────
geographyRoutes.get('/countries', async (c) => {
  const query = c.req.query();
  const parsed = listCountriesSchema.safeParse(query);
  const repo = getRepo(c.env);
  const opts: { activeOnly?: boolean; continent?: string } = {};
  if (parsed.success) {
    if (parsed.data.activeOnly !== undefined) opts.activeOnly = parsed.data.activeOnly;
    if (parsed.data.continent !== undefined) opts.continent = parsed.data.continent;
  } else {
    opts.activeOnly = true;
  }
  const data = await repo.listCountries(opts);
  return c.json(success(data));
});

// ─── Public: Get single country ───────────────────────────────────────
geographyRoutes.get('/countries/:code', async (c) => {
  const repo = getRepo(c.env);
  const country = await repo.getCountryByCode(c.req.param('code'));
  if (!country) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Country not found' } }, 404);

  const mappings = await repo.getCurrenciesForCountry(country.code);
  return c.json(success({ ...country, currencies: mappings }));
});

// ─── Public: List currencies ──────────────────────────────────────────
geographyRoutes.get('/currencies', async (c) => {
  const repo = getRepo(c.env);
  const data = await repo.listCurrencies({ activeOnly: true });
  return c.json(success(data));
});

// ─── Public: Get single currency ──────────────────────────────────────
geographyRoutes.get('/currencies/:code', async (c) => {
  const repo = getRepo(c.env);
  const currency = await repo.getCurrencyByCode(c.req.param('code'));
  if (!currency) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Currency not found' } }, 404);
  return c.json(success(currency));
});

// ─── Public: List regions for a country ───────────────────────────────
geographyRoutes.get('/countries/:code/regions', async (c) => {
  const parentId = c.req.query('parentId') ?? undefined;
  const repo = getRepo(c.env);
  const data = await repo.listRegions(c.req.param('code'), {
    parentId: parentId === undefined ? null : parentId,
  });
  return c.json(success(data));
});

// ─── Public: Get region descendants ───────────────────────────────────
geographyRoutes.get('/regions/:regionId/descendants', async (c) => {
  const repo = getRepo(c.env);
  const data = await repo.getDescendants(c.req.param('regionId'));
  return c.json(success(data));
});

// ─── Public: Get region ancestors ─────────────────────────────────────
geographyRoutes.get('/regions/:regionId/ancestors', async (c) => {
  const repo = getRepo(c.env);
  const data = await repo.getAncestors(c.req.param('regionId'));
  return c.json(success(data));
});

// ─── Admin: Create country ────────────────────────────────────────────
geographyRoutes.post('/countries', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = createCountrySchema.safeParse(body);
  if (!parsed.success) throw new ValidationError('Invalid country data', parsed.error.flatten().fieldErrors);

  const repo = getRepo(c.env);
  const existing = await repo.getCountryByCode(parsed.data.code);
  if (existing) return c.json({ success: false, error: { code: 'CONFLICT', message: 'Country code already exists' } }, 409);

  const { code3, numericCode, officialName, continent, capitalCity, phoneCode, defaultCurrencyCode, flagEmoji, ...rest } = parsed.data;
  const country = await repo.createCountry({
    id: newId(),
    ...rest,
    code3: code3 ?? null,
    numericCode: numericCode ?? null,
    officialName: officialName ?? null,
    continent: continent ?? null,
    capitalCity: capitalCity ?? null,
    phoneCode: phoneCode ?? null,
    defaultCurrencyCode: defaultCurrencyCode ?? null,
    flagEmoji: flagEmoji ?? null,
  });
  return c.json(success(country), 201);
});

// ─── Admin: Update country ────────────────────────────────────────────
geographyRoutes.patch('/countries/:code', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = updateCountrySchema.safeParse(body);
  if (!parsed.success) throw new ValidationError('Invalid country data', parsed.error.flatten().fieldErrors);

  const repo = getRepo(c.env);
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    fields[k] = v === undefined ? null : v;
  }
  const updated = await repo.updateCountry(c.req.param('code')!, fields);
  if (!updated) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Country not found' } }, 404);
  return c.json(success(updated));
});

// ─── Admin: Create currency ───────────────────────────────────────────
geographyRoutes.post('/currencies', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = createCurrencySchema.safeParse(body);
  if (!parsed.success) throw new ValidationError('Invalid currency data', parsed.error.flatten().fieldErrors);

  const repo = getRepo(c.env);
  const existing = await repo.getCurrencyByCode(parsed.data.code);
  if (existing) return c.json({ success: false, error: { code: 'CONFLICT', message: 'Currency code already exists' } }, 409);

  const { numericCode, symbolNative, decimalDigits, rounding, ...currencyRest } = parsed.data;
  const currency = await repo.createCurrency({
    id: newId(),
    ...currencyRest,
    numericCode: numericCode ?? null,
    symbolNative: symbolNative ?? null,
    decimalDigits: decimalDigits ?? 2,
    rounding: rounding ?? 0,
  });
  return c.json(success(currency), 201);
});

// ─── Admin: Link currency to country ──────────────────────────────────
geographyRoutes.post('/country-currencies', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = linkCountryCurrencySchema.safeParse(body);
  if (!parsed.success) throw new ValidationError('Invalid link data', parsed.error.flatten().fieldErrors);

  const repo = getRepo(c.env);
  const { isPrimary, ...linkRest } = parsed.data;
  const link = await repo.linkCountryCurrency({ id: newId(), ...linkRest, isPrimary: isPrimary ?? false });
  return c.json(success(link), 201);
});

// ─── Admin: Create region ─────────────────────────────────────────────
geographyRoutes.post('/regions', requireAuth, async (c) => {
  const body = await c.req.json();
  const parsed = createRegionSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError('Invalid region data', parsed.error.flatten().fieldErrors);

  const repo = getRepo(c.env);
  const { parentId, level, code: regionCode, ...regionRest } = parsed.data;
  const region = await repo.createRegion({
    id: newId(),
    ...regionRest,
    code: regionCode ?? null,
    parentId: parentId ?? null,
    level: level ?? (parentId ? 2 : 1),
  });
  return c.json(success(region), 201);
});
