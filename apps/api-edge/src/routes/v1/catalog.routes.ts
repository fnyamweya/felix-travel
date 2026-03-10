/**
 * Catalog routes — /api/v1/catalog
 *
 * GET  /destinations          List active destinations
 * GET  /listing-categories    List active listing categories
 * GET  /listings              Search / list active listings
 * GET  /listings/:id          Get single listing by ID or slug
 */
import { Hono } from 'hono';
import type { Env } from '../../bindings.js';
import type { SessionContext } from '@felix-travel/types';
import { CatalogService } from '../../services/catalog.service.js';
import { success } from '../../lib/response.js';

type HonoEnv = {
    Bindings: Env;
    Variables: { session: SessionContext };
};

export const catalogRoutes = new Hono<HonoEnv>();

function getCatalogService(c: { env: Env }) {
    return new CatalogService(c.env.DB);
}

// Public — no auth required

catalogRoutes.get('/destinations', async (c) => {
    const svc = getCatalogService(c);
    const destinations = await svc.getDestinations();
    return c.json(success(destinations));
});

catalogRoutes.get('/listing-categories', async (c) => {
    const svc = getCatalogService(c);
    const categories = await svc.getListingCategories();
    return c.json(success(categories));
});

catalogRoutes.get('/listings', async (c) => {
    const svc = getCatalogService(c);
    const params: Parameters<CatalogService['searchListings']>[0] = {};
    const q = c.req.query('q');
    if (q) params.q = q;
    const destinationId = c.req.query('destinationId');
    if (destinationId) params.destinationId = destinationId;
    const type = c.req.query('type');
    if (type) params.type = type;
    const page = c.req.query('page');
    if (page) params.page = Number(page);
    const pageSize = c.req.query('pageSize');
    if (pageSize) params.pageSize = Number(pageSize);

    const result = await svc.searchListings(params);
    return c.json(success(result));
});

catalogRoutes.get('/listings/:id', async (c) => {
    const svc = getCatalogService(c);
    const id = c.req.param('id');
    const listing = await svc.getListing(id);
    return c.json(success(listing));
});
