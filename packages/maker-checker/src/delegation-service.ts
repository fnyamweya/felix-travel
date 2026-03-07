/**
 * Delegation service — allows users to delegate their approval authority
 * to another user for a scoped set of actions and time period.
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { and, eq, sql, isNull, lt } from 'drizzle-orm';
import { approvalDelegations } from '@felix-travel/db/schema';
import type { Logger } from '@felix-travel/telemetry';

export interface DelegationServiceDeps {
    db: DrizzleD1Database<Record<string, unknown>>;
    logger: Logger;
    generateId: () => string;
}

export interface DelegationService {
    create(
        delegatorId: string,
        delegateId: string,
        scope: string,
        expiresAt: string,
    ): Promise<{ delegationId: string }>;

    revoke(delegationId: string, revokedBy: string): Promise<void>;

    getActive(userId: string): Promise<Array<{
        id: string;
        delegateId: string;
        scope: string;
        expiresAt: string;
    }>>;

    getDelegationsTo(userId: string): Promise<Array<{
        id: string;
        delegatorId: string;
        scope: string;
        expiresAt: string;
    }>>;

    cleanupExpired(): Promise<number>;
}

export function createDelegationService(deps: DelegationServiceDeps): DelegationService {
    const { db, logger, generateId } = deps;

    function nowIso(): string {
        return new Date().toISOString().replace('T', ' ').slice(0, 19);
    }

    return {
        async create(delegatorId, delegateId, scope, expiresAt) {
            if (delegatorId === delegateId) {
                throw new Error('Cannot delegate to yourself');
            }

            const id = generateId();
            await db.insert(approvalDelegations).values({
                id,
                delegatorId,
                delegateId,
                scope,
                expiresAt,
                createdAt: nowIso(),
            });

            logger.info('delegation created', { delegatorId, delegateId, scope });
            return { delegationId: id };
        },

        async revoke(delegationId, revokedBy) {
            await db
                .update(approvalDelegations)
                .set({ revokedAt: nowIso() })
                .where(
                    and(
                        eq(approvalDelegations.id, delegationId),
                        isNull(approvalDelegations.revokedAt),
                    ),
                );

            logger.info('delegation revoked', { delegationId, revokedBy });
        },

        async getActive(userId) {
            const rows = await db
                .select({
                    id: approvalDelegations.id,
                    delegateId: approvalDelegations.delegateId,
                    scope: approvalDelegations.scope,
                    expiresAt: approvalDelegations.expiresAt,
                })
                .from(approvalDelegations)
                .where(
                    and(
                        eq(approvalDelegations.delegatorId, userId),
                        isNull(approvalDelegations.revokedAt),
                        sql`${approvalDelegations.expiresAt} > datetime('now')`,
                    ),
                );

            return rows;
        },

        async getDelegationsTo(userId) {
            const rows = await db
                .select({
                    id: approvalDelegations.id,
                    delegatorId: approvalDelegations.delegatorId,
                    scope: approvalDelegations.scope,
                    expiresAt: approvalDelegations.expiresAt,
                })
                .from(approvalDelegations)
                .where(
                    and(
                        eq(approvalDelegations.delegateId, userId),
                        isNull(approvalDelegations.revokedAt),
                        sql`${approvalDelegations.expiresAt} > datetime('now')`,
                    ),
                );

            return rows;
        },

        async cleanupExpired() {
            const now = nowIso();
            const result = await db
                .delete(approvalDelegations)
                .where(
                    and(
                        lt(approvalDelegations.expiresAt, now),
                        isNull(approvalDelegations.revokedAt),
                    ),
                );
            return result.meta.changes ?? 0;
        },
    };
}
