/**
 * Global error handler for the Hono application.
 *
 * Catches AppError subclasses and maps them to JSON error responses.
 * Unexpected errors are logged and returned as 500 with a generic message.
 */
import type { Context } from 'hono';
import { AppError } from '../lib/errors.js';
import { AuthorizationError, AuthenticationError } from '@felix-travel/auth';
import { error } from '../lib/response.js';

export function errorHandler(err: Error, c: Context) {
    if (err instanceof AppError) {
        return c.json(error(err.code, err.message, err.details), err.statusCode as any);
    }
    if (err instanceof AuthorizationError) {
        return c.json(error('FORBIDDEN', err.message), 403);
    }
    if (err instanceof AuthenticationError) {
        return c.json(error('UNAUTHORIZED', err.message), 401);
    }

    // Unexpected errors — log and return generic 500
    console.error('Unhandled error:', err);
    return c.json(error('INTERNAL_ERROR', 'An unexpected error occurred', {
        name: err.name,
        message: err.message,
    }), 500);
}
