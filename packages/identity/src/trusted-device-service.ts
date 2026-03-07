/**
 * Trusted device service — manages trusted device registrations to reduce
 * friction for returning users on known devices.
 *
 * When a device is trusted, subsequent risk evaluations from that device
 * receive a lower score (via the "new_device" rule returning 0).
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { and, eq, lt } from 'drizzle-orm';
import { trustedDevices } from '@felix-travel/db/schema';
import type { Logger } from '@felix-travel/telemetry';

export interface TrustedDeviceServiceDeps {
    db: DrizzleD1Database<Record<string, unknown>>;
    logger: Logger;
    generateId: () => string;
    /** Default TTL in days for trusted device entries (default 90) */
    ttlDays?: number;
}

export interface TrustedDeviceService {
    trust(userId: string, fingerprintHash: string, deviceName: string): Promise<{ id: string }>;
    isTrusted(userId: string, fingerprintHash: string): Promise<boolean>;
    updateLastSeen(userId: string, fingerprintHash: string): Promise<void>;
    revoke(userId: string, deviceId: string): Promise<void>;
    revokeAll(userId: string): Promise<number>;
    listDevices(userId: string): Promise<Array<{ id: string; deviceName: string; lastSeenAt: string; expiresAt: string }>>;
    cleanupExpired(): Promise<number>;
}

export function createTrustedDeviceService(deps: TrustedDeviceServiceDeps): TrustedDeviceService {
    const { db, logger, generateId } = deps;
    const ttlMs = (deps.ttlDays ?? 90) * 24 * 60 * 60 * 1000;

    function nowIso(): string {
        return new Date().toISOString().replace('T', ' ').slice(0, 19);
    }

    function expiresIso(): string {
        return new Date(Date.now() + ttlMs).toISOString().replace('T', ' ').slice(0, 19);
    }

    return {
        async trust(userId, fingerprintHash, deviceName) {
            const id = generateId();
            const now = nowIso();

            // Upsert: if device already exists for this user, update it
            const existing = await db
                .select({ id: trustedDevices.id })
                .from(trustedDevices)
                .where(
                    and(
                        eq(trustedDevices.userId, userId),
                        eq(trustedDevices.fingerprintHash, fingerprintHash),
                    ),
                )
                .limit(1);

            if (existing.length > 0) {
                await db
                    .update(trustedDevices)
                    .set({
                        deviceName,
                        lastSeenAt: now,
                        expiresAt: expiresIso(),
                    })
                    .where(eq(trustedDevices.id, existing[0]!.id));
                logger.info('trusted device updated', { userId });
                return { id: existing[0]!.id };
            }

            await db.insert(trustedDevices).values({
                id,
                userId,
                fingerprintHash,
                deviceName,
                lastSeenAt: now,
                expiresAt: expiresIso(),
                createdAt: now,
            });

            logger.info('device trusted', { userId, deviceName });
            return { id };
        },

        async isTrusted(userId, fingerprintHash) {
            const now = nowIso();
            const rows = await db
                .select({ id: trustedDevices.id })
                .from(trustedDevices)
                .where(
                    and(
                        eq(trustedDevices.userId, userId),
                        eq(trustedDevices.fingerprintHash, fingerprintHash),
                    ),
                )
                .limit(1);

            if (rows.length === 0) return false;

            // Check expiry (in-memory check to avoid extra query)
            const deviceRows = await db
                .select({ expiresAt: trustedDevices.expiresAt })
                .from(trustedDevices)
                .where(eq(trustedDevices.id, rows[0]!.id))
                .limit(1);

            return deviceRows.length > 0 && deviceRows[0]!.expiresAt >= now;
        },

        async updateLastSeen(userId, fingerprintHash) {
            await db
                .update(trustedDevices)
                .set({ lastSeenAt: nowIso() })
                .where(
                    and(
                        eq(trustedDevices.userId, userId),
                        eq(trustedDevices.fingerprintHash, fingerprintHash),
                    ),
                );
        },

        async revoke(userId, deviceId) {
            await db
                .delete(trustedDevices)
                .where(and(eq(trustedDevices.id, deviceId), eq(trustedDevices.userId, userId)));
            logger.info('trusted device revoked', { userId, deviceId });
        },

        async revokeAll(userId) {
            const result = await db
                .delete(trustedDevices)
                .where(eq(trustedDevices.userId, userId));
            const count = result.meta.changes ?? 0;
            logger.info('all trusted devices revoked', { userId, count });
            return count;
        },

        async listDevices(userId) {
            const rows = await db
                .select({
                    id: trustedDevices.id,
                    deviceName: trustedDevices.deviceName,
                    lastSeenAt: trustedDevices.lastSeenAt,
                    expiresAt: trustedDevices.expiresAt,
                })
                .from(trustedDevices)
                .where(eq(trustedDevices.userId, userId));

            return rows;
        },

        async cleanupExpired() {
            const now = nowIso();
            const result = await db
                .delete(trustedDevices)
                .where(lt(trustedDevices.expiresAt, now));
            return result.meta.changes ?? 0;
        },
    };
}
