/**
 * Structured logger for Cloudflare Workers.
 *
 * Workers don't support traditional log transports, so we write structured
 * JSON to console which is captured by Cloudflare's log pipeline (or
 * Logpush to external destinations).
 *
 * Log levels follow standard severity: debug < info < warn < error.
 * Each log entry includes timestamp, level, correlation ID, and message.
 */

import { getCorrelationId } from './correlation.js';
import { redact } from './redaction.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

export interface Logger {
    debug(message: string, data?: Record<string, unknown>): void;
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
    child(bindings: Record<string, unknown>): Logger;
}

interface LoggerOptions {
    level: LogLevel;
    service: string;
    version?: string;
    contextKey?: string;
    bindings?: Record<string, unknown>;
}

class StructuredLogger implements Logger {
    private readonly minPriority: number;
    private readonly service: string;
    private readonly version: string;
    private readonly contextKey: string | undefined;
    private readonly bindings: Record<string, unknown>;

    constructor(options: LoggerOptions) {
        this.minPriority = LOG_LEVEL_PRIORITY[options.level];
        this.service = options.service;
        this.version = options.version ?? '0.0.0';
        this.contextKey = options.contextKey;
        this.bindings = options.bindings ?? {};
    }

    debug(message: string, data?: Record<string, unknown>): void {
        this.log('debug', message, data);
    }

    info(message: string, data?: Record<string, unknown>): void {
        this.log('info', message, data);
    }

    warn(message: string, data?: Record<string, unknown>): void {
        this.log('warn', message, data);
    }

    error(message: string, data?: Record<string, unknown>): void {
        this.log('error', message, data);
    }

    child(bindings: Record<string, unknown>): Logger {
        return new StructuredLogger({
            level: Object.entries(LOG_LEVEL_PRIORITY).find(
                ([, v]) => v === this.minPriority
            )![0] as LogLevel,
            service: this.service,
            version: this.version,
            ...(this.contextKey !== undefined && { contextKey: this.contextKey }),
            bindings: { ...this.bindings, ...bindings },
        });
    }

    private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
        if (LOG_LEVEL_PRIORITY[level] < this.minPriority) return;

        const entry = {
            timestamp: new Date().toISOString(),
            level,
            service: this.service,
            version: this.version,
            correlationId: getCorrelationId(this.contextKey),
            message,
            ...this.bindings,
            ...(data ? (redact(data) as Record<string, unknown>) : {}),
        };

        const output = JSON.stringify(entry);

        switch (level) {
            case 'debug':
                console.debug(output);
                break;
            case 'info':
                console.info(output);
                break;
            case 'warn':
                console.warn(output);
                break;
            case 'error':
                console.error(output);
                break;
        }
    }
}

export function createLogger(options: LoggerOptions): Logger {
    return new StructuredLogger(options);
}
