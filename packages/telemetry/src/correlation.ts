/**
 * Correlation ID management for distributed tracing.
 *
 * Every inbound request gets a correlation ID that flows through all
 * downstream service calls, queue messages, and log entries. This enables
 * tracing a single user action across webhooks, queues, and external API calls.
 */

const CORRELATION_HEADER = 'x-correlation-id';
const correlationStore = new Map<string, string>();

/** Generate a new correlation ID using crypto.randomUUID */
export function generateCorrelationId(): string {
    return crypto.randomUUID();
}

/**
 * Associates a correlation ID with the current execution context.
 * In Workers, each request runs in isolation so we key by a context token.
 */
export function withCorrelationId<T>(
    contextKey: string,
    correlationId: string,
    fn: () => T
): T {
    correlationStore.set(contextKey, correlationId);
    try {
        return fn();
    } finally {
        correlationStore.delete(contextKey);
    }
}

/** Retrieve the correlation ID for a given context key */
export function getCorrelationId(contextKey?: string): string | undefined {
    if (contextKey) return correlationStore.get(contextKey);
    // Fallback: return first if only one active
    if (correlationStore.size === 1) {
        return correlationStore.values().next().value ?? undefined;
    }
    return undefined;
}

export { CORRELATION_HEADER };
