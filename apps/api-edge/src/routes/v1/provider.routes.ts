import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../bindings.js';
import type { SessionContext } from '@felix-travel/types';
import { requireAuth } from '@felix-travel/auth';
import { assertProviderOwnership } from '@felix-travel/auth';
import { createDbClient, ProvidersRepository, CatalogRepository } from '@felix-travel/db';
import { CatalogService } from '../../services/catalog.service.js';
import { PayoutService } from '../../services/payout.service.js';
import { BookingService } from '../../services/booking.service.js';
import { success } from '../../lib/response.js';
import { AppError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { newId } from '../../lib/id.js';
import {
    updateProviderSchema,
    createCallbackSubscriptionSchema,
    updateCallbackSubscriptionSchema,
    createPayoutAccountSchema,
    createListingSchema,
    updateListingSchema,
    createPricingRuleSchema,
    createBlackoutDateSchema,
    updateInventorySchema,
    paginationSchema,
} from '@felix-travel/validation';

type HonoEnv = {
    Bindings: Env;
    Variables: { session: SessionContext };
};

const providerSettingsSchema = z.object({
    settlementDelayDays: z.number().int().min(0).max(60).optional(),
    autoApprovePayout: z.boolean().optional(),
    commissionBps: z.number().int().min(0).max(10000).optional(),
    notifyOnBooking: z.boolean().optional(),
    notifyOnPayout: z.boolean().optional(),
});

const updateProviderListingSchema = updateListingSchema.extend({
    status: z.enum(['draft', 'pending_review', 'active', 'inactive', 'archived']).optional(),
});

export const providerRoutes = new Hono<HonoEnv>();

providerRoutes.use('*', requireAuth);

function ensureProviderScope(session: SessionContext, providerId: string) {
    if (session.role === 'admin') return;
    if (session.role !== 'service_provider') {
        throw new AppError('FORBIDDEN', 'Forbidden', 403);
    }
    assertProviderOwnership(session, providerId);
}

function getProvidersRepo(c: { env: Env }) {
    return new ProvidersRepository(createDbClient(c.env.DB));
}

providerRoutes.get('/:providerId', async (c) => {
    const providerId = c.req.param('providerId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const repo = getProvidersRepo(c);
    const provider = await repo.findById(providerId);
    if (!provider) throw new NotFoundError('Provider', providerId);

    return c.json(success(provider));
});

providerRoutes.get('/:providerId/settings', async (c) => {
    const providerId = c.req.param('providerId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const repo = getProvidersRepo(c);
    const settings = await repo.getSettings(providerId);

    return c.json(success(settings));
});

providerRoutes.patch('/:providerId/settings', async (c) => {
    const providerId = c.req.param('providerId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const body = await c.req.json();
    const parsed = providerSettingsSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid provider settings', { issues: parsed.error.flatten().fieldErrors });
    }

    const repo = getProvidersRepo(c);
    await repo.upsertSettings({
        providerId,
        ...(parsed.data.settlementDelayDays !== undefined && { settlementDelayDays: parsed.data.settlementDelayDays }),
        ...(parsed.data.autoApprovePayout !== undefined && { autoApprovePayout: parsed.data.autoApprovePayout }),
        ...(parsed.data.commissionBps !== undefined && { commissionBps: parsed.data.commissionBps }),
        ...(parsed.data.notifyOnBooking !== undefined && { notifyOnBooking: parsed.data.notifyOnBooking }),
        ...(parsed.data.notifyOnPayout !== undefined && { notifyOnPayout: parsed.data.notifyOnPayout }),
    });

    const settings = await repo.getSettings(providerId);
    return c.json(success(settings));
});

providerRoutes.patch('/:providerId', async (c) => {
    const providerId = c.req.param('providerId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const body = await c.req.json();
    const parsed = updateProviderSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid provider update', { issues: parsed.error.flatten().fieldErrors });
    }

    const repo = getProvidersRepo(c);
    const updated = await repo.update(providerId, {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.slug !== undefined && { slug: parsed.data.slug }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.email !== undefined && { email: parsed.data.email }),
        ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
        ...(parsed.data.countryCode !== undefined && { countryCode: parsed.data.countryCode }),
        ...(parsed.data.currencyCode !== undefined && { currencyCode: parsed.data.currencyCode }),
        ...(parsed.data.websiteUrl !== undefined && { websiteUrl: parsed.data.websiteUrl }),
    });
    if (!updated) throw new NotFoundError('Provider', providerId);

    return c.json(success(updated));
});

providerRoutes.get('/:providerId/payout-accounts', async (c) => {
    const providerId = c.req.param('providerId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const repo = getProvidersRepo(c);
    const accounts = await repo.findPayoutAccounts(providerId);
    return c.json(success(accounts));
});

providerRoutes.post('/:providerId/payout-accounts', async (c) => {
    const providerId = c.req.param('providerId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const body = await c.req.json();
    const parsed = createPayoutAccountSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid payout account', { issues: parsed.error.flatten().fieldErrors });
    }

    const repo = getProvidersRepo(c);
    if (parsed.data.isDefault) {
        const existing = await repo.findPayoutAccounts(providerId);
        await Promise.all(existing.map((account) => repo.updatePayoutAccount(account.id, { isDefault: false })));
    }

    const account = await repo.createPayoutAccount({
        id: newId(),
        providerId,
        accountType: parsed.data.accountType,
        accountNumber: parsed.data.accountNumber,
        accountName: parsed.data.accountName,
        networkCode: parsed.data.networkCode,
        countryCode: parsed.data.countryCode,
        currencyCode: parsed.data.currencyCode,
        isDefault: parsed.data.isDefault ?? false,
        isVerified: false,
        validationSnapshot: null,
    });

    return c.json(success(account), 201);
});

providerRoutes.get('/:providerId/webhook-subscriptions', async (c) => {
    const providerId = c.req.param('providerId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const repo = getProvidersRepo(c);
    const subscriptions = await repo.findCallbackSubscriptions(providerId);
    const data = subscriptions.map((subscription) => ({
        ...subscription,
        events: JSON.parse(subscription.events),
    }));
    return c.json(success(data));
});

providerRoutes.post('/:providerId/webhook-subscriptions', async (c) => {
    const providerId = c.req.param('providerId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const body = await c.req.json();
    const parsed = createCallbackSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid callback subscription', { issues: parsed.error.flatten().fieldErrors });
    }

    const repo = getProvidersRepo(c);
    const secret = crypto.randomUUID().replace(/-/g, '');
    const subscription = await repo.createCallbackSubscription({
        id: newId(),
        providerId,
        url: parsed.data.url,
        events: JSON.stringify(parsed.data.events),
        isActive: true,
        secretHash: secret,
        secretHint: secret.slice(-4),
        maxRetries: parsed.data.maxRetries ?? 5,
        timeoutMs: parsed.data.timeoutMs ?? 10000,
    });

    return c.json(success({
        ...subscription,
        events: parsed.data.events,
    }), 201);
});

providerRoutes.patch('/:providerId/webhook-subscriptions/:subId', async (c) => {
    const providerId = c.req.param('providerId');
    const subId = c.req.param('subId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const body = await c.req.json();
    const parsed = updateCallbackSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid callback subscription update', { issues: parsed.error.flatten().fieldErrors });
    }

    const repo = getProvidersRepo(c);
    const existing = await repo.findCallbackSubscriptionById(subId);
    if (!existing || existing.providerId !== providerId) throw new NotFoundError('Callback subscription', subId);

    const updated = await repo.updateCallbackSubscription(subId, {
        ...(parsed.data.url !== undefined && { url: parsed.data.url }),
        ...(parsed.data.events !== undefined && { events: JSON.stringify(parsed.data.events) }),
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        ...(parsed.data.maxRetries !== undefined && { maxRetries: parsed.data.maxRetries }),
        ...(parsed.data.timeoutMs !== undefined && { timeoutMs: parsed.data.timeoutMs }),
    });

    return c.json(success(updated ? {
        ...updated,
        events: JSON.parse(updated.events),
    } : null));
});

providerRoutes.post('/:providerId/webhook-subscriptions/:subId/test', async (c) => {
    const providerId = c.req.param('providerId');
    const subId = c.req.param('subId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const repo = getProvidersRepo(c);
    const existing = await repo.findCallbackSubscriptionById(subId);
    if (!existing || existing.providerId !== providerId) throw new NotFoundError('Callback subscription', subId);

    return c.json(success({ queued: true }));
});

providerRoutes.get('/:providerId/bookings', async (c) => {
    const providerId = c.req.param('providerId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const parsed = paginationSchema.safeParse(c.req.query());
    const page = parsed.success ? parsed.data.page : 1;
    const pageSize = parsed.success ? parsed.data.pageSize : 50;

    const service = new BookingService(c.env.DB, c.env);
    const bookings = await service.listByProvider(providerId, session, page, pageSize);
    return c.json(success({ bookings, meta: { page, pageSize, total: bookings.length } }));
});

providerRoutes.get('/:providerId/payouts', async (c) => {
    const providerId = c.req.param('providerId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const parsed = paginationSchema.safeParse(c.req.query());
    const page = parsed.success ? parsed.data.page : 1;
    const pageSize = parsed.success ? parsed.data.pageSize : 50;

    const service = new PayoutService(createDbClient(c.env.DB), c.env);
    const payouts = await service.list({
        actor: session,
        providerId,
        limit: pageSize,
        offset: (page - 1) * pageSize,
    });

    return c.json(success({ payouts, meta: { page, pageSize, total: payouts.length } }));
});

providerRoutes.get('/:providerId/listings', async (c) => {
    const providerId = c.req.param('providerId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const service = new CatalogService(c.env.DB);
    const listings = await service.getProviderListings(providerId);
    return c.json(success(listings));
});

providerRoutes.post('/:providerId/listings', async (c) => {
    const providerId = c.req.param('providerId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const body = await c.req.json();
    const parsed = createListingSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid listing input', { issues: parsed.error.flatten().fieldErrors });
    }

    const service = new CatalogService(c.env.DB);
    const listing = await service.createProviderListing(providerId, {
        categoryId: parsed.data.categoryId,
        destinationId: parsed.data.destinationId,
        type: parsed.data.type,
        title: parsed.data.title,
        slug: parsed.data.slug,
        shortDescription: parsed.data.shortDescription,
        description: parsed.data.description,
        basePriceAmount: parsed.data.basePriceAmount,
        currencyCode: parsed.data.currencyCode,
        ...(parsed.data.durationMinutes !== undefined && { durationMinutes: parsed.data.durationMinutes }),
        ...(parsed.data.maxCapacity !== undefined && { maxCapacity: parsed.data.maxCapacity }),
        ...(parsed.data.minGuests !== undefined && { minGuests: parsed.data.minGuests }),
        ...(parsed.data.isInstantBooking !== undefined && { isInstantBooking: parsed.data.isInstantBooking }),
        ...(parsed.data.tags !== undefined && { tags: parsed.data.tags }),
    });
    return c.json(success(listing), 201);
});

providerRoutes.patch('/:providerId/listings/:listingId', async (c) => {
    const providerId = c.req.param('providerId');
    const listingId = c.req.param('listingId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const body = await c.req.json();
    const parsed = updateProviderListingSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid listing update', { issues: parsed.error.flatten().fieldErrors });
    }

    const service = new CatalogService(c.env.DB);
    const listing = await service.updateProviderListing(providerId, listingId, {
        ...(parsed.data.categoryId !== undefined && { categoryId: parsed.data.categoryId }),
        ...(parsed.data.destinationId !== undefined && { destinationId: parsed.data.destinationId }),
        ...(parsed.data.type !== undefined && { type: parsed.data.type }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.slug !== undefined && { slug: parsed.data.slug }),
        ...(parsed.data.shortDescription !== undefined && { shortDescription: parsed.data.shortDescription }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.basePriceAmount !== undefined && { basePriceAmount: parsed.data.basePriceAmount }),
        ...(parsed.data.currencyCode !== undefined && { currencyCode: parsed.data.currencyCode }),
        ...(parsed.data.durationMinutes !== undefined && { durationMinutes: parsed.data.durationMinutes }),
        ...(parsed.data.maxCapacity !== undefined && { maxCapacity: parsed.data.maxCapacity }),
        ...(parsed.data.minGuests !== undefined && { minGuests: parsed.data.minGuests }),
        ...(parsed.data.isInstantBooking !== undefined && { isInstantBooking: parsed.data.isInstantBooking }),
        ...(parsed.data.tags !== undefined && { tags: parsed.data.tags }),
    });
    return c.json(success(listing));
});

providerRoutes.get('/:providerId/listings/:listingId/management', async (c) => {
    const providerId = c.req.param('providerId');
    const listingId = c.req.param('listingId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const service = new CatalogService(c.env.DB);
    const listing = await service.getListing(listingId);
    if (listing.providerId !== providerId) throw new NotFoundError('Listing', listingId);

    const db = createDbClient(c.env.DB);
    const repo = new CatalogRepository(db);
    const [pricingRules, blackouts, inventory] = await Promise.all([
        repo.findPricingRules(listingId),
        repo.findBlackoutDates(listingId),
        repo.findAvailability(listingId),
    ]);

    return c.json(success({ listing, pricingRules, blackouts, inventory }));
});

providerRoutes.post('/:providerId/listings/:listingId/pricing-rules', async (c) => {
    const providerId = c.req.param('providerId');
    const listingId = c.req.param('listingId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const body = await c.req.json();
    const parsed = createPricingRuleSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid pricing rule', { issues: parsed.error.flatten().fieldErrors });
    }

    const service = new CatalogService(c.env.DB);
    const rule = await service.createPricingRuleForListing(providerId, listingId, {
        name: parsed.data.name,
        priceAmount: parsed.data.priceAmount,
        currencyCode: parsed.data.currencyCode,
        unitType: parsed.data.unitType,
        ...(parsed.data.minUnits !== undefined && { minUnits: parsed.data.minUnits }),
        ...(parsed.data.maxUnits !== undefined && { maxUnits: parsed.data.maxUnits }),
    });
    return c.json(success(rule), 201);
});

providerRoutes.post('/:providerId/listings/:listingId/blackout-dates', async (c) => {
    const providerId = c.req.param('providerId');
    const listingId = c.req.param('listingId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const body = await c.req.json();
    const parsed = createBlackoutDateSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid blackout date', { issues: parsed.error.flatten().fieldErrors });
    }

    const service = new CatalogService(c.env.DB);
    const blackout = await service.createBlackoutDateForListing(providerId, listingId, {
        date: parsed.data.date,
        ...(parsed.data.reason !== undefined && { reason: parsed.data.reason }),
    });
    return c.json(success(blackout), 201);
});

providerRoutes.post('/:providerId/listings/:listingId/inventory', async (c) => {
    const providerId = c.req.param('providerId');
    const listingId = c.req.param('listingId');
    const session = c.get('session');
    ensureProviderScope(session, providerId);

    const body = await c.req.json();
    const parsed = updateInventorySchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid inventory input', { issues: parsed.error.flatten().fieldErrors });
    }

    const service = new CatalogService(c.env.DB);
    const inventory = await service.updateListingInventory(providerId, listingId, parsed.data);
    return c.json(success(inventory));
});
