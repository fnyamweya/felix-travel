/**
 * Permissions schema — roles, permissions, role_permissions, user_roles, org_units.
 *
 * Best-practice authorization pattern:
 * - roles table is data (seeded)
 * - permissions table stores granular capabilities
 * - role_permissions maps roles to their granted capabilities
 * - user_roles assigns roles to users (supporting provider-scoped roles)
 * - org_units supports hierarchical approval routing
 *
 * Services call authorize(ctx, 'booking.read.own') — they never check role slugs directly.
 */
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const roles = sqliteTable(
    'roles',
    {
        id: text('id').primaryKey(),
        slug: text('slug').notNull(),
        name: text('name').notNull(),
        description: text('description').notNull().default(''),
        /** If true, a user can hold at most one active instance of this role */
        isExclusive: integer('is_exclusive', { mode: 'boolean' }).notNull().default(false),
        isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        slugIdx: uniqueIndex('uq_roles_slug').on(table.slug),
    })
);

export const permissions = sqliteTable(
    'permissions',
    {
        id: text('id').primaryKey(),
        /** Dotted code, e.g. "booking.read.own", "payout.approve" */
        code: text('code').notNull(),
        name: text('name').notNull(),
        description: text('description').notNull().default(''),
        /** Group for UI display: "Bookings", "Payouts", "Admin", etc. */
        group: text('group_name').notNull().default('General'),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        codeIdx: uniqueIndex('uq_permissions_code').on(table.code),
        groupIdx: index('idx_permissions_group').on(table.group),
    })
);

export const rolePermissions = sqliteTable(
    'role_permissions',
    {
        roleId: text('role_id')
            .notNull()
            .references(() => roles.id, { onDelete: 'cascade' }),
        permissionId: text('permission_id')
            .notNull()
            .references(() => permissions.id, { onDelete: 'cascade' }),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        pk: uniqueIndex('uq_role_permissions').on(table.roleId, table.permissionId),
    })
);

export const userRoles = sqliteTable(
    'user_roles',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        roleId: text('role_id')
            .notNull()
            .references(() => roles.id, { onDelete: 'cascade' }),
        /** Provider scope for provider-level roles (null = platform-level) */
        providerId: text('provider_id'),
        isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
        grantedBy: text('granted_by').notNull(),
        grantedAt: text('granted_at').notNull().default('(datetime())'),
        revokedAt: text('revoked_at'),
    },
    (table) => ({
        userRoleIdx: index('idx_user_roles_user').on(table.userId),
        roleIdx: index('idx_user_roles_role').on(table.roleId),
        userRoleProviderIdx: uniqueIndex('uq_user_roles_user_role_provider').on(
            table.userId,
            table.roleId,
            table.providerId
        ),
    })
);

export const orgUnits = sqliteTable(
    'org_units',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        parentId: text('parent_id'),
        type: text('type', { enum: ['platform', 'provider', 'department'] }).notNull(),
        providerId: text('provider_id'),
        isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        parentIdx: index('idx_org_units_parent').on(table.parentId),
        providerIdx: index('idx_org_units_provider').on(table.providerId),
    })
);
