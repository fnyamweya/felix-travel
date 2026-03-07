/**
 * MFA service — enrollment, verification, and management of TOTP and SMS
 * second-factor authentication.
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { and, eq, isNull } from 'drizzle-orm';
import {
    mfaFactors,
    totpFactors,
    smsFactors,
    recoveryCodes,
} from '@felix-travel/db/schema';
import type { Logger } from '@felix-travel/telemetry';
import type { MfaMethod } from '@felix-travel/types';
import { generateTotpSecret, verifyTotp, generateTotpUri, encryptTotpSecret, decryptTotpSecret } from './totp.js';
import { generateOtp, hashOtp, verifyOtpHash } from './otp.js';
import { generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCodeHash } from './recovery-codes.js';

export interface MfaServiceDeps {
    db: DrizzleD1Database<Record<string, unknown>>;
    logger: Logger;
    generateId: () => string;
    /** 32-byte AES key for TOTP secret encryption */
    totpEncryptionKey: Uint8Array;
    /** Issuer name for TOTP URI (shown in authenticator apps) */
    totpIssuer?: string;
    /** Number of recovery codes to generate (default 10) */
    recoveryCodeCount?: number;
    /** Callback to send SMS OTP */
    sendSms?: (phone: string, message: string) => Promise<void>;
}

export interface TotpEnrollmentResult {
    factorId: string;
    secret: string;
    uri: string;
    recoveryCodes: string[];
}

export interface MfaService {
    enrollTotp(userId: string, accountName: string): Promise<TotpEnrollmentResult>;
    confirmTotpEnrollment(userId: string, code: string): Promise<boolean>;
    verifyTotpCode(userId: string, code: string): Promise<boolean>;
    enrollSms(userId: string, phoneNumber: string): Promise<{ factorId: string }>;
    sendSmsChallenge(userId: string): Promise<void>;
    verifySmsCode(userId: string, code: string): Promise<boolean>;
    verifyRecoveryCode(userId: string, code: string): Promise<boolean>;
    getEnrolledMethods(userId: string): Promise<Array<{ method: MfaMethod; isEnabled: boolean }>>;
    disableFactor(userId: string, method: MfaMethod): Promise<void>;
    regenerateRecoveryCodes(userId: string): Promise<string[]>;
}

export function createMfaService(deps: MfaServiceDeps): MfaService {
    const { db, logger, generateId, totpEncryptionKey } = deps;
    const issuer = deps.totpIssuer ?? 'Felix Travel';
    const recoveryCount = deps.recoveryCodeCount ?? 10;

    // In-memory pending TOTP enrollment store (keyed by userId).
    // In production this should be KV-backed with short TTL; for simplicity
    // we use a Map here since each Worker instance handles one request at a time.
    const pendingTotp = new Map<string, { factorId: string; secret: string }>();

    function nowIso(): string {
        return new Date().toISOString().replace('T', ' ').slice(0, 19);
    }

    // Temporary SMS OTP storage (keyed by userId). Same caveat as pendingTotp.
    const pendingSmsOtp = new Map<string, string>();

    return {
        async enrollTotp(userId, accountName) {
            const secret = generateTotpSecret();
            const uri = generateTotpUri(secret, accountName, issuer);
            const factorId = generateId();

            // Store as pending until user confirms with a valid code
            pendingTotp.set(userId, { factorId, secret });

            // Generate recovery codes
            const codes = generateRecoveryCodes(recoveryCount);

            logger.info('totp enrollment initiated', { userId });
            return { factorId, secret, uri, recoveryCodes: codes };
        },

        async confirmTotpEnrollment(userId, code) {
            const pending = pendingTotp.get(userId);
            if (!pending) return false;

            const valid = await verifyTotp(code, pending.secret);
            if (!valid) return false;

            const encryptedSecret = await encryptTotpSecret(pending.secret, totpEncryptionKey);
            const now = nowIso();

            // Persist MFA factor + TOTP extension
            await db.batch([
                db.insert(mfaFactors).values({
                    id: pending.factorId,
                    userId,
                    method: 'totp',
                    isEnabled: true,
                    enrolledAt: now,
                }),
                db.insert(totpFactors).values({
                    id: generateId(),
                    mfaFactorId: pending.factorId,
                    encryptedSecret,
                    algorithm: 'SHA1',
                    digits: 6,
                    period: 30,
                }),
            ]);

            // Persist recovery codes
            const codes = generateRecoveryCodes(recoveryCount);
            for (const code of codes) {
                const hash = await hashRecoveryCode(code);
                await db.insert(recoveryCodes).values({
                    id: generateId(),
                    userId,
                    codeHash: hash,
                    createdAt: now,
                });
            }

            pendingTotp.delete(userId);
            logger.info('totp enrollment confirmed', { userId });
            return true;
        },

        async verifyTotpCode(userId, code) {
            // Find the enabled TOTP factor
            const rows = await db
                .select({
                    factorId: mfaFactors.id,
                })
                .from(mfaFactors)
                .where(
                    and(
                        eq(mfaFactors.userId, userId),
                        eq(mfaFactors.method, 'totp'),
                        eq(mfaFactors.isEnabled, true),
                    ),
                )
                .limit(1);

            if (rows.length === 0) return false;
            const factorId = rows[0]!.factorId;

            // Get the TOTP extension
            const totpRows = await db
                .select()
                .from(totpFactors)
                .where(eq(totpFactors.mfaFactorId, factorId))
                .limit(1);

            if (totpRows.length === 0) return false;
            const totp = totpRows[0]!;

            const secret = await decryptTotpSecret(totp.encryptedSecret, totpEncryptionKey);
            const valid = await verifyTotp(code, secret, {
                algorithm: totp.algorithm,
                digits: totp.digits,
                period: totp.period,
            });

            if (valid) {
                await db
                    .update(mfaFactors)
                    .set({ lastUsedAt: nowIso() })
                    .where(eq(mfaFactors.id, factorId));
            }

            return valid;
        },

        async enrollSms(userId, phoneNumber) {
            const factorId = generateId();
            const now = nowIso();

            await db.batch([
                db.insert(mfaFactors).values({
                    id: factorId,
                    userId,
                    method: 'sms',
                    isEnabled: true,
                    enrolledAt: now,
                }),
                db.insert(smsFactors).values({
                    id: generateId(),
                    mfaFactorId: factorId,
                    phoneNumber,
                }),
            ]);

            logger.info('sms mfa enrolled', { userId });
            return { factorId };
        },

        async sendSmsChallenge(userId) {
            // Find the SMS factor phone number
            const rows = await db
                .select({
                    factorId: mfaFactors.id,
                    phoneNumber: smsFactors.phoneNumber,
                })
                .from(mfaFactors)
                .innerJoin(smsFactors, eq(smsFactors.mfaFactorId, mfaFactors.id))
                .where(
                    and(
                        eq(mfaFactors.userId, userId),
                        eq(mfaFactors.method, 'sms'),
                        eq(mfaFactors.isEnabled, true),
                    ),
                )
                .limit(1);

            if (rows.length === 0) {
                throw new Error('No active SMS MFA factor for user');
            }

            const otp = generateOtp();
            const hash = await hashOtp(otp);
            pendingSmsOtp.set(userId, hash);

            if (deps.sendSms) {
                await deps.sendSms(rows[0]!.phoneNumber, `Your Felix Travel code is ${otp}. Valid for 5 minutes.`);
            }

            logger.info('sms mfa challenge sent', { userId });
        },

        async verifySmsCode(userId, code) {
            const storedHash = pendingSmsOtp.get(userId);
            if (!storedHash) return false;

            const valid = await verifyOtpHash(code, storedHash);
            if (valid) {
                pendingSmsOtp.delete(userId);
                // Update last used
                await db
                    .update(mfaFactors)
                    .set({ lastUsedAt: nowIso() })
                    .where(
                        and(
                            eq(mfaFactors.userId, userId),
                            eq(mfaFactors.method, 'sms'),
                            eq(mfaFactors.isEnabled, true),
                        ),
                    );
            }
            return valid;
        },

        async verifyRecoveryCode(userId, code) {
            const rows = await db
                .select()
                .from(recoveryCodes)
                .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));

            for (const row of rows) {
                const match = await verifyRecoveryCodeHash(code, row.codeHash);
                if (match) {
                    await db
                        .update(recoveryCodes)
                        .set({ usedAt: nowIso() })
                        .where(eq(recoveryCodes.id, row.id));
                    logger.info('recovery code used', { userId });
                    return true;
                }
            }
            return false;
        },

        async getEnrolledMethods(userId) {
            const rows = await db
                .select({ method: mfaFactors.method, isEnabled: mfaFactors.isEnabled })
                .from(mfaFactors)
                .where(eq(mfaFactors.userId, userId));

            return rows.map((r) => ({
                method: r.method as MfaMethod,
                isEnabled: r.isEnabled,
            }));
        },

        async disableFactor(userId, method) {
            await db
                .update(mfaFactors)
                .set({ isEnabled: false })
                .where(and(eq(mfaFactors.userId, userId), eq(mfaFactors.method, method)));
            logger.info('mfa factor disabled', { userId, method });
        },

        async regenerateRecoveryCodes(userId) {
            // Delete existing unused codes
            await db.delete(recoveryCodes).where(
                and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)),
            );

            // Generate new codes
            const codes = generateRecoveryCodes(recoveryCount);
            const now = nowIso();
            for (const code of codes) {
                const hash = await hashRecoveryCode(code);
                await db.insert(recoveryCodes).values({
                    id: generateId(),
                    userId,
                    codeHash: hash,
                    createdAt: now,
                });
            }

            logger.info('recovery codes regenerated', { userId });
            return codes;
        },
    };
}
