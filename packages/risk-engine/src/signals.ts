/**
 * Signal collection — reads ephemeral risk signals and aggregated facts from
 * the database to feed into the rule evaluator.
 *
 * Signals include:
 *   - Recent failed login count
 *   - Recent failed OTP count
 *   - Known device / new device flag
 *   - Last-seen IP country vs. current country
 *   - Last-seen ASN vs. current ASN
 *   - Session age
 *   - Recent account-level changes (email, phone, password)
 *   - Recent high-value transaction count
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { and, eq, gt, sql, count as drizzleCount } from 'drizzle-orm';
import { riskSignals, riskEvents } from '@felix-travel/db/schema';
import type { RiskEvaluationInput } from '@felix-travel/types';

export interface CollectedSignals {
    failedLoginCount: number;
    failedOtpCount: number;
    isNewDevice: boolean;
    /** Previous IP country from most recent risk event, or null if first time */
    previousIpCountry: string | null;
    /** Previous ASN from most recent risk event */
    previousAsn: string | null;
    /** Number of recent account-change events (email/phone/password change) */
    recentAccountChanges: number;
    /** Number of manual_review or deny actions in last 24h */
    recentHighRiskEvents: number;
    /** Whether user has any prior risk events at all (first-time user) */
    hasPriorActivity: boolean;
}

export interface SignalCollector {
    collect(input: RiskEvaluationInput): Promise<CollectedSignals>;
}

const SIGNAL_WINDOW_ISO = () => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return d.toISOString().replace('T', ' ').slice(0, 19);
};

const OTP_WINDOW_ISO = () => {
    const d = new Date(Date.now() - 15 * 60 * 1000);
    return d.toISOString().replace('T', ' ').slice(0, 19);
};

export function createSignalCollector(db: DrizzleD1Database<Record<string, unknown>>): SignalCollector {
    return { collect: (input) => collectSignals(db, input) };
}

export async function collectSignals(
    db: DrizzleD1Database<Record<string, unknown>>,
    input: RiskEvaluationInput,
): Promise<CollectedSignals> {
    const now24h = SIGNAL_WINDOW_ISO();
    const now15m = OTP_WINDOW_ISO();

    // Run all queries in parallel
    const [
        failedLoginRows,
        failedOtpRows,
        deviceRows,
        lastEventRows,
        accountChangeRows,
        highRiskRows,
    ] = await Promise.all([
        // Failed logins in last 24h
        db
            .select({ cnt: drizzleCount() })
            .from(riskSignals)
            .where(
                and(
                    eq(riskSignals.userId, input.userId),
                    eq(riskSignals.signalType, 'failed_login'),
                    gt(riskSignals.createdAt, now24h),
                ),
            ),

        // Failed OTPs in last 15 minutes
        db
            .select({ cnt: drizzleCount() })
            .from(riskSignals)
            .where(
                and(
                    eq(riskSignals.userId, input.userId),
                    eq(riskSignals.signalType, 'failed_otp'),
                    gt(riskSignals.createdAt, now15m),
                ),
            ),

        // Check whether the device fingerprint is known
        input.deviceFingerprint
            ? db
                .select({ cnt: drizzleCount() })
                .from(riskSignals)
                .where(
                    and(
                        eq(riskSignals.userId, input.userId),
                        eq(riskSignals.signalType, 'known_device'),
                        eq(riskSignals.value, input.deviceFingerprint),
                    ),
                )
            : Promise.resolve([{ cnt: 0 }]),

        // Most recent risk event for IP-country / ASN comparison
        db
            .select({
                metadata: riskEvents.metadata,
            })
            .from(riskEvents)
            .where(eq(riskEvents.userId, input.userId))
            .orderBy(sql`${riskEvents.createdAt} desc`)
            .limit(1),

        // Account-change signals in last 24h
        db
            .select({ cnt: drizzleCount() })
            .from(riskSignals)
            .where(
                and(
                    eq(riskSignals.userId, input.userId),
                    eq(riskSignals.signalType, 'account_change'),
                    gt(riskSignals.createdAt, now24h),
                ),
            ),

        // High-risk events in last 24h
        db
            .select({ cnt: drizzleCount() })
            .from(riskEvents)
            .where(
                and(
                    eq(riskEvents.userId, input.userId),
                    sql`${riskEvents.action} in ('manual_review', 'deny')`,
                    gt(riskEvents.createdAt, now24h),
                ),
            ),
    ]);

    // Parse the last event's metadata for previous IP/ASN
    let previousIpCountry: string | null = null;
    let previousAsn: string | null = null;
    const hasPriorActivity = lastEventRows.length > 0;

    if (hasPriorActivity && lastEventRows[0]?.metadata) {
        try {
            const meta = JSON.parse(lastEventRows[0].metadata) as Record<string, unknown>;
            if (typeof meta.ipCountry === 'string') previousIpCountry = meta.ipCountry;
            if (typeof meta.asn === 'string') previousAsn = meta.asn;
        } catch {
            // corrupted metadata — ignore
        }
    }

    return {
        failedLoginCount: failedLoginRows[0]?.cnt ?? 0,
        failedOtpCount: failedOtpRows[0]?.cnt ?? 0,
        isNewDevice: input.deviceFingerprint ? (deviceRows[0]?.cnt ?? 0) === 0 : true,
        previousIpCountry,
        previousAsn,
        recentAccountChanges: accountChangeRows[0]?.cnt ?? 0,
        recentHighRiskEvents: highRiskRows[0]?.cnt ?? 0,
        hasPriorActivity,
    };
}
