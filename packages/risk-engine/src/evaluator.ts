/**
 * Risk evaluator — the main entry point of the risk-engine.
 *
 * 1. Collects signals from the database
 * 2. Runs all rules against input + signals
 * 3. Caps the composite score at 100
 * 4. Converts score → action using configurable thresholds
 * 5. Persists the risk event
 * 6. Returns the result
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { RiskEvaluationInput, RiskEvaluationResult, RiskAction } from '@felix-travel/types';
import type { Logger } from '@felix-travel/telemetry';
import { riskEvents, riskSignals } from '@felix-travel/db/schema';
import { createSignalCollector } from './signals.js';
import { ALL_RULES } from './rules.js';

export interface RiskEngineConfig {
    enabled: boolean;
    stepUpSmsThreshold: number;
    stepUpTotpThreshold: number;
    manualReviewThreshold: number;
    denyThreshold: number;
}

export interface RiskEngineDeps {
    db: DrizzleD1Database<Record<string, unknown>>;
    config: RiskEngineConfig;
    logger: Logger;
    /** ID generator function (e.g. ULID) */
    generateId: () => string;
}

export interface RiskEngine {
    evaluate(input: RiskEvaluationInput): Promise<RiskEvaluationResult>;
    /** Record a risk signal for future evaluations */
    recordSignal(userId: string, signalType: string, value: string, ttlSeconds: number): Promise<void>;
    /** Record a known-device signal */
    recordKnownDevice(userId: string, deviceFingerprint: string, ttlSeconds: number): Promise<void>;
}

function scoreToAction(score: number, config: RiskEngineConfig): RiskAction {
    if (score >= config.denyThreshold) return 'deny';
    if (score >= config.manualReviewThreshold) return 'manual_review';
    if (score >= config.stepUpTotpThreshold) return 'step_up_totp';
    if (score >= config.stepUpSmsThreshold) return 'step_up_sms';
    return 'allow';
}

export function createRiskEngine(deps: RiskEngineDeps): RiskEngine {
    const { db, config, logger, generateId } = deps;
    const signalCollector = createSignalCollector(db);

    return {
        async evaluate(input: RiskEvaluationInput): Promise<RiskEvaluationResult> {
            const evaluatedAt = new Date().toISOString();

            // If the engine is disabled, always allow
            if (!config.enabled) {
                return { score: 0, reasons: [], action: 'allow', evaluatedAt };
            }

            // 1. Collect signals
            const signals = await signalCollector.collect(input);

            // 2. Run all rules
            const reasons: string[] = [];
            let rawScore = 0;

            for (const rule of ALL_RULES) {
                const result = rule.evaluate(input, signals);
                if (result.score > 0) {
                    rawScore += result.score;
                    reasons.push(result.reason);
                    logger.debug('risk rule fired', {
                        rule: rule.name,
                        score: result.score,
                        reason: result.reason,
                    });
                }
            }

            // 3. Cap at 100
            const score = Math.min(rawScore, 100);

            // 4. Convert to action
            const action = scoreToAction(score, config);

            logger.info('risk evaluation complete', {
                userId: input.userId,
                actionType: input.actionType,
                score,
                action,
                rulesFired: reasons.length,
            });

            // 5. Persist the risk event
            const eventId = generateId();
            await db.insert(riskEvents).values({
                id: eventId,
                userId: input.userId,
                sessionId: input.sessionId,
                eventType: input.actionType,
                score,
                action,
                reasons: JSON.stringify(reasons),
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
                metadata: JSON.stringify({
                    ipCountry: input.ipCountry ?? null,
                    asn: input.asn ?? null,
                    deviceFingerprint: input.deviceFingerprint ?? null,
                    moneyAmount: input.moneyAmount ?? null,
                    providerScope: input.providerScope ?? null,
                    sessionAgeSeconds: input.sessionAgeSeconds ?? null,
                    sessionAssuranceLevel: input.sessionAssuranceLevel ?? null,
                    rawScore,
                }),
                createdAt: evaluatedAt.replace('T', ' ').slice(0, 19),
            });

            // 6. Return
            return { score, reasons, action, evaluatedAt };
        },

        async recordSignal(userId: string, signalType: string, value: string, ttlSeconds: number): Promise<void> {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
            await db.insert(riskSignals).values({
                id: generateId(),
                userId,
                signalType,
                value,
                expiresAt: expiresAt.toISOString().replace('T', ' ').slice(0, 19),
                createdAt: now.toISOString().replace('T', ' ').slice(0, 19),
            });
        },

        async recordKnownDevice(userId: string, deviceFingerprint: string, ttlSeconds: number): Promise<void> {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
            await db.insert(riskSignals).values({
                id: generateId(),
                userId,
                signalType: 'known_device',
                value: deviceFingerprint,
                expiresAt: expiresAt.toISOString().replace('T', ' ').slice(0, 19),
                createdAt: now.toISOString().replace('T', ' ').slice(0, 19),
            });
        },
    };
}
