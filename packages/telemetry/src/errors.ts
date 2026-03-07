/**
 * Error reporting abstraction for Cloudflare Workers.
 *
 * Sentry's full Node SDK doesn't work in Workers, so we use the
 * Sentry envelope protocol directly via fetch – this is the recommended
 * approach for edge runtimes without Node.js APIs.
 *
 * Errors are enriched with correlation IDs, user context, and request metadata
 * before being sent asynchronously (via waitUntil where available).
 */

import { getCorrelationId } from './correlation.js';
import { redact } from './redaction.js';

export interface ErrorReporter {
    captureException(error: unknown, context?: ErrorContext): void;
    captureMessage(message: string, level: 'info' | 'warning' | 'error', context?: ErrorContext): void;
    setUser(user: { id: string; role?: string }): void;
}

interface ErrorContext {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    correlationId?: string;
}

interface SentryConfig {
    dsn: string;
    environment: string;
    release?: string;
    tracesSampleRate?: number;
}

class SentryReporter implements ErrorReporter {
    private readonly dsn: URL;
    private readonly projectId: string;
    private readonly publicKey: string;
    private readonly environment: string;
    private readonly release: string;
    private user?: { id: string; role?: string };

    constructor(config: SentryConfig) {
        this.dsn = new URL(config.dsn);
        this.publicKey = this.dsn.username;
        this.projectId = this.dsn.pathname.slice(1);
        this.environment = config.environment;
        this.release = config.release ?? 'unknown';
    }

    setUser(user: { id: string; role?: string }): void {
        this.user = user;
    }

    captureException(error: unknown, context?: ErrorContext): void {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        const event = this.buildEvent('exception', context);
        event.exception = {
            values: [
                {
                    type: errorObj.name,
                    value: errorObj.message,
                    stacktrace: errorObj.stack
                        ? { frames: this.parseStack(errorObj.stack) }
                        : undefined,
                },
            ],
        };
        this.sendEnvelope(event);
    }

    captureMessage(message: string, level: 'info' | 'warning' | 'error', context?: ErrorContext): void {
        const event = this.buildEvent('message', context);
        event.message = message;
        event.level = level;
        this.sendEnvelope(event);
    }

    private buildEvent(_type: string, context?: ErrorContext): Record<string, unknown> {
        return {
            event_id: crypto.randomUUID().replace(/-/g, ''),
            timestamp: Date.now() / 1000,
            platform: 'javascript',
            environment: this.environment,
            release: this.release,
            tags: {
                ...(context?.tags ?? {}),
                correlationId: context?.correlationId ?? getCorrelationId() ?? 'unknown',
            },
            extra: context?.extra ? (redact(context.extra) as Record<string, unknown>) : undefined,
            user: this.user ? { id: this.user.id, role: this.user.role } : undefined,
        };
    }

    private parseStack(stack: string): Array<{ filename: string; function: string; lineno?: number }> {
        return stack
            .split('\n')
            .slice(1, 10) // Limit stack depth to prevent large payloads
            .map((line) => {
                const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):\d+\)/);
                if (match) {
                    return {
                        function: match[1] ?? '<anonymous>',
                        filename: match[2] ?? '<unknown>',
                        lineno: parseInt(match[3] ?? '0', 10),
                    };
                }
                return { function: '<anonymous>', filename: line.trim() };
            });
    }

    private sendEnvelope(event: Record<string, unknown>): void {
        const envelopeHeader = JSON.stringify({
            event_id: event.event_id,
            dsn: this.dsn.toString(),
            sent_at: new Date().toISOString(),
        });
        const itemHeader = JSON.stringify({
            type: 'event',
            content_type: 'application/json',
        });
        const itemPayload = JSON.stringify(event);
        const envelope = `${envelopeHeader}\n${itemHeader}\n${itemPayload}`;

        const sentryIngestUrl = `https://${this.dsn.host}/api/${this.projectId}/envelope/`;

        // Fire-and-forget; telemetry must never block application flow
        fetch(sentryIngestUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-sentry-envelope',
                'X-Sentry-Auth': `Sentry sentry_version=7,sentry_client=felix-travel-workers/1.0,sentry_key=${this.publicKey}`,
            },
            body: envelope,
        }).catch(() => {
            // Sentry delivery failure must not propagate
        });
    }
}

/** No-op reporter used when Sentry DSN is not configured */
class NoopReporter implements ErrorReporter {
    captureException(): void { }
    captureMessage(): void { }
    setUser(): void { }
}

let globalReporter: ErrorReporter = new NoopReporter();

export function initErrorReporting(config: { dsn?: string; environment: string; release?: string }): ErrorReporter {
    if (config.dsn) {
        globalReporter = new SentryReporter({
            dsn: config.dsn,
            environment: config.environment,
            ...(config.release !== undefined && { release: config.release }),
        });
    }
    return globalReporter;
}

export function reportError(error: unknown, context?: ErrorContext): void {
    globalReporter.captureException(error, context);
}
