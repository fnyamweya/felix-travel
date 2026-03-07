/**
 * Risk engine types — risk scoring, signals, events, and action decisions.
 */
import type { DateTimeString } from './common.js';

export type RiskAction = 'allow' | 'step_up_sms' | 'step_up_totp' | 'manual_review' | 'deny';

export interface RiskEvaluationInput {
    userId: string;
    sessionId: string;
    ipAddress: string;
    userAgent: string;
    /** ISO 3166-1 alpha-2 country derived from IP */
    ipCountry?: string;
    /** Autonomous System Number from IP */
    asn?: string;
    /** Device fingerprint hash */
    deviceFingerprint?: string;
    /** The action being evaluated */
    actionType: string;
    /** Role slug of the actor */
    role: string;
    /** Amount in minor currency units (for financial actions) */
    moneyAmount?: number;
    /** Provider scope if action is provider-scoped */
    providerScope?: string;
    /** Current session age in seconds */
    sessionAgeSeconds?: number;
    /** Whether the current session has elevated assurance */
    sessionAssuranceLevel?: number;
}

export interface RiskEvaluationResult {
    score: number;
    reasons: string[];
    action: RiskAction;
    evaluatedAt: DateTimeString;
}

export interface RiskEvent {
    id: string;
    userId: string;
    sessionId: string | null;
    eventType: string;
    score: number;
    action: RiskAction;
    reasons: string[];
    ipAddress: string;
    userAgent: string;
    metadata: Record<string, unknown> | null;
    createdAt: DateTimeString;
}

export interface RiskSignal {
    id: string;
    userId: string;
    signalType: string;
    /** Raw signal value (e.g. IP address, country code, failed attempt count) */
    value: string;
    expiresAt: DateTimeString;
    createdAt: DateTimeString;
}
