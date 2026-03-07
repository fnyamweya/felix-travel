/**
 * Approval queue consumer — handles async approval workflow events.
 *
 * Message types:
 * - { type: 'expire_stale' }               Run expiry sweep
 * - { type: 'escalate', requestId: string } Check if escalation needed
 * - { type: 'delegation_cleanup' }          Clean up expired delegations
 * - { type: 'notify_candidates', requestId, stepId } Notify step candidates
 */
import type { Env } from '../bindings.js';
import { createDbClient } from '@felix-travel/db';
import { createLogger } from '@felix-travel/telemetry';

interface ApprovalMessage {
    type: string;
    requestId?: string;
    stepId?: string;
}

const logger = createLogger({ level: 'info', service: 'approval-consumer' });

export async function handleApprovalBatch(
    batch: MessageBatch<ApprovalMessage>,
    env: Env,
): Promise<void> {
    const db = createDbClient(env.DB);

    for (const msg of batch.messages) {
        try {
            const data = msg.body;

            switch (data.type) {
                case 'expire_stale': {
                    const { createApprovalService } = await import('@felix-travel/maker-checker');
                    const svc = createApprovalService({ db, logger, generateId: () => crypto.randomUUID() });
                    await svc.expireStaleRequests();
                    break;
                }

                case 'delegation_cleanup': {
                    const { createDelegationService } = await import('@felix-travel/maker-checker');
                    const svc = createDelegationService({ db, logger, generateId: () => crypto.randomUUID() });
                    await svc.cleanupExpired();
                    break;
                }

                case 'notify_candidates': {
                    if (data.requestId) {
                        await env.NOTIFICATION_QUEUE.send({
                            type: 'approval_notification',
                            userId: 'broadcast',
                            message: `New approval request ${data.requestId} requires your attention`,
                        });
                    }
                    break;
                }

                default:
                    console.log(`Unknown approval message type: ${data.type}`);
            }

            msg.ack();
        } catch (err) {
            console.error('Approval queue processing error:', err);
            msg.retry();
        }
    }
}
