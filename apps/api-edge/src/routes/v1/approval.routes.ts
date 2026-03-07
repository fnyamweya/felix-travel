/**
 * Approval routes — /api/v1/approvals
 *
 * GET    /pending             List pending approvals for the current user
 * GET    /:requestId          Get approval request details
 * POST   /:requestId/decide   Submit a decision (approve/reject/abstain/escalate)
 * POST   /:requestId/cancel   Cancel an approval request (requester only)
 * POST   /delegate            Create a delegation
 * DELETE /delegate/:delegationId  Revoke a delegation
 * GET    /delegations         List delegations from current user
 */
import { Hono } from 'hono';
import type { Env } from '../../bindings.js';
import type { SessionContext } from '@felix-travel/types';
import type { ApprovalDecisionType } from '@felix-travel/types';
import { requireAuth, hydratePermissions } from '@felix-travel/auth';
import { createDbClient } from '@felix-travel/db';
import { createLogger } from '@felix-travel/telemetry';
import { success } from '../../lib/response.js';
import { ValidationError } from '../../lib/errors.js';

type HonoEnv = {
    Bindings: Env;
    Variables: { session: SessionContext };
};

export const approvalRoutes = new Hono<HonoEnv>();

const getDb = (env: unknown) => createDbClient((env as Env).DB);
const logger = createLogger({ level: 'info', service: 'approval-routes' });

approvalRoutes.use('*', requireAuth);
approvalRoutes.use('*', hydratePermissions(getDb));

approvalRoutes.get('/pending', async (c) => {
    const session = c.get('session');
    const db = createDbClient(c.env.DB);
    const { createApprovalService } = await import('@felix-travel/maker-checker');
    const svc = createApprovalService({ db, logger, generateId: () => crypto.randomUUID() });
    const pending = await svc.listPendingForUser(session.userId);
    return c.json(success(pending));
});

approvalRoutes.get('/:requestId', async (c) => {
    const requestId = c.req.param('requestId');
    const db = createDbClient(c.env.DB);
    const { createApprovalService } = await import('@felix-travel/maker-checker');
    const svc = createApprovalService({ db, logger, generateId: () => crypto.randomUUID() });
    const request = await svc.getRequest(requestId);
    return c.json(success(request));
});

approvalRoutes.post('/:requestId/decide', async (c) => {
    const session = c.get('session');
    const requestId = c.req.param('requestId');
    const body = await c.req.json<{
        decision: ApprovalDecisionType;
        comment?: string;
    }>();
    if (!body.decision) throw new ValidationError('decision is required');
    const validDecisions: ApprovalDecisionType[] = ['approve', 'reject', 'abstain', 'escalate'];
    if (!validDecisions.includes(body.decision)) {
        throw new ValidationError(`decision must be one of: ${validDecisions.join(', ')}`);
    }
    const db = createDbClient(c.env.DB);
    const { createApprovalService } = await import('@felix-travel/maker-checker');
    const svc = createApprovalService({ db, logger, generateId: () => crypto.randomUUID() });
    const result = await svc.submitDecision(
        requestId,
        session.userId,
        body.decision,
        body.comment ?? null,
        0,
    );
    return c.json(success(result));
});

approvalRoutes.post('/:requestId/cancel', async (c) => {
    const session = c.get('session');
    const requestId = c.req.param('requestId');
    const db = createDbClient(c.env.DB);
    const { createApprovalService } = await import('@felix-travel/maker-checker');
    const svc = createApprovalService({ db, logger, generateId: () => crypto.randomUUID() });
    await svc.cancelRequest(requestId, session.userId);
    return c.json(success({ cancelled: true }));
});

// ─── Delegation ──────────────────────────────────────────────────

approvalRoutes.post('/delegate', async (c) => {
    const session = c.get('session');
    const body = await c.req.json<{
        delegateToUserId: string;
        actionCodes?: string;
        expiresAt: string;
    }>();
    if (!body.delegateToUserId || !body.expiresAt) {
        throw new ValidationError('delegateToUserId and expiresAt are required');
    }
    const db = createDbClient(c.env.DB);
    const { createDelegationService } = await import('@felix-travel/maker-checker');
    const svc = createDelegationService({ db, logger, generateId: () => crypto.randomUUID() });
    const delegation = await svc.create(
        session.userId,
        body.delegateToUserId,
        body.actionCodes ?? '*',
        body.expiresAt,
    );
    return c.json(success(delegation), 201);
});

approvalRoutes.delete('/delegate/:delegationId', async (c) => {
    const session = c.get('session');
    const delegationId = c.req.param('delegationId');
    const db = createDbClient(c.env.DB);
    const { createDelegationService } = await import('@felix-travel/maker-checker');
    const svc = createDelegationService({ db, logger, generateId: () => crypto.randomUUID() });
    await svc.revoke(delegationId, session.userId);
    return c.json(success({ revoked: true }));
});

approvalRoutes.get('/delegations', async (c) => {
    const session = c.get('session');
    const db = createDbClient(c.env.DB);
    const { createDelegationService } = await import('@felix-travel/maker-checker');
    const svc = createDelegationService({ db, logger, generateId: () => crypto.randomUUID() });
    const delegations = await svc.getActive(session.userId);
    return c.json(success(delegations));
});
