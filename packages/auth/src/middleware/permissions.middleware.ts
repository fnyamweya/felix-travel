/**
 * Permissions hydration middleware — after JWT auth middleware runs,
 * this middleware loads the user's role-based permissions from DB/cache
 * and populates session.permissions + session.roles.
 *
 * Should run after requireAuth() in the middleware chain.
 */
import type { Context, Next } from 'hono';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { userRoles, rolePermissions, permissions, roles } from '@felix-travel/db/schema';
import type { SessionContext } from '@felix-travel/types';

interface PermissionsEnv {
    Variables: {
        session: SessionContext;
    };
    Bindings: {
        DB: D1Database;
        POLICY_CACHE_KV?: KVNamespace;
    };
}

/**
 * Middleware factory that hydrates session.permissions and session.roles
 * from the database. Uses KV cache for performance (TTL = 5 minutes).
 */
export function hydratePermissions(getDb: (env: unknown) => DrizzleD1Database<Record<string, unknown>>) {
    return async function permissionsMiddleware(c: Context<PermissionsEnv>, next: Next) {
        const session = c.get('session');
        if (!session) {
            await next();
            return;
        }

        const cacheKey = `perms:${session.userId}`;
        const kv = c.env.POLICY_CACHE_KV;

        // Try cache first
        if (kv) {
            const cached = await kv.get(cacheKey, 'json') as { roles: string[]; permissions: string[] } | null;
            if (cached) {
                session.roles = cached.roles;
                session.permissions = cached.permissions;
                c.set('session', session);
                await next();
                return;
            }
        }

        // Load from DB
        const db = getDb(c.env);

        const userRoleRows = await db
            .select({
                roleSlug: roles.slug,
                roleId: roles.id,
            })
            .from(userRoles)
            .innerJoin(roles, eq(roles.id, userRoles.roleId))
            .where(
                and(
                    eq(userRoles.userId, session.userId),
                    eq(userRoles.isActive, true),
                    eq(roles.isActive, true),
                ),
            );

        const roleSlugs = userRoleRows.map((r: { roleSlug: string; roleId: string }) => r.roleSlug);
        const roleIds = userRoleRows.map((r: { roleSlug: string; roleId: string }) => r.roleId);

        // Load all permission codes for these roles
        const permCodes: string[] = [];
        for (const roleId of roleIds) {
            const rpRows = await db
                .select({ code: permissions.code })
                .from(rolePermissions)
                .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
                .where(eq(rolePermissions.roleId, roleId));

            for (const rp of rpRows) {
                if (!permCodes.includes(rp.code)) {
                    permCodes.push(rp.code);
                }
            }
        }

        session.roles = roleSlugs;
        session.permissions = permCodes;
        c.set('session', session);

        // Cache for 5 minutes
        if (kv) {
            await kv.put(cacheKey, JSON.stringify({ roles: roleSlugs, permissions: permCodes }), {
                expirationTtl: 300,
            });
        }

        await next();
    };
}
