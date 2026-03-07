/**
 * Tingg Engage SMS adapter — wraps the Tingg Engage v2 SMS API for sending
 * transactional SMS messages (OTPs, notifications, alerts).
 *
 * Uses HTTP Basic auth, separate from the Tingg payments OAuth2 flow.
 */

export interface EngageConfig {
    baseUrl: string;
    username: string;
    password: string;
    senderId: string;
}

export interface EngageSmsResponse {
    success: boolean;
    messageId?: string;
    errorCode?: string;
    errorMessage?: string;
}

export interface EngageSmsClient {
    sendSms(to: string, message: string): Promise<EngageSmsResponse>;
}

export function createEngageSmsClient(config: EngageConfig): EngageSmsClient {
    const authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);

    return {
        async sendSms(to, message): Promise<EngageSmsResponse> {
            const url = `${config.baseUrl}/sms/send`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: authHeader,
                },
                body: JSON.stringify({
                    from: config.senderId,
                    to,
                    message,
                    channel: 'sms',
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                let errorCode = 'ENGAGE_ERROR';
                let errorMessage = text;
                try {
                    const body = JSON.parse(text) as { code?: string; message?: string };
                    errorCode = body.code ?? errorCode;
                    errorMessage = body.message ?? errorMessage;
                } catch {
                    // non-JSON error body
                }
                return { success: false, errorCode, errorMessage };
            }

            const body = (await response.json()) as {
                messageId?: string;
                status?: string;
            };

            return { success: true, ...(body.messageId !== undefined && { messageId: body.messageId }) };
        },
    };
}
