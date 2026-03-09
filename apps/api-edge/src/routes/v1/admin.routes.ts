/**
 * Admin routes — /api/v1/admin
 *
 * All endpoints require authentication and capability-based authorization.
 *
 * Users & Roles:
 *   GET    /users                   List users
 *   GET    /users/:userId           Get user by ID
 *   POST   /users/:userId/roles     Assign a role to a user
 *   DELETE /users/:userId/roles/:roleSlug  Remove a role from a user
 *   POST   /users/:userId/disable   Disable a user account
 *   POST   /users/:userId/enable    Enable a user account
 *
 * Invites:
 *   POST   /invites                 Create an invite
 *
 * Ledger:
 *   GET    /ledger/balance/:accountCode  Get account balance
 *   GET    /ledger/entries/:accountCode  Get ledger entries
 *   POST   /ledger/adjust           Manual ledger adjustment
 *
 * Policies:
 *   POST   /policies/evaluate       Evaluate a policy (dry run)
 *
 * Risk:
 *   GET    /risk/events             List recent risk events
 */
import { Hono } from 'hono';
import type { Env } from '../../bindings.js';
import type { SessionContext } from '@felix-travel/types';
import { requireAuth, authorize, idempotency } from '@felix-travel/auth';
import { hydratePermissions } from '@felix-travel/auth';
import { createDbClient } from '@felix-travel/db';
import { AdminService } from '../../services/admin.service.js';
import { AuthService } from '../../services/auth.service.js';
import { LedgerService } from '../../services/ledger.service.js';
import { success } from '../../lib/response.js';
import { ValidationError } from '../../lib/errors.js';
import { paginationSchema, inviteCreateSchema, manualLedgerAdjustmentSchema } from '@felix-travel/validation';

type HonoEnv = {
    Bindings: Env;
    Variables: { session: SessionContext };
};

export const adminRoutes = new Hono<HonoEnv>();

const getDb = (env: unknown) => createDbClient((env as Env).DB);

adminRoutes.use('*', requireAuth);
adminRoutes.use('*', hydratePermissions(getDb));

function getAdminService(c: { env: Env }) {
    return new AdminService(createDbClient(c.env.DB));
}

function parsePagination(query: Record<string, string>, defaultPageSize = 20) {
    const parsed = paginationSchema.safeParse(query);
    return {
        page: parsed.success ? parsed.data.page : 1,
        pageSize: parsed.success ? parsed.data.pageSize : defaultPageSize,
    };
}

// ─── Users ───────────────────────────────────────────────────────

adminRoutes.get('/users', async (c) => {
    const session = c.get('session');
    authorize(session, 'admin:access');
    const { page, pageSize } = parsePagination(c.req.query());
    const svc = getAdminService(c);
    const rows = await svc.listUsers(page, pageSize);
    return c.json(success(rows));
});

adminRoutes.get('/users/:userId', async (c) => {
    const session = c.get('session');
    authorize(session, 'admin:access');
    const svc = getAdminService(c);
    const user = await svc.getUserById(c.req.param('userId'));
    if (!user) return c.json(success(null), 404);
    return c.json(success(user));
});

adminRoutes.post('/users/:userId/roles', async (c) => {
    const session = c.get('session');
    authorize(session, 'admin:access');
    const userId = c.req.param('userId');
    const { roleSlug, providerId } = await c.req.json<{ roleSlug: string; providerId?: string }>();
    if (!roleSlug) throw new ValidationError('roleSlug is required');
    const svc = getAdminService(c);
    const result = await svc.assignRole(userId, roleSlug, providerId, session, c.env.POLICY_CACHE_KV);
    return c.json(success(result), 201);
});

adminRoutes.delete('/users/:userId/roles/:roleSlug', async (c) => {
    const session = c.get('session');
    authorize(session, 'admin:access');
    const userId = c.req.param('userId');
    const roleSlug = c.req.param('roleSlug');
    const svc = getAdminService(c);
    const result = await svc.removeRole(userId, roleSlug, session, c.env.POLICY_CACHE_KV);
    return c.json(success(result));
});

adminRoutes.post('/users/:userId/disable', async (c) => {
    const session = c.get('session');
    authorize(session, 'admin:access');
    const svc = getAdminService(c);
    const result = await svc.disableUser(c.req.param('userId'), session);
    return c.json(success(result));
});

adminRoutes.post('/users/:userId/enable', async (c) => {
    const session = c.get('session');
    authorize(session, 'admin:access');
    const svc = getAdminService(c);
    const result = await svc.enableUser(c.req.param('userId'), session);
    return c.json(success(result));
});

// ─── Invites ─────────────────────────────────────────────────────

adminRoutes.post('/invites', async (c) => {
    const session = c.get('session');
    authorize(session, 'admin:access');
    const body = await c.req.json();
    const parsed = inviteCreateSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid input', { issues: parsed.error.flatten().fieldErrors });
    }
    const svc = new AuthService(c.env.DB, c.env);
    const result = await svc.createInvite({
        email: parsed.data.email,
        role: parsed.data.role,
        invitedById: session.userId,
        ...(parsed.data.providerId !== undefined && { providerId: parsed.data.providerId }),
    });
    return c.json(success(result), 201);
});

// ─── Ledger ──────────────────────────────────────────────────────

adminRoutes.get('/ledger/balance/:accountCode', async (c) => {
    const session = c.get('session');
    authorize(session, 'ledger:view');
    const accountCode = c.req.param('accountCode');
    const currency = c.req.query('currency') ?? 'KES';
    const svc = new LedgerService(createDbClient(c.env.DB));
    const balance = await svc.getAccountBalance(accountCode, currency);
    return c.json(success(balance));
});

adminRoutes.get('/ledger/entries/:accountCode', async (c) => {
    const session = c.get('session');
    authorize(session, 'ledger:view');
    const accountCode = c.req.param('accountCode');
    const from = c.req.query('from');
    const to = c.req.query('to');
    const svc = new LedgerService(createDbClient(c.env.DB));
    const entries = await svc.getAccountEntries(accountCode, {
        limit: 100,
        ...(from !== undefined && { from }),
        ...(to !== undefined && { to }),
    });
    return c.json(success(entries));
});

adminRoutes.post(
    '/ledger/adjust',
    idempotency(),
    async (c) => {
        const session = c.get('session');
        authorize(session, 'ledger:adjust');
        const body = await c.req.json();
        const parsed = manualLedgerAdjustmentSchema.safeParse(body);
        if (!parsed.success) {
            throw new ValidationError('Invalid input', { issues: parsed.error.flatten().fieldErrors });
        }
        const svc = getAdminService(c);
        const result = await svc.manualLedgerAdjustment(parsed.data, session);
        return c.json(success(result), 201);
    }
);

// ─── Policy evaluation (dry run) ─────────────────────────────────

adminRoutes.post('/policies/evaluate', async (c) => {
    const session = c.get('session');
    authorize(session, 'admin:access');
    const body = await c.req.json<{ actionCode: string; context: Record<string, unknown> }>();
    if (!body.actionCode) throw new ValidationError('actionCode is required');
    const svc = getAdminService(c);
    const result = await svc.evaluatePolicy(body, session);
    return c.json(success(result));
});

// ─── Bookings (admin view) ────────────────────────────────────────

adminRoutes.get('/bookings', async (c) => {
    const session = c.get('session');
    authorize(session, 'admin:access');
    const { page, pageSize } = parsePagination(c.req.query());
    const svc = getAdminService(c);
    const result = await svc.listBookings(page, pageSize);
    return c.json(success(result));
});

// ─── Payouts (admin view) ─────────────────────────────────────────

adminRoutes.get('/payouts', async (c) => {
    const session = c.get('session');
    authorize(session, 'admin:access');
    const { page, pageSize } = parsePagination(c.req.query());
    const svc = getAdminService(c);
    const result = await svc.listPayouts(page, pageSize);
    return c.json(success(result));
});

adminRoutes.post('/payouts/:payoutId/approve', async (c) => {
    const session = c.get('session');
    authorize(session, 'payout:approve');
    const svc = getAdminService(c);
    const result = await svc.approveAdminPayout(c.req.param('payoutId'), session);
    return c.json(success(result));
});

// ─── Refunds (admin view) ─────────────────────────────────────────

adminRoutes.get('/refunds', async (c) => {
    const session = c.get('session');
    authorize(session, 'admin:access');
    const { page, pageSize } = parsePagination(c.req.query());
    const svc = getAdminService(c);
    const result = await svc.listRefunds(page, pageSize);
    return c.json(success(result));
});

adminRoutes.post('/refunds/:refundId/approve', async (c) => {
    const session = c.get('session');
    authorize(session, 'refund:approve');
    const svc = getAdminService(c);
    const result = await svc.approveRefund(c.req.param('refundId'), session);
    return c.json(success(result));
});

adminRoutes.post('/refunds/:refundId/reject', async (c) => {
    const session = c.get('session');
    authorize(session, 'refund:approve');
    const { reason } = await c.req.json<{ reason: string }>();
    const svc = getAdminService(c);
    const result = await svc.rejectRefund(c.req.param('refundId'), reason, session);
    return c.json(success(result));
});

// ─── Providers (admin view) ───────────────────────────────────────

adminRoutes.get('/providers', async (c) => {
    const session = c.get('session');
    authorize(session, 'admin:access');
    const { page, pageSize } = parsePagination(c.req.query());
    const { ProvidersRepository, createDbClient: createDb } = await import('@felix-travel/db');
    const repo = new ProvidersRepository(createDb(c.env.DB));
    const providers = await repo.findAll(pageSize, (page - 1) * pageSize);
    return c.json(success(providers));
});

// ─── Audit log ────────────────────────────────────────────────────

adminRoutes.get('/audit-logs', async (c) => {
    const session = c.get('session');
    authorize(session, 'admin:access');
    const { page, pageSize } = parsePagination(c.req.query(), 50);
    const entityType = c.req.query('entityType');
    const entityId = c.req.query('entityId');
    const svc = getAdminService(c);
    const result = await svc.listAuditLogs(page, pageSize, entityType, entityId);
    return c.json(success(result));
});

// ─── Risk events ─────────────────────────────────────────────────

adminRoutes.get('/risk/events', async (c) => {
    const session = c.get('session');
    authorize(session, 'admin:access');
    const svc = getAdminService(c);
    const events = await svc.listRiskEvents();
    return c.json(success(events));
});
