/**
 * Notification queue consumer — processes messages from NOTIFICATION_QUEUE.
 *
 * Message types:
 * - { type: 'phone_verify_otp', to: string, code: string }
 * - { type: 'approval_notification', userId: string, message: string }
 * - { type: template_name, ... } — dispatched via NotificationService
 *
 * Each message is processed independently; errors on individual
 * messages do not block the rest of the batch.
 */
import type { Env } from '../bindings.js';
import { createEngageSmsClient } from '@felix-travel/sdk-tingg/engage';

interface NotificationMessage {
    type: string;
    to?: string;
    code?: string;
    userId?: string;
    message?: string;
    phone?: string;
    email?: string;
    templateData?: Record<string, string>;
}

export async function handleNotificationBatch(
    batch: MessageBatch<NotificationMessage>,
    env: Env,
): Promise<void> {
    const sms = createEngageSmsClient({
        baseUrl: env.TINGG_ENGAGE_BASE_URL,
        username: env.TINGG_ENGAGE_USERNAME,
        password: env.TINGG_ENGAGE_PASSWORD,
        senderId: env.TINGG_ENGAGE_SENDER_ID,
    });

    for (const msg of batch.messages) {
        try {
            const data = msg.body;

            switch (data.type) {
                case 'phone_verify_otp':
                case 'login_otp':
                case 'step_up_otp':
                case 'mfa_sms_otp': {
                    if (data.to && data.code) {
                        const text = `Your Felix Travel code is ${data.code}. Do not share this code.`;
                        await sms.sendSms(data.to, text);
                    }
                    break;
                }

                case 'approval_notification': {
                    // For now, log — in prod this resolves user phone/email from DB
                    console.log(`Approval notification for user ${data.userId}: ${data.message}`);
                    break;
                }

                case 'password_reset':
                case 'account_locked': {
                    // Email notifications — would route to email provider
                    console.log(`Email notification [${data.type}] for ${data.to ?? data.email}`);
                    break;
                }

                default: {
                    // Generic SMS notification with template data
                    if (data.phone && data.message) {
                        await sms.sendSms(data.phone, data.message);
                    }
                    break;
                }
            }

            msg.ack();
        } catch (err) {
            console.error(`Failed to process notification message:`, err);
            msg.retry();
        }
    }
}
