/**
 * SMS notifier — sends SMS via Tingg Engage API v2.
 *
 * Tingg Engage uses HTTP Basic auth and a simple REST endpoint.
 * This adapter handles authentication, request formatting, and error handling.
 */
import type { Logger } from '@felix-travel/telemetry';

export interface SmsNotifierDeps {
    baseUrl: string;
    username: string;
    password: string;
    senderId: string;
    logger: Logger;
}

export interface SmsNotifier {
    send(to: string, message: string): Promise<{ success: boolean; messageId?: string }>;
}

export function createSmsNotifier(deps: SmsNotifierDeps): SmsNotifier {
    const { baseUrl, username, password, senderId, logger } = deps;
    const authHeader = 'Basic ' + btoa(`${username}:${password}`);

    return {
        async send(to, message) {
            const url = `${baseUrl}/sms/send`;
            const body = {
                from: senderId,
                to,
                message,
                channel: 'sms',
            };

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: authHeader,
                    },
                    body: JSON.stringify(body),
                });

                if (!response.ok) {
                    const text = await response.text();
                    logger.error('Tingg Engage SMS failed', {
                        status: response.status,
                        body: text.slice(0, 500),
                    });
                    return { success: false };
                }

                const result = (await response.json()) as { messageId?: string; status?: string };
                logger.info('SMS sent via Tingg Engage', {
                    to: to.slice(0, 6) + '****', // redact part of phone
                    messageId: result.messageId,
                });

                return { success: true, messageId: result.messageId };
            } catch (err) {
                logger.error('Tingg Engage SMS request error', {
                    error: err instanceof Error ? err.message : String(err),
                });
                return { success: false };
            }
        },
    };
}
