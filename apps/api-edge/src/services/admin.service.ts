import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { desc, eq, and } from 'drizzle-orm';
import {
    users,
    bookings,
    payouts,
    refunds,
    auditLogs,
    riskEvents,
    roles,
    userRoles,
} from '@felix-travel/db/schema';
import { ValidationError } from '../lib/errors.js';
import { newId } from '../lib/id.js';
import type { SessionContext } from '@felix-travel/types';

export class AdminService {
    constructor(private readonly db: DrizzleD1Database<any>) { }

    // ── Users ─────────────────────────────────────────────────────────────────

    async listUsers(page: number, pageSize: number) {
        return this.db
            .select()
            .from(users)
            .orderBy(desc(users.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize);
    }

    async getUserById(userId: string) {
        const [user] = await this.db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        return user ?? null;
    }

    async assignRole(
        userId: string,
        roleSlug: string,
        providerId: string | undefined,
        session: SessionContext,
        kvCache?: KVNamespace,
    ) {
        const [role] = await this.db
            .select()
            .from(roles)
            .where(eq(roles.slug, roleSlug))
            .limit(1);
        if (!role) throw new ValidationError(`Role '${roleSlug}' not found`);

        await this.db.insert(userRoles).values({
            id: newId(),
            userId,
            roleId: role.id,
            providerId: providerId ?? null,
            grantedBy: session.userId,
            isActive: true,
            grantedAt: new Date().toISOString(),
        });

        await this.db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: session.userId,
            actorRole: session.role,
            action: 'admin.role_assigned',
            entityType: 'user',
            entityId: userId,
            changes: JSON.stringify({ roleSlug, providerId }),
            ipAddress: null,
            userAgent: null,
        });

        if (kvCache) {
            await kvCache.delete(`perms:${userId}`);
        }

        return { assigned: true, roleSlug, userId };
    }

    async removeRole(
        userId: string,
        roleSlug: string,
        session: SessionContext,
        kvCache?: KVNamespace,
    ) {
        const [role] = await this.db
            .select()
            .from(roles)
            .where(eq(roles.slug, roleSlug))
            .limit(1);
        if (!role) throw new ValidationError(`Role '${roleSlug}' not found`);

        await this.db
            .update(userRoles)
            .set({ isActive: false })
            .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)));

        await this.db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: session.userId,
            actorRole: session.role,
            action: 'admin.role_removed',
            entityType: 'user',
            entityId: userId,
            changes: JSON.stringify({ roleSlug }),
            ipAddress: null,
            userAgent: null,
        });

        if (kvCache) {
            await kvCache.delete(`perms:${userId}`);
        }

        return { removed: true };
    }

    async disableUser(userId: string, session: SessionContext) {
        await this.db.update(users).set({ isActive: false }).where(eq(users.id, userId));
        await this.db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: session.userId,
            actorRole: session.role,
            action: 'admin.user_disabled',
            entityType: 'user',
            entityId: userId,
            changes: null,
            ipAddress: null,
            userAgent: null,
        });
        return { disabled: true };
    }

    async enableUser(userId: string, session: SessionContext) {
        await this.db.update(users).set({ isActive: true }).where(eq(users.id, userId));
        await this.db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: session.userId,
            actorRole: session.role,
            action: 'admin.user_enabled',
            entityType: 'user',
            entityId: userId,
            changes: null,
            ipAddress: null,
            userAgent: null,
        });
        return { enabled: true };
    }

    // ── Ledger ────────────────────────────────────────────────────────────────

    async manualLedgerAdjustment(
        data: { idempotencyKey: string;[key: string]: unknown },
        session: SessionContext,
    ) {
        await this.db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: session.userId,
            actorRole: session.role,
            action: 'admin.ledger_adjustment',
            entityType: 'ledger',
            entityId: data.idempotencyKey,
            changes: JSON.stringify(data),
            ipAddress: null,
            userAgent: null,
        });
        return { adjusted: true };
    }

    // ── Policies ──────────────────────────────────────────────────────────────

    async evaluatePolicy(
        _body: { actionCode: string; context: Record<string, unknown> },
        _session: SessionContext,
    ) {
        // Policy engine package not available — return stub result
        return { allowed: false, reason: 'policy_engine_unavailable' };
    }

    // ── Bookings ──────────────────────────────────────────────────────────────

    async listBookings(page: number, pageSize: number) {
        const rows = await this.db
            .select()
            .from(bookings)
            .orderBy(desc(bookings.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize);
        return { bookings: rows, meta: { page, pageSize, total: rows.length } };
    }

    // ── Payouts ───────────────────────────────────────────────────────────────

    async listPayouts(page: number, pageSize: number) {
        const rows = await this.db
            .select()
            .from(payouts)
            .orderBy(desc(payouts.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize);
        return { payouts: rows, meta: { page, pageSize, total: rows.length } };
    }

    async approveAdminPayout(payoutId: string, session: SessionContext) {
        await this.db
            .update(payouts)
            .set({ status: 'approved' as any })
            .where(eq(payouts.id, payoutId));
        await this.db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: session.userId,
            actorRole: session.role,
            action: 'admin.payout_approved',
            entityType: 'payout',
            entityId: payoutId,
            changes: null,
            ipAddress: null,
            userAgent: null,
        });
        return { approved: true };
    }

    // ── Refunds ───────────────────────────────────────────────────────────────

    async listRefunds(page: number, pageSize: number) {
        const rows = await this.db
            .select()
            .from(refunds)
            .orderBy(desc(refunds.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize);
        return { refunds: rows, meta: { page, pageSize, total: rows.length } };
    }

    async approveRefund(refundId: string, session: SessionContext) {
        await this.db
            .update(refunds)
            .set({ status: 'approved' })
            .where(eq(refunds.id, refundId));
        await this.db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: session.userId,
            actorRole: session.role,
            action: 'admin.refund_approved',
            entityType: 'refund',
            entityId: refundId,
            changes: null,
            ipAddress: null,
            userAgent: null,
        });
        return { approved: true };
    }

    async rejectRefund(refundId: string, reason: string, session: SessionContext) {
        await this.db
            .update(refunds)
            .set({ status: 'rejected' })
            .where(eq(refunds.id, refundId));
        await this.db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: session.userId,
            actorRole: session.role,
            action: 'admin.refund_rejected',
            entityType: 'refund',
            entityId: refundId,
            changes: JSON.stringify({ reason }),
            ipAddress: null,
            userAgent: null,
        });
        return { rejected: true };
    }

    // ── Audit Logs ────────────────────────────────────────────────────────────

    async listAuditLogs(
        page: number,
        pageSize: number,
        entityType?: string,
        entityId?: string,
    ) {
        const whereClause = entityType && entityId
            ? and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId))
            : entityType
                ? eq(auditLogs.entityType, entityType)
                : undefined;
        const rows = await this.db
            .select()
            .from(auditLogs)
            .where(whereClause)
            .orderBy(desc(auditLogs.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize);
        return { logs: rows, meta: { page, pageSize, total: rows.length } };
    }

    // ── Risk Events ───────────────────────────────────────────────────────────

    async listRiskEvents() {
        return this.db
            .select()
            .from(riskEvents)
            .orderBy(desc(riskEvents.createdAt))
            .limit(100);
    }
}
