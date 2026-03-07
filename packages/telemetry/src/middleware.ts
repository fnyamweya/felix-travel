/**
 * Hono middleware that instruments every request with:
 * - Correlation ID (from header or generated)
 * - Structured logging of request/response
 * - Timing measurement
 * - Error reporting to Sentry
 * - Span creation for tracing
 */

import type { MiddlewareHandler } from 'hono';
import { generateCorrelationId, CORRELATION_HEADER } from './correlation.js';
import { createLogger, type LogLevel } from './logger.js';
import { createTracer } from './tracer.js';
import { reportError, initErrorReporting } from './errors.js';

interface TelemetryMiddlewareOptions {
    serviceName: string;
    serviceVersion?: string;
    logLevel?: LogLevel;
    sentryDsn?: string;
    sentryEnvironment?: string;
    otelEndpoint?: string;
    otelHeaders?: Record<string, string>;
}

export function telemetryMiddleware(options: TelemetryMiddlewareOptions): MiddlewareHandler {
    initErrorReporting({
        ...(options.sentryDsn !== undefined && { dsn: options.sentryDsn }),
        environment: options.sentryEnvironment ?? 'development',
        ...(options.serviceVersion !== undefined && { release: options.serviceVersion }),
    });

    return async (c, next) => {
        const correlationId =
            c.req.header(CORRELATION_HEADER) ?? generateCorrelationId();

        // Inject correlation ID into response headers
        c.header(CORRELATION_HEADER, correlationId);

        const logger = createLogger({
            level: options.logLevel ?? 'info',
            service: options.serviceName,
            ...(options.serviceVersion !== undefined && { version: options.serviceVersion }),
            contextKey: correlationId,
        });

        const tracer = createTracer({
            serviceName: options.serviceName,
            ...(options.serviceVersion !== undefined && { serviceVersion: options.serviceVersion }),
            contextKey: correlationId,
        });

        // Make logger and tracer available to downstream handlers
        c.set('logger' as never, logger as never);
        c.set('tracer' as never, tracer as never);
        c.set('correlationId' as never, correlationId as never);

        const span = tracer.startSpan(`${c.req.method} ${c.req.path}`);
        span.setAttribute('http.method', c.req.method);
        span.setAttribute('http.url', c.req.path);

        const startTime = Date.now();

        try {
            await next();

            const duration = Date.now() - startTime;
            span.setAttribute('http.status_code', c.res.status);
            span.end(c.res.status >= 400 ? 'error' : 'ok');

            logger.info('request completed', {
                method: c.req.method,
                path: c.req.path,
                status: c.res.status,
                durationMs: duration,
                correlationId,
            });
        } catch (err) {
            const duration = Date.now() - startTime;
            span.setAttribute('error', true);
            span.addEvent('exception', {
                message: err instanceof Error ? err.message : String(err),
            });
            span.end('error');

            reportError(err, {
                correlationId,
                tags: { method: c.req.method, path: c.req.path },
            });

            logger.error('request failed', {
                method: c.req.method,
                path: c.req.path,
                durationMs: duration,
                error: err instanceof Error ? err.message : String(err),
                correlationId,
            });

            throw err;
        } finally {
            // Export spans asynchronously if OTLP endpoint is configured
            // In Workers, use c.executionCtx.waitUntil() for non-blocking export
            if (options.otelEndpoint) {
                const flushPromise = tracer.flush(options.otelEndpoint, options.otelHeaders);
                try {
                    const ctx = c.executionCtx;
                    if (ctx && typeof ctx.waitUntil === 'function') {
                        ctx.waitUntil(flushPromise);
                    }
                } catch {
                    // executionCtx not available in tests
                }
            }
        }
    };
}
