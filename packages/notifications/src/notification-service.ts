/**
 * Notification service — high-level notification dispatch that selects the
 * right template and delivery channel based on the notification type.
 *
 * Enqueues notifications onto Cloudflare Queues for reliable async delivery.
 * When a queue is not available (e.g. in tests), falls back to direct send.
 */
import type { Logger } from '@felix-travel/telemetry';
import type { SmsNotifier } from './sms-notifier.js';
import { templates, type TemplateName } from './templates.js';

export interface NotificationServiceDeps {
    sms: SmsNotifier;
    logger: Logger;
    /** Cloudflare Queue binding for async delivery */
    notificationQueue?: { send(message: unknown): Promise<void> };
}

export interface NotificationPayload {
    template: TemplateName;
    vars: Record<string, string>;
    channels: {
        sms?: string;  // E.164 phone number
        email?: string; // Email address
    };
}

export interface NotificationService {
    /** Send a notification immediately */
    send(payload: NotificationPayload): Promise<void>;
    /** Enqueue a notification for async delivery */
    enqueue(payload: NotificationPayload): Promise<void>;
    /** Process a queued notification (called by queue consumer) */
    process(payload: NotificationPayload): Promise<void>;
}

export function createNotificationService(deps: NotificationServiceDeps): NotificationService {
    const { sms, logger } = deps;

    async function deliver(payload: NotificationPayload): Promise<void> {
        const { template: templateName, vars, channels } = payload;

        if (channels.sms) {
            const message = templates.sms(templateName, vars);
            await sms.send(channels.sms, message);
        }

        // Email delivery would go here when an email provider is integrated.
        // For now, log the intent.
        if (channels.email) {
            const subject = templates.emailSubject(templateName, vars);
            const body = templates.emailBody(templateName, vars);
            if (subject && body) {
                logger.info('email notification would be sent', {
                    to: channels.email,
                    subject,
                });
            }
        }
    }

    return {
        async send(payload) {
            await deliver(payload);
        },

        async enqueue(payload) {
            if (deps.notificationQueue) {
                await deps.notificationQueue.send(payload);
                logger.debug('notification enqueued', { template: payload.template });
            } else {
                // Fallback to direct delivery
                await deliver(payload);
            }
        },

        async process(payload) {
            await deliver(payload);
        },
    };
}
