/**
 * Risk rules — each rule inspects the evaluation input + collected signals
 * and returns a numeric score contribution with a reason string.
 *
 * Rules are intentionally simple, pure functions with no I/O so they are
 * fast and fully testable. Heavy lifting (signal collection) happens before
 * the rules run.
 */
import type { RiskEvaluationInput } from '@felix-travel/types';
import { PRIVILEGED_ROLES } from '@felix-travel/types';
import type { CollectedSignals } from './signals.js';

export interface RiskRuleResult {
    /** Points to add to the composite score (0 = no risk) */
    score: number;
    /** Human-readable reason string (empty when score is 0) */
    reason: string;
}

export interface RiskRule {
    /** Unique identifier for logging/metrics */
    name: string;
    /** Pure function producing a score contribution */
    evaluate(input: RiskEvaluationInput, signals: CollectedSignals): RiskRuleResult;
}

const ZERO: RiskRuleResult = { score: 0, reason: '' };

// ──────────────────────────────────────────────
// Device rules
// ──────────────────────────────────────────────

const newDevice: RiskRule = {
    name: 'new_device',
    evaluate(_input, signals) {
        if (signals.isNewDevice) {
            return { score: 15, reason: 'Login from unrecognized device' };
        }
        return ZERO;
    },
};

// ──────────────────────────────────────────────
// Geo / network rules
// ──────────────────────────────────────────────

const impossibleTravel: RiskRule = {
    name: 'impossible_travel',
    evaluate(input, signals) {
        if (
            signals.previousIpCountry &&
            input.ipCountry &&
            signals.previousIpCountry !== input.ipCountry
        ) {
            return { score: 25, reason: `IP country changed from ${signals.previousIpCountry} to ${input.ipCountry}` };
        }
        return ZERO;
    },
};

const asnChange: RiskRule = {
    name: 'asn_change',
    evaluate(input, signals) {
        if (signals.previousAsn && input.asn && signals.previousAsn !== input.asn) {
            return { score: 10, reason: `ASN changed from ${signals.previousAsn} to ${input.asn}` };
        }
        return ZERO;
    },
};

// ──────────────────────────────────────────────
// Velocity / brute-force rules
// ──────────────────────────────────────────────

const failedLoginVelocity: RiskRule = {
    name: 'failed_login_velocity',
    evaluate(_input, signals) {
        if (signals.failedLoginCount >= 5) {
            return { score: 30, reason: `${signals.failedLoginCount} failed login attempts in 24h` };
        }
        if (signals.failedLoginCount >= 3) {
            return { score: 15, reason: `${signals.failedLoginCount} failed login attempts in 24h` };
        }
        return ZERO;
    },
};

const failedOtpVelocity: RiskRule = {
    name: 'failed_otp_velocity',
    evaluate(_input, signals) {
        if (signals.failedOtpCount >= 3) {
            return { score: 35, reason: `${signals.failedOtpCount} failed OTP attempts in 15m` };
        }
        if (signals.failedOtpCount >= 2) {
            return { score: 15, reason: `${signals.failedOtpCount} failed OTP attempts in 15m` };
        }
        return ZERO;
    },
};

// ──────────────────────────────────────────────
// Role-sensitivity rules
// ──────────────────────────────────────────────

const privilegedRole: RiskRule = {
    name: 'privileged_role',
    evaluate(input) {
        if (PRIVILEGED_ROLES.has(input.role)) {
            return { score: 10, reason: `Privileged role: ${input.role}` };
        }
        return ZERO;
    },
};

// ──────────────────────────────────────────────
// Financial rules
// ──────────────────────────────────────────────

/** Thresholds in minor currency units (cents) */
const HIGH_VALUE_THRESHOLD = 100_000_00; // 100,000 KES
const MEDIUM_VALUE_THRESHOLD = 10_000_00; // 10,000 KES

const highValueTransaction: RiskRule = {
    name: 'high_value_transaction',
    evaluate(input) {
        if (input.moneyAmount != null && input.moneyAmount >= HIGH_VALUE_THRESHOLD) {
            return { score: 20, reason: `High-value transaction: ${input.moneyAmount} minor units` };
        }
        if (input.moneyAmount != null && input.moneyAmount >= MEDIUM_VALUE_THRESHOLD) {
            return { score: 10, reason: `Medium-value transaction: ${input.moneyAmount} minor units` };
        }
        return ZERO;
    },
};

// ──────────────────────────────────────────────
// Account-change recency rules
// ──────────────────────────────────────────────

const recentAccountChange: RiskRule = {
    name: 'recent_account_change',
    evaluate(_input, signals) {
        if (signals.recentAccountChanges >= 3) {
            return { score: 25, reason: `${signals.recentAccountChanges} account changes in 24h` };
        }
        if (signals.recentAccountChanges >= 1) {
            return { score: 10, reason: `${signals.recentAccountChanges} account change(s) in 24h` };
        }
        return ZERO;
    },
};

// ──────────────────────────────────────────────
// Session rules
// ──────────────────────────────────────────────

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

const staleSession: RiskRule = {
    name: 'stale_session',
    evaluate(input) {
        if (
            input.sessionAgeSeconds != null &&
            input.sessionAgeSeconds > SESSION_MAX_AGE_SECONDS
        ) {
            return { score: 15, reason: `Session age ${Math.round(input.sessionAgeSeconds / 3600)}h exceeds threshold` };
        }
        return ZERO;
    },
};

const lowAssuranceForSensitive: RiskRule = {
    name: 'low_assurance_for_sensitive',
    evaluate(input) {
        const sensitiveActions = new Set([
            'payout.create',
            'payout.approve',
            'refund.approve',
            'user.role.assign',
            'policy.update',
        ]);
        if (
            sensitiveActions.has(input.actionType) &&
            (input.sessionAssuranceLevel ?? 0) < 2
        ) {
            return { score: 20, reason: `Sensitive action "${input.actionType}" at assurance level ${input.sessionAssuranceLevel ?? 0}` };
        }
        return ZERO;
    },
};

// ──────────────────────────────────────────────
// Prior risk history rules
// ──────────────────────────────────────────────

const recentHighRisk: RiskRule = {
    name: 'recent_high_risk',
    evaluate(_input, signals) {
        if (signals.recentHighRiskEvents >= 2) {
            return { score: 20, reason: `${signals.recentHighRiskEvents} high-risk events in 24h` };
        }
        if (signals.recentHighRiskEvents >= 1) {
            return { score: 10, reason: 'Recent high-risk event in 24h' };
        }
        return ZERO;
    },
};

const firstTimeUser: RiskRule = {
    name: 'first_time_user',
    evaluate(_input, signals) {
        if (!signals.hasPriorActivity) {
            return { score: 5, reason: 'First-time activity for this user' };
        }
        return ZERO;
    },
};

// ──────────────────────────────────────────────
// Provider boundary crossing
// ──────────────────────────────────────────────

const providerBoundaryCrossing: RiskRule = {
    name: 'provider_boundary_crossing',
    evaluate(input) {
        // A provider-scoped role acting outside their assigned scope
        const providerRoles = new Set([
            'service_provider',
            'provider_owner',
            'provider_manager',
            'provider_finance',
            'provider_ops',
            'provider_inventory_manager',
        ]);
        if (providerRoles.has(input.role) && !input.providerScope) {
            return { score: 30, reason: 'Provider-scoped role acting without provider scope' };
        }
        return ZERO;
    },
};

// ──────────────────────────────────────────────
// Export
// ──────────────────────────────────────────────

export const ALL_RULES: readonly RiskRule[] = [
    newDevice,
    impossibleTravel,
    asnChange,
    failedLoginVelocity,
    failedOtpVelocity,
    privilegedRole,
    highValueTransaction,
    recentAccountChange,
    staleSession,
    lowAssuranceForSensitive,
    recentHighRisk,
    firstTimeUser,
    providerBoundaryCrossing,
];
