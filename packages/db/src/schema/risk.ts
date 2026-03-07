/**
 * Risk engine schema — events and signals for risk scoring.
 *
 * risk_events stores the outcome of each risk evaluation (score + action taken).
 * risk_signals stores ephemeral signals (failed logins, IP anomalies) that
 * feed into subsequent evaluations. Signals have TTLs managed by cleanup jobs.
 */
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const riskEvents = sqliteTable(
    'risk_events',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        sessionId: text('session_id'),
        eventType: text('event_type').notNull(),
        score: integer('score').notNull(),
        action: text('action', {
            enum: ['allow', 'step_up_sms', 'step_up_totp', 'manual_review', 'deny'],
        }).notNull(),
        /** JSON array of reason strings explaining the score */
        reasons: text('reasons').notNull().default('[]'),
        ipAddress: text('ip_address').notNull(),
        userAgent: text('user_agent').notNull(),
        /** Arbitrary metadata for debugging (redacted before logging) */
        metadata: text('metadata'),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        userIdx: index('idx_risk_events_user').on(table.userId),
        eventTypeIdx: index('idx_risk_events_type').on(table.eventType),
        createdIdx: index('idx_risk_events_created').on(table.createdAt),
    })
);

export const riskSignals = sqliteTable(
    'risk_signals',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** Signal type, e.g. "failed_login", "impossible_travel", "new_device" */
        signalType: text('signal_type').notNull(),
        /** Signal value, e.g. IP address, country code, count */
        value: text('value').notNull(),
        expiresAt: text('expires_at').notNull(),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        userSignalIdx: index('idx_risk_signals_user_type').on(table.userId, table.signalType),
        expiresIdx: index('idx_risk_signals_expires').on(table.expiresAt),
    })
);
