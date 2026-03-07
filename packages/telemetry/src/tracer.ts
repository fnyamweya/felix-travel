/**
 * Lightweight tracing compatible with Cloudflare Workers.
 *
 * Full OpenTelemetry SDK is too heavy for Workers (bundle size + async hooks).
 * Instead, we implement a minimal span model that:
 * - Records timing and status for operations
 * - Propagates trace/span IDs
 * - Can be exported to an OTLP endpoint via fetch POST on request completion
 *
 * When OTEL_EXPORT_ENABLED is false, spans are only logged (zero network cost).
 */

import { getCorrelationId } from './correlation.js';

export interface SpanContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
}

export interface Span {
    name: string;
    context: SpanContext;
    startTime: number;
    endTime?: number;
    status: 'ok' | 'error' | 'unset';
    attributes: Record<string, string | number | boolean>;
    events: Array<{ name: string; timestamp: number; attributes?: Record<string, string | number | boolean> }>;
    end(status?: 'ok' | 'error'): void;
    setAttribute(key: string, value: string | number | boolean): void;
    addEvent(name: string, attributes?: Record<string, string | number | boolean>): void;
}

export interface Tracer {
    startSpan(name: string, parentContext?: SpanContext): Span;
    flush(endpoint?: string, headers?: Record<string, string>): Promise<void>;
}

function generateId(bytes: number): string {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

class SpanImpl implements Span {
    name: string;
    context: SpanContext;
    startTime: number;
    endTime?: number;
    status: 'ok' | 'error' | 'unset' = 'unset';
    attributes: Record<string, string | number | boolean> = {};
    events: Array<{ name: string; timestamp: number; attributes?: Record<string, string | number | boolean> }> = [];

    constructor(name: string, context: SpanContext) {
        this.name = name;
        this.context = context;
        this.startTime = Date.now();
    }

    end(status?: 'ok' | 'error'): void {
        this.endTime = Date.now();
        if (status) this.status = status;
        else if (this.status === 'unset') this.status = 'ok';
    }

    setAttribute(key: string, value: string | number | boolean): void {
        this.attributes[key] = value;
    }

    addEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
        this.events.push({
            name,
            timestamp: Date.now(),
            ...(attributes !== undefined && { attributes }),
        });
    }
}

interface TracerOptions {
    serviceName: string;
    serviceVersion?: string;
    contextKey?: string;
}

class TracerImpl implements Tracer {
    private readonly spans: SpanImpl[] = [];
    private readonly serviceName: string;
    private readonly serviceVersion: string;
    private readonly contextKey: string | undefined;

    constructor(options: TracerOptions) {
        this.serviceName = options.serviceName;
        this.serviceVersion = options.serviceVersion ?? '0.0.0';
        this.contextKey = options.contextKey;
    }

    startSpan(name: string, parentContext?: SpanContext): Span {
        const traceId = parentContext?.traceId ?? generateId(16);
        const spanId = generateId(8);
        const context: SpanContext = {
            traceId,
            spanId,
            ...(parentContext?.spanId !== undefined && { parentSpanId: parentContext.spanId }),
        };
        const span = new SpanImpl(name, context);
        span.setAttribute('service.name', this.serviceName);
        span.setAttribute('service.version', this.serviceVersion);
        const correlationId = getCorrelationId(this.contextKey);
        if (correlationId) {
            span.setAttribute('correlation.id', correlationId);
        }
        this.spans.push(span);
        return span;
    }

    /**
     * Export collected spans to an OTLP-compatible endpoint via fetch.
     * In Workers, this should be called in waitUntil() to avoid blocking the response.
     */
    async flush(endpoint?: string, headers?: Record<string, string>): Promise<void> {
        if (!endpoint || this.spans.length === 0) {
            this.spans.length = 0;
            return;
        }

        const resourceSpans = [
            {
                resource: {
                    attributes: [
                        { key: 'service.name', value: { stringValue: this.serviceName } },
                        { key: 'service.version', value: { stringValue: this.serviceVersion } },
                    ],
                },
                scopeSpans: [
                    {
                        scope: { name: this.serviceName },
                        spans: this.spans.map((s) => ({
                            traceId: s.context.traceId,
                            spanId: s.context.spanId,
                            parentSpanId: s.context.parentSpanId ?? '',
                            name: s.name,
                            startTimeUnixNano: String(s.startTime * 1_000_000),
                            endTimeUnixNano: String((s.endTime ?? Date.now()) * 1_000_000),
                            status: { code: s.status === 'error' ? 2 : s.status === 'ok' ? 1 : 0 },
                            attributes: Object.entries(s.attributes).map(([key, value]) => ({
                                key,
                                value:
                                    typeof value === 'string'
                                        ? { stringValue: value }
                                        : typeof value === 'number'
                                            ? { intValue: String(value) }
                                            : { boolValue: value },
                            })),
                            events: s.events.map((e) => ({
                                timeUnixNano: String(e.timestamp * 1_000_000),
                                name: e.name,
                            })),
                        })),
                    },
                ],
            },
        ];

        try {
            await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                body: JSON.stringify({ resourceSpans }),
            });
        } catch {
            // Telemetry export failure must never break the application
            console.error('Failed to export spans to OTLP endpoint');
        }

        this.spans.length = 0;
    }
}

export function createTracer(options: TracerOptions): Tracer {
    return new TracerImpl(options);
}
