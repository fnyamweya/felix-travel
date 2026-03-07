/**
 * Identity schema — first-class email/phone identities, MFA, trusted devices, step-up.
 *
 * Design rationale:
 * - user_identities is the root table linking users to their verifiable identifiers
 * - email_addresses and phone_numbers store normalized values with verification state
 * - verification_challenges are single-use, time-limited, and bound to action context
 * - mfa_factors is the base table; totp and sms factors extend it
 * - trusted_devices associate device fingerprints with users for risk reduction
 * - step_up_challenges gate sensitive actions behind fresh authentication
 * - session_assurance_events track when a session's trust level was elevated
 */
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const userIdentities = sqliteTable(
    'user_identities',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        type: text('type', { enum: ['email', 'phone'] }).notNull(),
        /** Normalized: email lowercase, phone E.164 */
        identifier: text('identifier').notNull(),
        isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
        verifiedAt: text('verified_at'),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        /** Each identifier must be globally unique per type to prevent account hijacking */
        uniqueIdentifier: uniqueIndex('uq_user_identities_type_identifier').on(table.type, table.identifier),
        userIdx: index('idx_user_identities_user_id').on(table.userId),
    })
);

export const emailAddresses = sqliteTable(
    'email_addresses',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        email: text('email').notNull(),
        isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
        verifiedAt: text('verified_at'),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        uniqueEmail: uniqueIndex('uq_email_addresses_email').on(table.email),
        userIdx: index('idx_email_addresses_user_id').on(table.userId),
    })
);

export const phoneNumbers = sqliteTable(
    'phone_numbers',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** E.164 format mandatory for consistent lookup */
        phone: text('phone').notNull(),
        isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
        verifiedAt: text('verified_at'),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        uniquePhone: uniqueIndex('uq_phone_numbers_phone').on(table.phone),
        userIdx: index('idx_phone_numbers_user_id').on(table.userId),
    })
);

export const verificationChallenges = sqliteTable(
    'verification_challenges',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        purpose: text('purpose', {
            enum: ['email_verify', 'phone_verify', 'login_otp', 'step_up', 'password_reset', 'mfa_recovery'],
        }).notNull(),
        /** SHA-256 hash of the OTP or token — never store plaintext */
        secretHash: text('secret_hash').notNull(),
        /** JSON context binding this challenge to a specific action (step-up) */
        actionContext: text('action_context'),
        expiresAt: text('expires_at').notNull(),
        usedAt: text('used_at'),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        userPurposeIdx: index('idx_verification_challenges_user_purpose').on(table.userId, table.purpose),
        expiresIdx: index('idx_verification_challenges_expires').on(table.expiresAt),
    })
);

export const mfaFactors = sqliteTable(
    'mfa_factors',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        method: text('method', { enum: ['totp', 'sms'] }).notNull(),
        isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
        enrolledAt: text('enrolled_at').notNull().default('(datetime())'),
        lastUsedAt: text('last_used_at'),
    },
    (table) => ({
        userMethodIdx: uniqueIndex('uq_mfa_factors_user_method').on(table.userId, table.method),
    })
);

export const totpFactors = sqliteTable('totp_factors', {
    id: text('id').primaryKey(),
    mfaFactorId: text('mfa_factor_id')
        .notNull()
        .references(() => mfaFactors.id, { onDelete: 'cascade' }),
    /** AES-256 encrypted TOTP secret — decrypted only during verification */
    encryptedSecret: text('encrypted_secret').notNull(),
    algorithm: text('algorithm').notNull().default('SHA1'),
    digits: integer('digits').notNull().default(6),
    period: integer('period').notNull().default(30),
});

export const smsFactors = sqliteTable('sms_factors', {
    id: text('id').primaryKey(),
    mfaFactorId: text('mfa_factor_id')
        .notNull()
        .references(() => mfaFactors.id, { onDelete: 'cascade' }),
    /** E.164 phone number used for OTP delivery */
    phoneNumber: text('phone_number').notNull(),
});

export const recoveryCodes = sqliteTable(
    'recovery_codes',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        codeHash: text('code_hash').notNull(),
        usedAt: text('used_at'),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        userIdx: index('idx_recovery_codes_user_id').on(table.userId),
    })
);

export const trustedDevices = sqliteTable(
    'trusted_devices',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** SHA-256 of fingerprint components (user agent + screen + timezone + etc.) */
        fingerprintHash: text('fingerprint_hash').notNull(),
        deviceName: text('device_name').notNull(),
        lastSeenAt: text('last_seen_at').notNull(),
        expiresAt: text('expires_at').notNull(),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        userFingerprintIdx: uniqueIndex('uq_trusted_devices_user_fingerprint').on(
            table.userId,
            table.fingerprintHash
        ),
        expiresIdx: index('idx_trusted_devices_expires').on(table.expiresAt),
    })
);

export const stepUpChallenges = sqliteTable(
    'step_up_challenges',
    {
        id: text('id').primaryKey(),
        sessionId: text('session_id').notNull(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        method: text('method', { enum: ['totp', 'sms_otp'] }).notNull(),
        /** The action type that triggered step-up, e.g. "payout.approve" */
        actionType: text('action_type').notNull(),
        /** JSON of the original action request for resumption after step-up */
        actionContext: text('action_context').notNull(),
        secretHash: text('secret_hash').notNull(),
        expiresAt: text('expires_at').notNull(),
        completedAt: text('completed_at'),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        sessionIdx: index('idx_step_up_session').on(table.sessionId),
        expiresIdx: index('idx_step_up_expires').on(table.expiresAt),
    })
);

export const sessionAssuranceEvents = sqliteTable(
    'session_assurance_events',
    {
        id: text('id').primaryKey(),
        sessionId: text('session_id').notNull(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /** Event that raised assurance, e.g. "totp_verified", "sms_otp_verified" */
        event: text('event').notNull(),
        assuranceLevel: integer('assurance_level').notNull(),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        sessionIdx: index('idx_session_assurance_session').on(table.sessionId),
    })
);
