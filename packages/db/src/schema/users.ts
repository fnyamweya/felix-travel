import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    phone: text('phone'),
    phoneVerified: integer('phone_verified', { mode: 'boolean' }).notNull().default(false),
    passwordHash: text('password_hash'),
    role: text('role', { enum: ['customer', 'agent', 'admin', 'service_provider'] }).notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    roleIdx: index('users_role_idx').on(t.role),
  })
);

export const profiles = sqliteTable('profiles', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  dateOfBirth: text('date_of_birth'),
  nationality: text('nationality'),
  passportNumber: text('passport_number'),
  bio: text('bio'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    lastActiveAt: text('last_active_at').notNull().default(sql`(datetime('now'))`),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
    expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
  })
);

export const otpVerifications = sqliteTable(
  'otp_verifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    purpose: text('purpose', {
      enum: ['phone_verification', 'login', 'payment_confirmation'],
    }).notNull(),
    expiresAt: text('expires_at').notNull(),
    usedAt: text('used_at'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    userPurposeIdx: index('otp_user_purpose_idx').on(t.userId, t.purpose),
  })
);

export const invites = sqliteTable(
  'invites',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    role: text('role', { enum: ['agent', 'service_provider'] }).notNull(),
    providerId: text('provider_id'),
    invitedById: text('invited_by_id').notNull().references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    acceptedAt: text('accepted_at'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    emailIdx: index('invites_email_idx').on(t.email),
    tokenIdx: uniqueIndex('invites_token_idx').on(t.tokenHash),
  })
);
