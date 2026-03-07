/**
 * Scheduled job handler — runs cron triggers.
 *
 * Cron schedule mapping (from wrangler.toml):
 * - Every 5 min: expire stale approvals, poll pending payments
 * - Every 10 min: poll pending payouts, cleanup expired challenges
 * - Daily at 02:00 UTC: ledger reconciliation
 * - Weekdays at 09:00 UTC: auto-trigger payout batches
 */
import type { Env } from '../bindings.js';
import { createDbClient } from '@felix-travel/db';
import { createLogger } from '@felix-travel/telemetry';

const logger = createLogger({ level: 'info', service: 'scheduled' });

function hexToKey(hex: string): Uint8Array {
    const pairs = hex.match(/.{1,2}/g) ?? [];
    return new Uint8Array(pairs.map((h) => parseInt(h, 16)));
}

export async function handleScheduled(
    event: ScheduledEvent,
    env: Env,
): Promise<void> {
    // Every 5 minutes — expire stale approvals
    if (event.cron === '*/5 * * * *') {
        await env.APPROVAL_QUEUE.send({ type: 'expire_stale' });
        await env.APPROVAL_QUEUE.send({ type: 'delegation_cleanup' });
    }

    // Every 10 minutes — poll pending payout status, cleanup identity challenges
    if (event.cron === '*/10 * * * *') {
        try {
            const db = createDbClient(env.DB);
            const { createStepUpService } = await import('@felix-travel/identity');
            const svc = createStepUpService({
                db,
                logger,
                generateId: () => crypto.randomUUID(),
                totpEncryptionKey: hexToKey(env.MFA_ENCRYPTION_KEY),
            });
            await svc.cleanupExpired();
        } catch (err) {
            console.error('Identity cleanup error:', err);
        }

        try {
            const db = createDbClient(env.DB);
            const { createTrustedDeviceService } = await import('@felix-travel/identity');
            const svc = createTrustedDeviceService({
                db,
                logger,
                generateId: () => crypto.randomUUID(),
            });
            await svc.cleanupExpired();
        } catch (err) {
            console.error('Trusted device cleanup error:', err);
        }
    }

    // Daily at 02:00 UTC — reconciliation
    if (event.cron === '0 2 * * *') {
        await env.RECONCILIATION_QUEUE.send({
            type: 'daily_reconciliation',
            date: new Date(event.scheduledTime - 86400000).toISOString().split('T')[0],
        });
    }

    // Weekdays at 09:00 UTC — auto payouts
    if (event.cron === '0 9 * * 1-5') {
        await env.PAYOUT_QUEUE.send({ type: 'auto_batch_payouts' });
    }
}
