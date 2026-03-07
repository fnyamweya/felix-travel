/**
 * Step-up challenge service — creates and verifies additional authentication
 * challenges for sensitive actions when the risk engine demands elevated
 * assurance (step_up_sms or step_up_totp).
 *
 * Flow:
 * 1. Action triggers risk evaluation → result.action is "step_up_*"
 * 2. createChallenge() stores the action context + OTP/TOTP expectation
 * 3. User completes the challenge
 * 4. completeChallenge() verifies, records assurance elevation, returns original context
 * 5. The original action is retried with elevated assurance level
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { stepUpChallenges, sessionAssuranceEvents } from '@felix-travel/db/schema';
import type { Logger } from '@felix-travel/telemetry';
import type { StepUpMethod } from '@felix-travel/types';
import { generateOtp, hashOtp, verifyOtpHash } from './otp.js';
import { verifyTotp, decryptTotpSecret } from './totp.js';
import { mfaFactors, totpFactors, smsFactors } from '@felix-travel/db/schema';

export interface StepUpServiceDeps {
    db: DrizzleD1Database<Record<string, unknown>>;
    logger: Logger;
    generateId: () => string;
    /** TTL for step-up challenges in minutes (default 10) */
    challengeTtlMinutes?: number;
    /** 32-byte AES key for TOTP secret decryption */
    totpEncryptionKey: Uint8Array;
    /** Callback to send SMS OTP */
    sendSms?: (phone: string, message: string) => Promise<void>;
}

export interface StepUpChallengeResult {
    challengeId: string;
    method: StepUpMethod;
}

export interface StepUpService {
    createChallenge(
        userId: string,
        sessionId: string,
        method: StepUpMethod,
        actionType: string,
        actionContext: Record<string, unknown>,
    ): Promise<StepUpChallengeResult>;

    completeChallenge(
        challengeId: string,
        userId: string,
        code: string,
    ): Promise<{ success: boolean; actionContext: Record<string, unknown> | null; newAssuranceLevel: number }>;

    cleanupExpired(): Promise<number>;
}

export function createStepUpService(deps: StepUpServiceDeps): StepUpService {
    const { db, logger, generateId, totpEncryptionKey } = deps;
    const ttlMs = (deps.challengeTtlMinutes ?? 10) * 60 * 1000;

    function nowIso(): string {
        return new Date().toISOString().replace('T', ' ').slice(0, 19);
    }

    function expiresIso(): string {
        return new Date(Date.now() + ttlMs).toISOString().replace('T', ' ').slice(0, 19);
    }

    return {
        async createChallenge(userId, sessionId, method, actionType, actionContext) {
            const challengeId = generateId();
            const now = nowIso();

            if (method === 'sms_otp') {
                // Generate and send SMS OTP
                const otp = generateOtp();
                const hash = await hashOtp(otp);

                // Find the user's SMS factor phone number
                const smsRows = await db
                    .select({ phoneNumber: smsFactors.phoneNumber })
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

                if (smsRows.length === 0) {
                    throw new Error('No active SMS MFA factor for step-up');
                }

                await db.insert(stepUpChallenges).values({
                    id: challengeId,
                    sessionId,
                    userId,
                    method,
                    actionType,
                    actionContext: JSON.stringify(actionContext),
                    secretHash: hash,
                    expiresAt: expiresIso(),
                    createdAt: now,
                });

                if (deps.sendSms) {
                    await deps.sendSms(
                        smsRows[0]!.phoneNumber,
                        `Your Felix Travel step-up code is ${otp}. Valid for ${deps.challengeTtlMinutes ?? 10} minutes.`,
                    );
                }
            } else {
                // TOTP — no secret to store, verification uses the enrolled TOTP factor
                await db.insert(stepUpChallenges).values({
                    id: challengeId,
                    sessionId,
                    userId,
                    method,
                    actionType,
                    actionContext: JSON.stringify(actionContext),
                    secretHash: '', // TOTP uses the enrolled factor's secret
                    expiresAt: expiresIso(),
                    createdAt: now,
                });
            }

            logger.info('step-up challenge created', { userId, method, actionType });
            return { challengeId, method };
        },

        async completeChallenge(challengeId, userId, code) {
            const now = nowIso();
            const FAIL = { success: false, actionContext: null, newAssuranceLevel: 0 };

            const rows = await db
                .select()
                .from(stepUpChallenges)
                .where(
                    and(
                        eq(stepUpChallenges.id, challengeId),
                        eq(stepUpChallenges.userId, userId),
                        isNull(stepUpChallenges.completedAt),
                    ),
                )
                .limit(1);

            if (rows.length === 0) return FAIL;
            const challenge = rows[0]!;

            if (challenge.expiresAt < now) {
                logger.warn('step-up challenge expired', { challengeId, userId });
                return FAIL;
            }

            let verified = false;

            if (challenge.method === 'sms_otp') {
                verified = await verifyOtpHash(code, challenge.secretHash);
            } else {
                // TOTP — verify against enrolled factor
                const factorRows = await db
                    .select({ mfaFactorId: totpFactors.mfaFactorId, encryptedSecret: totpFactors.encryptedSecret, algorithm: totpFactors.algorithm, digits: totpFactors.digits, period: totpFactors.period })
                    .from(mfaFactors)
                    .innerJoin(totpFactors, eq(totpFactors.mfaFactorId, mfaFactors.id))
                    .where(
                        and(
                            eq(mfaFactors.userId, userId),
                            eq(mfaFactors.method, 'totp'),
                            eq(mfaFactors.isEnabled, true),
                        ),
                    )
                    .limit(1);

                if (factorRows.length === 0) return FAIL;
                const factor = factorRows[0]!;
                const secret = await decryptTotpSecret(factor.encryptedSecret, totpEncryptionKey);
                verified = await verifyTotp(code, secret, {
                    algorithm: factor.algorithm,
                    digits: factor.digits,
                    period: factor.period,
                });
            }

            if (!verified) {
                logger.warn('step-up challenge failed', { challengeId, userId });
                return FAIL;
            }

            // Mark challenge as completed
            await db
                .update(stepUpChallenges)
                .set({ completedAt: now })
                .where(eq(stepUpChallenges.id, challengeId));

            // Record assurance elevation
            const newAssuranceLevel = challenge.method === 'totp' ? 2 : 1;
            await db.insert(sessionAssuranceEvents).values({
                id: generateId(),
                sessionId: challenge.sessionId,
                userId,
                event: challenge.method === 'totp' ? 'totp_verified' : 'sms_otp_verified',
                assuranceLevel: newAssuranceLevel,
                createdAt: now,
            });

            logger.info('step-up challenge completed', {
                challengeId,
                userId,
                method: challenge.method,
                newAssuranceLevel,
            });

            let actionContext: Record<string, unknown> | null = null;
            try {
                actionContext = JSON.parse(challenge.actionContext) as Record<string, unknown>;
            } catch {
                // corrupted context
            }

            return { success: true, actionContext, newAssuranceLevel };
        },

        async cleanupExpired() {
            const now = nowIso();
            const result = await db
                .delete(stepUpChallenges)
                .where(lt(stepUpChallenges.expiresAt, now));
            return result.meta.changes ?? 0;
        },
    };
}
