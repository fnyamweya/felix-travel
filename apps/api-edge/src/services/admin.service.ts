import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { desc, eq, and, gte, lte } from 'drizzle-orm';
import {
    users,
    bookings,
    bookingItems,
    bookingChargeOverrides,
    bookingStatusHistory,
    payouts,
    refunds,
    auditLogs,
    riskEvents,
    roles,
    userRoles,
    permissions,
    rolePermissions,
    ledgerEntries,
    ledgerEntryLines,
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
    // ── Roles & Permissions ────────────────────────────────────────────────────────

    async listRoles() {
        return this.db
            .select()
            .from(roles)
            .orderBy(roles.slug);
    }

    async listPermissions() {
        return this.db
            .select()
            .from(permissions)
            .orderBy(permissions.group, permissions.code);
    }

    async getRolePermissions(roleId: string) {
        return this.db
            .select({
                permissionId: permissions.id,
                code: permissions.code,
                name: permissions.name,
                group: permissions.group,
            })
            .from(rolePermissions)
            .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
            .where(eq(rolePermissions.roleId, roleId))
            .orderBy(permissions.group, permissions.code);
    }

    async getUserRoles(userId: string) {
        return this.db
            .select({
                id: userRoles.id,
                roleId: userRoles.roleId,
                roleSlug: roles.slug,
                roleName: roles.name,
                providerId: userRoles.providerId,
                isActive: userRoles.isActive,
                grantedBy: userRoles.grantedBy,
                grantedAt: userRoles.grantedAt,
                revokedAt: userRoles.revokedAt,
            })
            .from(userRoles)
            .innerJoin(roles, eq(roles.id, userRoles.roleId))
            .where(eq(userRoles.userId, userId))
            .orderBy(userRoles.grantedAt);
    }

    async addPermissionToRole(roleId: string, permissionId: string, session: SessionContext) {
        await this.db.insert(rolePermissions).values({ roleId, permissionId });
        await this.db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: session.userId,
            actorRole: session.role,
            action: 'admin.permission_granted',
            entityType: 'role',
            entityId: roleId,
            changes: JSON.stringify({ permissionId }),
            ipAddress: null,
            userAgent: null,
        });
        return { granted: true };
    }

    async removePermissionFromRole(roleId: string, permissionId: string, session: SessionContext) {
        await this.db
            .delete(rolePermissions)
            .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)));
        await this.db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: session.userId,
            actorRole: session.role,
            action: 'admin.permission_revoked',
            entityType: 'role',
            entityId: roleId,
            changes: JSON.stringify({ permissionId }),
            ipAddress: null,
            userAgent: null,
        });
        return { revoked: true };
    }

    // ── Booking Detail ────────────────────────────────────────────────────────

    async getBookingDetail(bookingId: string) {
        const [booking] = await this.db
            .select()
            .from(bookings)
            .where(eq(bookings.id, bookingId))
            .limit(1);
        if (!booking) return null;

        const items = await this.db
            .select()
            .from(bookingItems)
            .where(eq(bookingItems.bookingId, bookingId));

        const history = await this.db
            .select()
            .from(bookingStatusHistory)
            .where(eq(bookingStatusHistory.bookingId, bookingId))
            .orderBy(bookingStatusHistory.createdAt);

        const overrides = await this.db
            .select()
            .from(bookingChargeOverrides)
            .where(eq(bookingChargeOverrides.bookingId, bookingId))
            .orderBy(bookingChargeOverrides.createdAt);

        return { booking, items, history, overrides };
    }

    // ── Booking Charge Overrides ──────────────────────────────────────────────

    async listChargeOverrides(bookingId: string) {
        return this.db
            .select()
            .from(bookingChargeOverrides)
            .where(eq(bookingChargeOverrides.bookingId, bookingId))
            .orderBy(bookingChargeOverrides.createdAt);
    }

    async createChargeOverride(
        bookingId: string,
        data: {
            chargeDefinitionId: string;
            bookingItemId?: string;
            overrideAmount?: number;
            overrideRateBps?: number;
            isWaived?: boolean;
            reason: string;
        },
        session: SessionContext,
    ) {
        const id = crypto.randomUUID();
        const [row] = await this.db.insert(bookingChargeOverrides).values({
            id,
            bookingId,
            bookingItemId: data.bookingItemId ?? null,
            chargeDefinitionId: data.chargeDefinitionId,
            overrideAmount: data.overrideAmount ?? null,
            overrideRateBps: data.overrideRateBps ?? null,
            isWaived: data.isWaived ?? false,
            reason: data.reason,
            createdBy: session.userId,
            status: 'pending',
        }).returning();

        await this.db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: session.userId,
            actorRole: session.role,
            action: 'admin.charge_override_created',
            entityType: 'booking',
            entityId: bookingId,
            changes: JSON.stringify({ overrideId: id, ...data }),
            ipAddress: null,
            userAgent: null,
        });

        return row;
    }

    async approveChargeOverride(overrideId: string, session: SessionContext) {
        const [updated] = await this.db
            .update(bookingChargeOverrides)
            .set({ status: 'approved', approvedBy: session.userId, updatedAt: new Date().toISOString() })
            .where(eq(bookingChargeOverrides.id, overrideId))
            .returning();

        await this.db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: session.userId,
            actorRole: session.role,
            action: 'admin.charge_override_approved',
            entityType: 'booking_charge_override',
            entityId: overrideId,
            changes: null,
            ipAddress: null,
            userAgent: null,
        });

        return updated;
    }

    async rejectChargeOverride(overrideId: string, reason: string, session: SessionContext) {
        const [updated] = await this.db
            .update(bookingChargeOverrides)
            .set({ status: 'rejected', updatedAt: new Date().toISOString() })
            .where(eq(bookingChargeOverrides.id, overrideId))
            .returning();

        await this.db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: session.userId,
            actorRole: session.role,
            action: 'admin.charge_override_rejected',
            entityType: 'booking_charge_override',
            entityId: overrideId,
            changes: JSON.stringify({ reason }),
            ipAddress: null,
            userAgent: null,
        });

        return updated;
    }

    // ── Reconciliation ────────────────────────────────────────────────────────

    async getReconciliationSummary(fromDate?: string, toDate?: string) {
        const from = fromDate ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const to = toDate ?? new Date().toISOString().slice(0, 10);

        // Total bookings in period
        const bookingRows = await this.db
            .select()
            .from(bookings)
            .where(and(
                gte(bookings.createdAt, from),
                lte(bookings.createdAt, to + 'T23:59:59'),
            ));

        const totalBookings = bookingRows.length;
        const totalBookingValue = bookingRows.reduce((s, b) => s + b.totalAmount, 0);
        const totalCommission = bookingRows.reduce((s, b) => s + b.commissionAmount, 0);

        // Payouts in period
        const payoutRows = await this.db
            .select()
            .from(payouts)
            .where(and(
                gte(payouts.createdAt, from),
                lte(payouts.createdAt, to + 'T23:59:59'),
            ));

        const totalPayouts = payoutRows.length;
        const totalPayoutValue = payoutRows.reduce((s, p) => s + p.amount, 0);
        const succeededPayouts = payoutRows.filter(p => p.status === 'succeeded').length;
        const failedPayouts = payoutRows.filter(p => p.status === 'failed').length;

        // Refunds in period
        const refundRows = await this.db
            .select()
            .from(refunds)
            .where(and(
                gte(refunds.createdAt, from),
                lte(refunds.createdAt, to + 'T23:59:59'),
            ));

        const totalRefunds = refundRows.length;
        const totalRefundValue = refundRows.reduce((s, r) => s + r.amount, 0);

        // Ledger totals: sum debits and credits across all entries in period
        const entryRows = await this.db
            .select({
                type: ledgerEntries.type,
                debit: ledgerEntryLines.debitAmount,
                credit: ledgerEntryLines.creditAmount,
            })
            .from(ledgerEntryLines)
            .innerJoin(ledgerEntries, eq(ledgerEntries.id, ledgerEntryLines.entryId))
            .where(and(
                gte(ledgerEntries.createdAt, from),
                lte(ledgerEntries.createdAt, to + 'T23:59:59'),
            ));

        const ledgerTotalDebits = entryRows.reduce((s, e) => s + (e.debit ?? 0), 0);
        const ledgerTotalCredits = entryRows.reduce((s, e) => s + (e.credit ?? 0), 0);

        // Booking statuses breakdown
        const statusBreakdown: Record<string, number> = {};
        for (const b of bookingRows) {
            statusBreakdown[b.status] = (statusBreakdown[b.status] ?? 0) + 1;
        }

        return {
            period: { from, to },
            bookings: {
                total: totalBookings,
                totalValue: totalBookingValue,
                totalCommission,
                statusBreakdown,
            },
            payouts: {
                total: totalPayouts,
                totalValue: totalPayoutValue,
                succeeded: succeededPayouts,
                failed: failedPayouts,
            },
            refunds: {
                total: totalRefunds,
                totalValue: totalRefundValue,
            },
            ledger: {
                totalDebits: ledgerTotalDebits,
                totalCredits: ledgerTotalCredits,
                imbalance: ledgerTotalDebits - ledgerTotalCredits,
            },
        };
    }
}
