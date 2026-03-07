/**
 * Identity service — CRUD for user identities (email and phone),
 * including verification challenge creation and redemption.
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { and, eq, isNull, lt } from 'drizzle-orm';
import {
    userIdentities,
    emailAddresses,
    phoneNumbers,
    verificationChallenges,
} from '@felix-travel/db/schema';
import type { Logger } from '@felix-travel/telemetry';
import type { VerificationPurpose } from '@felix-travel/types';
import { normalizeEmail, normalizePhone } from './normalize.js';
import { generateOtp, hashOtp, verifyOtpHash } from './otp.js';

export interface IdentityServiceDeps {
    db: DrizzleD1Database<Record<string, unknown>>;
    logger: Logger;
    generateId: () => string;
    /** Default country code for phone normalization, e.g. "KE" */
    defaultCountryCode?: string;
    /** Challenge TTL in minutes (default 15) */
    challengeTtlMinutes?: number;
    /** Callback to send OTP via SMS */
    sendSms?: (phone: string, message: string) => Promise<void>;
    /** Callback to send OTP via email */
    sendEmail?: (email: string, subject: string, body: string) => Promise<void>;
}

export interface IdentityService {
    addEmail(userId: string, email: string, isPrimary: boolean): Promise<{ id: string; normalizedEmail: string }>;
    addPhone(userId: string, phone: string, isPrimary: boolean): Promise<{ id: string; normalizedPhone: string }>;
    sendVerification(userId: string, identifier: string, purpose: VerificationPurpose): Promise<void>;
    verifyChallenge(userId: string, purpose: VerificationPurpose, code: string): Promise<boolean>;
    getIdentities(userId: string): Promise<Array<{ type: string; identifier: string; isPrimary: boolean; verified: boolean }>>;
    removeIdentity(userId: string, identityId: string): Promise<void>;
    cleanupExpiredChallenges(): Promise<number>;
}

export function createIdentityService(deps: IdentityServiceDeps): IdentityService {
    const { db, logger, generateId } = deps;
    const defaultCountryCode = deps.defaultCountryCode ?? 'KE';
    const challengeTtl = (deps.challengeTtlMinutes ?? 15) * 60 * 1000;

    function nowIso(): string {
        return new Date().toISOString().replace('T', ' ').slice(0, 19);
    }

    function expiresIso(): string {
        return new Date(Date.now() + challengeTtl).toISOString().replace('T', ' ').slice(0, 19);
    }

    return {
        async addEmail(userId, email, isPrimary) {
            const normalized = normalizeEmail(email);
            const id = generateId();
            const now = nowIso();

            await db.batch([
                db.insert(emailAddresses).values({
                    id,
                    userId,
                    email: normalized,
                    isPrimary,
                    createdAt: now,
                }),
                db.insert(userIdentities).values({
                    id: generateId(),
                    userId,
                    type: 'email',
                    identifier: normalized,
                    isPrimary,
                    createdAt: now,
                }),
            ]);

            logger.info('email identity added', { userId, isPrimary });
            return { id, normalizedEmail: normalized };
        },

        async addPhone(userId, phone, isPrimary) {
            const normalized = normalizePhone(phone, defaultCountryCode);
            const id = generateId();
            const now = nowIso();

            await db.batch([
                db.insert(phoneNumbers).values({
                    id,
                    userId,
                    phone: normalized,
                    isPrimary,
                    createdAt: now,
                }),
                db.insert(userIdentities).values({
                    id: generateId(),
                    userId,
                    type: 'phone',
                    identifier: normalized,
                    isPrimary,
                    createdAt: now,
                }),
            ]);

            logger.info('phone identity added', { userId, isPrimary });
            return { id, normalizedPhone: normalized };
        },

        async sendVerification(userId, identifier, purpose) {
            const otp = generateOtp();
            const hash = await hashOtp(otp);
            const id = generateId();

            await db.insert(verificationChallenges).values({
                id,
                userId,
                purpose,
                secretHash: hash,
                expiresAt: expiresIso(),
                createdAt: nowIso(),
            });

            // Determine delivery channel by purpose
            if (
                (purpose === 'phone_verify' || purpose === 'login_otp') &&
                deps.sendSms
            ) {
                await deps.sendSms(identifier, `Your Felix Travel code is ${otp}. It expires in ${deps.challengeTtlMinutes ?? 15} minutes.`);
            } else if (
                (purpose === 'email_verify' || purpose === 'password_reset') &&
                deps.sendEmail
            ) {
                await deps.sendEmail(
                    identifier,
                    'Felix Travel Verification Code',
                    `Your verification code is ${otp}. It expires in ${deps.challengeTtlMinutes ?? 15} minutes.`,
                );
            }

            logger.info('verification challenge sent', { userId, purpose });
        },

        async verifyChallenge(userId, purpose, code) {
            const now = nowIso();

            // Find the latest unused, non-expired challenge for this user+purpose
            const rows = await db
                .select()
                .from(verificationChallenges)
                .where(
                    and(
                        eq(verificationChallenges.userId, userId),
                        eq(verificationChallenges.purpose, purpose),
                        isNull(verificationChallenges.usedAt),
                    ),
                )
                .orderBy(verificationChallenges.createdAt)
                .limit(5);

            for (const row of rows) {
                if (row.expiresAt < now) continue; // expired
                const match = await verifyOtpHash(code, row.secretHash);
                if (match) {
                    // Mark as used
                    await db
                        .update(verificationChallenges)
                        .set({ usedAt: now })
                        .where(eq(verificationChallenges.id, row.id));

                    // If this was an email or phone verification, mark the identity as verified
                    if (purpose === 'email_verify' || purpose === 'phone_verify') {
                        await db
                            .update(userIdentities)
                            .set({ verifiedAt: now })
                            .where(
                                and(
                                    eq(userIdentities.userId, userId),
                                    eq(userIdentities.type, purpose === 'email_verify' ? 'email' : 'phone'),
                                    isNull(userIdentities.verifiedAt),
                                ),
                            );

                        if (purpose === 'email_verify') {
                            await db
                                .update(emailAddresses)
                                .set({ verifiedAt: now })
                                .where(and(eq(emailAddresses.userId, userId), isNull(emailAddresses.verifiedAt)));
                        } else {
                            await db
                                .update(phoneNumbers)
                                .set({ verifiedAt: now })
                                .where(and(eq(phoneNumbers.userId, userId), isNull(phoneNumbers.verifiedAt)));
                        }
                    }

                    logger.info('verification challenge redeemed', { userId, purpose });
                    return true;
                }
            }

            logger.warn('verification challenge failed', { userId, purpose });
            return false;
        },

        async getIdentities(userId) {
            const rows = await db
                .select({
                    type: userIdentities.type,
                    identifier: userIdentities.identifier,
                    isPrimary: userIdentities.isPrimary,
                    verifiedAt: userIdentities.verifiedAt,
                })
                .from(userIdentities)
                .where(eq(userIdentities.userId, userId));

            return rows.map((r) => ({
                type: r.type,
                identifier: r.identifier,
                isPrimary: r.isPrimary,
                verified: r.verifiedAt !== null,
            }));
        },

        async removeIdentity(userId, identityId) {
            await db
                .delete(userIdentities)
                .where(and(eq(userIdentities.id, identityId), eq(userIdentities.userId, userId)));
            logger.info('identity removed', { userId, identityId });
        },

        async cleanupExpiredChallenges() {
            const now = nowIso();
            const result = await db
                .delete(verificationChallenges)
                .where(lt(verificationChallenges.expiresAt, now));
            const count = result.meta.changes ?? 0;
            if (count > 0) {
                logger.info('cleaned up expired challenges', { count });
            }
            return count;
        },
    };
}
