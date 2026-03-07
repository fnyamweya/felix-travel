import { sqliteTable, text, index, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').references(() => users.id),
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    changes: text('changes'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    actorIdx: index('audit_logs_actor_idx').on(t.actorId),
    entityIdx: index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    actionIdx: index('audit_logs_action_idx').on(t.action),
    createdAtIdx: index('audit_logs_created_at_idx').on(t.createdAt),
  })
);

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
    type: text('type').notNull(),
    channel: text('channel', { enum: ['email', 'sms', 'push', 'in_app'] }).notNull(),
    subject: text('subject'),
    body: text('body').notNull(),
    metadata: text('metadata'),
    isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    sentAt: text('sent_at'),
    readAt: text('read_at'),
    errorMessage: text('error_message'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ userIdx: index('notifications_user_idx').on(t.userId) })
);
