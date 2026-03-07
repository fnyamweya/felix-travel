/**
 * Candidate resolver — given compiled candidate rules for a workflow step,
 * resolve the set of eligible user IDs from the database.
 *
 * Supports rule types: role, capability, org_unit, expression.
 * For random/weighted selection, returns the full pool for the randomizer.
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { userRoles, rolePermissions, permissions, roles, orgUnits } from '@felix-travel/db/schema';
import type { CompiledCandidateRule } from './compiler.js';

export interface ResolvedCandidate {
    userId: string;
    weight: number;
    matchedRule: string;
}

export interface CandidateResolver {
    resolve(
        rules: CompiledCandidateRule[],
        /** Exclude user IDs (e.g. the action requestor to prevent self-approval) */
        excludeUserIds?: string[],
        /** Scope to a specific provider */
        providerScope?: string,
    ): Promise<ResolvedCandidate[]>;
}

export function createCandidateResolver(
    db: DrizzleD1Database<Record<string, unknown>>,
): CandidateResolver {
    return {
        async resolve(rules, excludeUserIds = [], providerScope) {
            const candidateMap = new Map<string, ResolvedCandidate>();

            for (const rule of rules) {
                let userIds: string[] = [];

                switch (rule.ruleType) {
                    case 'role': {
                        // Find users with the specified role slug
                        const roleRows = await db
                            .select({ id: roles.id })
                            .from(roles)
                            .where(eq(roles.slug, rule.ruleValue))
                            .limit(1);

                        if (roleRows.length > 0) {
                            const roleId = roleRows[0]!.id;
                            const query = providerScope
                                ? db
                                    .select({ userId: userRoles.userId })
                                    .from(userRoles)
                                    .where(
                                        and(
                                            eq(userRoles.roleId, roleId),
                                            eq(userRoles.providerId, providerScope),
                                        ),
                                    )
                                : db
                                    .select({ userId: userRoles.userId })
                                    .from(userRoles)
                                    .where(eq(userRoles.roleId, roleId));

                            const rows = await query;
                            userIds = rows.map((r) => r.userId);
                        }
                        break;
                    }

                    case 'capability': {
                        // Find users who have the specified permission code via their roles
                        const permRows = await db
                            .select({ id: permissions.id })
                            .from(permissions)
                            .where(eq(permissions.code, rule.ruleValue))
                            .limit(1);

                        if (permRows.length > 0) {
                            const permId = permRows[0]!.id;
                            // Get role IDs that have this permission
                            const rpRows = await db
                                .select({ roleId: rolePermissions.roleId })
                                .from(rolePermissions)
                                .where(eq(rolePermissions.permissionId, permId));

                            const roleIds = rpRows.map((r) => r.roleId);

                            for (const roleId of roleIds) {
                                const urRows = await db
                                    .select({ userId: userRoles.userId })
                                    .from(userRoles)
                                    .where(eq(userRoles.roleId, roleId));
                                for (const ur of urRows) {
                                    userIds.push(ur.userId);
                                }
                            }
                        }
                        break;
                    }

                    case 'org_unit': {
                        // Find users assigned roles scoped to providers within this org unit
                        const ouRows = await db
                            .select({ providerId: orgUnits.providerId })
                            .from(orgUnits)
                            .where(eq(orgUnits.id, rule.ruleValue));

                        for (const ou of ouRows) {
                            if (!ou.providerId) continue;
                            const urRows = await db
                                .select({ userId: userRoles.userId })
                                .from(userRoles)
                                .where(eq(userRoles.providerId, ou.providerId));
                            for (const ur of urRows) {
                                userIds.push(ur.userId);
                            }
                        }
                        break;
                    }

                    case 'expression': {
                        // Expression rules are evaluated at request submission time,
                        // not at candidate resolution. They act as filters on already
                        // resolved candidates. Skip here — handled by the engine.
                        break;
                    }
                }

                // Add to candidate map (dedup by userId, accumulate highest weight)
                for (const uid of userIds) {
                    if (excludeUserIds.includes(uid)) continue;
                    const existing = candidateMap.get(uid);
                    if (!existing || rule.weight > existing.weight) {
                        candidateMap.set(uid, {
                            userId: uid,
                            weight: rule.weight,
                            matchedRule: `${rule.ruleType}:${rule.ruleValue}`,
                        });
                    }
                }
            }

            return Array.from(candidateMap.values());
        },
    };
}

export { createCandidateResolver as resolveCandidates };
