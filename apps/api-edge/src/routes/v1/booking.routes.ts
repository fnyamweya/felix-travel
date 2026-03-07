/**
 * Booking routes — /api/v1/bookings
 *
 * POST   /                  Create a booking draft
 * GET    /                  List bookings (customer: own, provider: own, admin: all)
 * GET    /:id               Get booking by ID
 * GET    /ref/:reference    Get booking by reference
 * POST   /:id/confirm       Confirm a draft booking → pending_payment
 * POST   /:id/cancel        Cancel a booking
 * GET    /provider/:providerId  List bookings for a provider
 */
import { Hono } from 'hono';
import type { Env } from '../../bindings.js';
import type { SessionContext } from '@felix-travel/types';
import { requireAuth, idempotency } from '@felix-travel/auth';
import { hydratePermissions } from '@felix-travel/auth';
import { createDbClient } from '@felix-travel/db';
import { BookingService } from '../../services/booking.service.js';
import { success } from '../../lib/response.js';
import { ValidationError } from '../../lib/errors.js';
import { createBookingDraftSchema, cancelBookingSchema, paginationSchema } from '@felix-travel/validation';

type HonoEnv = {
    Bindings: Env;
    Variables: { session: SessionContext };
};

export const bookingRoutes = new Hono<HonoEnv>();

const getDb = (env: unknown) => createDbClient((env as Env).DB);

bookingRoutes.use('*', requireAuth);
bookingRoutes.use('*', hydratePermissions(getDb));

function getBookingService(c: { env: Env }) {
    return new BookingService(c.env.DB, c.env);
}

bookingRoutes.post('/', async (c) => {
    const session = c.get('session');
    const body = await c.req.json();
    const parsed = createBookingDraftSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid input', { issues: parsed.error.flatten().fieldErrors });
    }
    const svc = getBookingService(c);
    const { specialRequests, serviceDateEnd, travelers: rawTravelers, ...baseData } = parsed.data;
    const booking = await svc.createDraft({
        ...baseData,
        travelers: rawTravelers.map((t) => {
            const { dateOfBirth, passportNumber, nationality, ...rest } = t;
            return {
                ...rest,
                ...(dateOfBirth !== undefined && { dateOfBirth }),
                ...(passportNumber !== undefined && { passportNumber }),
                ...(nationality !== undefined && { nationality }),
            };
        }),
        ...(specialRequests !== undefined && { specialRequests }),
        ...(serviceDateEnd !== undefined && { serviceDateEnd }),
    }, session);
    return c.json(success(booking), 201);
});

bookingRoutes.get('/', async (c) => {
    const session = c.get('session');
    const query = paginationSchema.safeParse(c.req.query());
    const page = query.success ? query.data.page : 1;
    const pageSize = query.success ? query.data.pageSize : 20;
    const svc = getBookingService(c);
    const bookings = await svc.listMyBookings(session, page, pageSize);
    return c.json(success(bookings));
});

bookingRoutes.get('/:id', async (c) => {
    const session = c.get('session');
    const id = c.req.param('id');
    const svc = getBookingService(c);
    const booking = await svc.getById(id, session);
    return c.json(success(booking));
});

bookingRoutes.get('/ref/:reference', async (c) => {
    const session = c.get('session');
    const reference = c.req.param('reference');
    const svc = getBookingService(c);
    const booking = await svc.getByReference(reference, session);
    return c.json(success(booking));
});

bookingRoutes.post('/:id/confirm', idempotency(), async (c) => {
    const session = c.get('session');
    const id = c.req.param('id')!;
    const svc = getBookingService(c);
    const booking = await svc.confirm(id, session);
    return c.json(success(booking));
});

bookingRoutes.post('/:id/cancel', async (c) => {
    const session = c.get('session');
    const body = await c.req.json();
    const parsed = cancelBookingSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid input', { issues: parsed.error.flatten().fieldErrors });
    }
    const id = c.req.param('id');
    const svc = getBookingService(c);
    const booking = await svc.cancel(id, parsed.data.reason, session);
    return c.json(success(booking));
});

bookingRoutes.get('/provider/:providerId', async (c) => {
    const session = c.get('session');
    const providerId = c.req.param('providerId');
    const query = paginationSchema.safeParse(c.req.query());
    const page = query.success ? query.data.page : 1;
    const pageSize = query.success ? query.data.pageSize : 50;
    const svc = getBookingService(c);
    const bookings = await svc.listByProvider(providerId, session, page, pageSize);
    return c.json(success(bookings));
});
